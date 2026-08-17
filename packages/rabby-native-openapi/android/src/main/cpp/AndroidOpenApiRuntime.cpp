#include <rabby/http/RabbyHttpTypes.h>
#include <rabby/openapi/RabbyOpenApiClient.h>
#include <rabby/openapi/RabbyOpenApiDiagnostic.h>
#include <rabby/openapi/RabbyOpenApiPlatform.h>
#include <rabby/openapi/RabbyOpenApiTokenSync.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>
#include <rabby/openapi/RabbyTokenSnapshotCodec.h>

#include <jni.h>

#include <chrono>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr const char* kOpenApiBaseUrl = "https://app-api.rabby.io";

JavaVM* javaVm = nullptr;
jclass runtimeClass = nullptr;
jmethodID loadCredentialMethod = nullptr;
jmethodID saveCredentialMethod = nullptr;
jmethodID randomUuidMethod = nullptr;
jmethodID commitTokenSnapshotMethod = nullptr;
jmethodID verifyTokenSnapshotMethod = nullptr;
jmethodID diagnosticCompletedMethod = nullptr;
jmethodID tokenSyncCompletedMethod = nullptr;

std::mutex clientMutex;
std::shared_ptr<rabby::openapi::OpenApiClient> sharedClient;
std::string sharedApplicationIdentity;
std::string sharedClientVersion;
std::mutex tokenSyncCoordinatorMutex;
std::shared_ptr<rabby::openapi::TokenSyncCoordinator>
    sharedTokenSyncCoordinator;

class ScopedEnv {
 public:
  ScopedEnv() {
    if (javaVm == nullptr) {
      return;
    }
    if (javaVm->GetEnv(reinterpret_cast<void**>(&env_), JNI_VERSION_1_6) ==
        JNI_OK) {
      return;
    }
    if (javaVm->AttachCurrentThread(&env_, nullptr) == JNI_OK) {
      attached_ = true;
    } else {
      env_ = nullptr;
    }
  }

  ~ScopedEnv() {
    if (attached_ && javaVm != nullptr) {
      javaVm->DetachCurrentThread();
    }
  }

  JNIEnv* get() const {
    return env_;
  }

 private:
  JNIEnv* env_{nullptr};
  bool attached_{false};
};

std::string fromJavaString(JNIEnv* env, jstring value) {
  if (value == nullptr) {
    return {};
  }
  const auto* chars = env->GetStringUTFChars(value, nullptr);
  if (chars == nullptr) {
    return {};
  }
  std::string result(chars);
  env->ReleaseStringUTFChars(value, chars);
  return result;
}

jstring toJavaString(JNIEnv* env, const std::string& value) {
  return env->NewStringUTF(value.c_str());
}

jobjectArray toJavaStringArray(
    JNIEnv* env,
    const std::vector<std::string>& values) {
  auto stringClass = env->FindClass("java/lang/String");
  if (stringClass == nullptr) {
    return nullptr;
  }
  auto result = env->NewObjectArray(
      static_cast<jsize>(values.size()), stringClass, nullptr);
  env->DeleteLocalRef(stringClass);
  if (result == nullptr) {
    return nullptr;
  }
  for (std::size_t index = 0; index < values.size(); ++index) {
    auto value = toJavaString(env, values[index]);
    env->SetObjectArrayElement(result, static_cast<jsize>(index), value);
    env->DeleteLocalRef(value);
  }
  return result;
}

std::vector<std::string> fromJavaStringArray(
    JNIEnv* env,
    jobjectArray values) {
  std::vector<std::string> result;
  if (values == nullptr) {
    return result;
  }
  const auto count = env->GetArrayLength(values);
  result.reserve(static_cast<std::size_t>(count));
  for (jsize index = 0; index < count; ++index) {
    auto value = static_cast<jstring>(env->GetObjectArrayElement(values, index));
    result.push_back(fromJavaString(env, value));
    env->DeleteLocalRef(value);
  }
  return result;
}

bool clearJavaException(JNIEnv* env) {
  if (!env->ExceptionCheck()) {
    return false;
  }
  env->ExceptionClear();
  return true;
}

class AndroidApiCredentialPersistence final
    : public rabby::openapi::ApiCredentialPersistence {
 public:
  rabby::openapi::LoadApiCredentialResult load() override {
    ScopedEnv scopedEnv;
    auto* env = scopedEnv.get();
    if (env == nullptr || runtimeClass == nullptr ||
        loadCredentialMethod == nullptr) {
      return {std::nullopt, "Android credential storage is unavailable"};
    }

    auto result = static_cast<jobjectArray>(env->CallStaticObjectMethod(
        runtimeClass,
        loadCredentialMethod));
    if (clearJavaException(env)) {
      return {std::nullopt, "Android credential load failed"};
    }
    if (result == nullptr) {
      return {std::nullopt, {}};
    }
    if (env->GetArrayLength(result) != 2) {
      env->DeleteLocalRef(result);
      return {std::nullopt, "Android credential storage is malformed"};
    }

    auto apiKey = static_cast<jstring>(env->GetObjectArrayElement(result, 0));
    auto apiTime = static_cast<jstring>(env->GetObjectArrayElement(result, 1));
    const auto apiKeyValue = fromJavaString(env, apiKey);
    const auto apiTimeValue = fromJavaString(env, apiTime);
    env->DeleteLocalRef(apiKey);
    env->DeleteLocalRef(apiTime);
    env->DeleteLocalRef(result);

    std::int64_t parsedTime = 0;
    try {
      std::size_t parsedBytes = 0;
      parsedTime = std::stoll(apiTimeValue, &parsedBytes);
      if (parsedBytes != apiTimeValue.size()) {
        return {std::nullopt, "Android credential time is malformed"};
      }
    } catch (...) {
      return {std::nullopt, "Android credential time is malformed"};
    }
    return {rabby::openapi::ApiCredential{apiKeyValue, parsedTime}, {}};
  }

  std::string save(
      const rabby::openapi::ApiCredential& credential) override {
    ScopedEnv scopedEnv;
    auto* env = scopedEnv.get();
    if (env == nullptr || runtimeClass == nullptr ||
        saveCredentialMethod == nullptr) {
      return "Android credential storage is unavailable";
    }

    auto apiKey = toJavaString(env, credential.apiKey);
    const auto saved = env->CallStaticBooleanMethod(
        runtimeClass,
        saveCredentialMethod,
        apiKey,
        static_cast<jlong>(credential.apiTime));
    env->DeleteLocalRef(apiKey);
    if (clearJavaException(env)) {
      return "Android credential save failed";
    }
    return saved == JNI_TRUE ? std::string{} :
                               "Android credential save was not committed";
  }
};

std::string joinTokenCacheColumns() {
  const auto columns = rabby::openapi::tokenCacheColumnNames();
  std::string result;
  for (std::size_t index = 0; index < columns.size(); ++index) {
    if (index != 0) {
      result.push_back(',');
    }
    result.append(columns[index]);
  }
  return result;
}

class AndroidTokenCachePersistence final
    : public rabby::openapi::TokenCachePersistence {
 public:
  rabby::openapi::TokenCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const std::vector<rabby::openapi::NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const rabby::openapi::TokenCacheReplacementScope& replacementScope)
      override {
    return runSnapshot(
        ownerAddress,
        tokens,
        syncTimestampMs,
        replacementScope,
        commitTokenSnapshotMethod);
  }

  rabby::openapi::TokenCacheCommitResult verifyWriteContract(
      std::int64_t syncTimestampMs) override {
    auto probe = rabby::openapi::makeTokenCacheWriteProbeRecord(
        syncTimestampMs);
    const auto ownerAddress = probe.ownerAddress;
    return runSnapshot(
        ownerAddress,
        {std::move(probe)},
        syncTimestampMs,
        rabby::openapi::TokenCacheReplacementScope{},
        verifyTokenSnapshotMethod);
  }

 private:
  rabby::openapi::TokenCacheCommitResult runSnapshot(
      const std::string& ownerAddress,
      const std::vector<rabby::openapi::NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const rabby::openapi::TokenCacheReplacementScope& replacementScope,
      jmethodID method) {
    ScopedEnv scopedEnv;
    auto* env = scopedEnv.get();
    if (env == nullptr || runtimeClass == nullptr || method == nullptr) {
      return {false, 0, "Android token cache storage is unavailable"};
    }

    auto payload = rabby::openapi::encodeTokenSnapshot(tokens);
    auto owner = toJavaString(env, ownerAddress);
    auto tableName = toJavaString(env, rabby::openapi::kTokenCacheTableName);
    auto upsertSql = toJavaString(env, rabby::openapi::tokenCacheUpsertSql());
    auto deleteStaleSql =
        toJavaString(env, rabby::openapi::tokenCacheDeleteStaleSql());
    auto deleteStaleForChainSql = toJavaString(
        env, rabby::openapi::tokenCacheDeleteStaleForChainSql());
    auto replacementChains =
        toJavaStringArray(env, replacementScope.chainIds);
    auto expectedColumns = toJavaString(env, joinTokenCacheColumns());
    auto payloadBuffer = env->NewDirectByteBuffer(
        payload.data(),
        static_cast<jlong>(payload.size()));

    auto error = static_cast<jstring>(env->CallStaticObjectMethod(
        runtimeClass,
        method,
        owner,
        static_cast<jlong>(syncTimestampMs),
        replacementScope.kind ==
                rabby::openapi::TokenCacheReplacementKind::Address
            ? 0
            : 1,
        replacementChains,
        tableName,
        upsertSql,
        deleteStaleSql,
        deleteStaleForChainSql,
        expectedColumns,
        payloadBuffer));

    env->DeleteLocalRef(owner);
    env->DeleteLocalRef(tableName);
    env->DeleteLocalRef(upsertSql);
    env->DeleteLocalRef(deleteStaleSql);
    env->DeleteLocalRef(deleteStaleForChainSql);
    env->DeleteLocalRef(replacementChains);
    env->DeleteLocalRef(expectedColumns);
    env->DeleteLocalRef(payloadBuffer);
    if (clearJavaException(env)) {
      return {false, 0, "Android token cache transaction failed"};
    }
    if (error == nullptr) {
      return {true, tokens.size(), {}};
    }
    auto errorValue = fromJavaString(env, error);
    env->DeleteLocalRef(error);
    if (errorValue.empty()) {
      errorValue = "Android token cache transaction failed";
    }
    return {false, 0, std::move(errorValue)};
  }
};

std::shared_ptr<rabby::openapi::OpenApiClient> getClient(
    const std::string& applicationIdentity,
    const std::string& clientVersion,
    std::string& error) {
  std::lock_guard<std::mutex> lock(clientMutex);
  if (sharedClient) {
    if (sharedApplicationIdentity != applicationIdentity ||
        sharedClientVersion != clientVersion) {
      error = "native OpenAPI configuration changed during this process";
      return nullptr;
    }
    return sharedClient;
  }

  auto uuidProvider = []() { return rabby::openapi::makePlatformUuid(); };
  auto epochProvider = []() { return rabby::openapi::platformEpochSeconds(); };
  sharedClient = std::make_shared<rabby::openapi::OpenApiClient>(
      rabby::openapi::OpenApiClientConfiguration{
          applicationIdentity,
          kOpenApiBaseUrl,
          "rabbymobile",
          clientVersion,
      },
      rabby::http::makePlatformClient(),
      rabby::openapi::unavailableOpenApiRequestSigner,
      rabby::openapi::makePlatformApiCredentialPersistence(),
      uuidProvider,
      epochProvider,
      uuidProvider);
  sharedApplicationIdentity = applicationIdentity;
  sharedClientVersion = clientVersion;
  return sharedClient;
}

std::shared_ptr<rabby::openapi::TokenSyncCoordinator>
getTokenSyncCoordinator(
    const std::string& applicationIdentity,
    const std::string& clientVersion,
    std::string& error) {
  auto client = getClient(applicationIdentity, clientVersion, error);
  if (!client) {
    return nullptr;
  }

  std::lock_guard<std::mutex> lock(tokenSyncCoordinatorMutex);
  if (!sharedTokenSyncCoordinator) {
    sharedTokenSyncCoordinator =
        std::make_shared<rabby::openapi::TokenSyncCoordinator>(
            [client](
                rabby::openapi::OpenApiClientRequest request,
                rabby::openapi::OpenApiClientCompletion completion) {
              return client->execute(
                  std::move(request), std::move(completion));
            },
            rabby::openapi::makePlatformTokenCachePersistence(),
            []() {
              return std::chrono::duration_cast<std::chrono::milliseconds>(
                         std::chrono::system_clock::now().time_since_epoch())
                  .count();
            });
  }
  return sharedTokenSyncCoordinator;
}

void notifyDiagnostic(
    jlong diagnosticId,
    const rabby::openapi::OpenApiDiagnosticResult& result) {
  ScopedEnv scopedEnv;
  auto* env = scopedEnv.get();
  if (env == nullptr || runtimeClass == nullptr ||
      diagnosticCompletedMethod == nullptr) {
    return;
  }

  auto error = toJavaString(env, result.error);
  auto firstDisposition = toJavaString(
      env,
      rabby::openapi::credentialResponseDispositionName(
          result.first.credentialDisposition));
  auto secondDisposition = toJavaString(
      env,
      rabby::openapi::credentialResponseDispositionName(
          result.second.credentialDisposition));

  env->CallStaticVoidMethod(
      runtimeClass,
      diagnosticCompletedMethod,
      diagnosticId,
      result.success ? JNI_TRUE : JNI_FALSE,
      error,
      static_cast<jint>(result.first.statusCode),
      static_cast<jint>(result.second.statusCode),
      static_cast<jlong>(result.first.durationMs),
      static_cast<jlong>(result.second.durationMs),
      static_cast<jlong>(result.first.bodyBytes),
      static_cast<jlong>(result.second.bodyBytes),
      firstDisposition,
      secondDisposition,
      static_cast<jlong>(result.first.requestCredentialRevision),
      static_cast<jlong>(result.first.currentCredentialRevision),
      static_cast<jlong>(result.second.requestCredentialRevision),
      static_cast<jlong>(result.second.currentCredentialRevision),
      result.secondUsedLatestAvailableCredential ? JNI_TRUE : JNI_FALSE);

  env->DeleteLocalRef(error);
  env->DeleteLocalRef(firstDisposition);
  env->DeleteLocalRef(secondDisposition);
  clearJavaException(env);
}

void notifyTokenSync(
    jlong syncId,
    const rabby::openapi::TokenSyncResult& result) {
  ScopedEnv scopedEnv;
  auto* env = scopedEnv.get();
  if (env == nullptr || runtimeClass == nullptr ||
      tokenSyncCompletedMethod == nullptr) {
    return;
  }

  auto address = toJavaString(env, result.address);
  auto stage = toJavaString(
      env, rabby::openapi::tokenSyncStageName(result.stage));
  auto error = toJavaString(env, result.error);
  env->CallStaticVoidMethod(
      runtimeClass,
      tokenSyncCompletedMethod,
      syncId,
      result.success ? JNI_TRUE : JNI_FALSE,
      address,
      static_cast<jlong>(result.generation),
      stage,
      static_cast<jlong>(result.chainCount),
      static_cast<jlong>(result.sourceTokenCount),
      static_cast<jlong>(result.filteredTokenCount),
      static_cast<jlong>(result.committedRowCount),
      static_cast<jlong>(result.durationMs),
      error);
  env->DeleteLocalRef(address);
  env->DeleteLocalRef(stage);
  env->DeleteLocalRef(error);
  clearJavaException(env);
}

void startDiagnostic(
    JNIEnv* env,
    jclass,
    jlong diagnosticId,
    jstring applicationIdentity,
    jstring clientVersion,
    jstring address) {
  const auto applicationIdentityValue =
      fromJavaString(env, applicationIdentity);
  const auto clientVersionValue = fromJavaString(env, clientVersion);
  const auto addressValue = fromJavaString(env, address);

  std::string error;
  auto client = getClient(
      applicationIdentityValue,
      clientVersionValue,
      error);
  if (!client) {
    rabby::openapi::OpenApiDiagnosticResult result;
    result.error = std::move(error);
    notifyDiagnostic(diagnosticId, result);
    return;
  }

  rabby::openapi::runUsedChainListDiagnostic(
      std::move(client),
      addressValue,
      [diagnosticId](rabby::openapi::OpenApiDiagnosticResult result) {
        notifyDiagnostic(diagnosticId, result);
      });
}

void startTokenSync(
    JNIEnv* env,
    jclass,
    jlong syncId,
    jstring applicationIdentity,
    jstring clientVersion,
    jstring address,
    jboolean replaceExisting) {
  const auto applicationIdentityValue =
      fromJavaString(env, applicationIdentity);
  const auto clientVersionValue = fromJavaString(env, clientVersion);
  const auto addressValue = fromJavaString(env, address);

  std::string error;
  auto coordinator = getTokenSyncCoordinator(
      applicationIdentityValue, clientVersionValue, error);
  if (!coordinator) {
    rabby::openapi::TokenSyncResult result;
    result.address = addressValue;
    result.error = std::move(error);
    notifyTokenSync(syncId, result);
    return;
  }

  coordinator->syncAddress(
      addressValue,
      replaceExisting == JNI_TRUE,
      [syncId](rabby::openapi::TokenSyncResult result) {
        notifyTokenSync(syncId, result);
      });
}

void startTokenChainSync(
    JNIEnv* env,
    jclass,
    jlong syncId,
    jstring applicationIdentity,
    jstring clientVersion,
    jstring address,
    jobjectArray chainIds,
    jint replacementKind,
    jboolean replaceExisting) {
  const auto applicationIdentityValue =
      fromJavaString(env, applicationIdentity);
  const auto clientVersionValue = fromJavaString(env, clientVersion);
  const auto addressValue = fromJavaString(env, address);
  auto chainIdValues = fromJavaStringArray(env, chainIds);

  rabby::openapi::TokenCacheReplacementScope replacementScope;
  if (replacementKind == 0) {
    replacementScope.kind =
        rabby::openapi::TokenCacheReplacementKind::Address;
  } else if (replacementKind == 1) {
    replacementScope.kind =
        rabby::openapi::TokenCacheReplacementKind::Chains;
    replacementScope.chainIds = chainIdValues;
  } else {
    rabby::openapi::TokenSyncResult result;
    result.address = addressValue;
    result.stage = rabby::openapi::TokenSyncStage::TokenLists;
    result.error = "token cache replacement kind is invalid";
    notifyTokenSync(syncId, result);
    return;
  }

  std::string error;
  auto coordinator = getTokenSyncCoordinator(
      applicationIdentityValue, clientVersionValue, error);
  if (!coordinator) {
    rabby::openapi::TokenSyncResult result;
    result.address = addressValue;
    result.error = std::move(error);
    notifyTokenSync(syncId, result);
    return;
  }

  coordinator->syncChains(
      addressValue,
      std::move(chainIdValues),
      std::move(replacementScope),
      replaceExisting == JNI_TRUE,
      [syncId](rabby::openapi::TokenSyncResult result) {
        notifyTokenSync(syncId, result);
      });
}

void cancelTokenSync(JNIEnv* env, jclass, jstring address) {
  std::shared_ptr<rabby::openapi::TokenSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(tokenSyncCoordinatorMutex);
    coordinator = sharedTokenSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAddress(fromJavaString(env, address));
  }
}

void cancelAllTokenSyncs(JNIEnv*, jclass) {
  std::shared_ptr<rabby::openapi::TokenSyncCoordinator> coordinator;
  {
    std::lock_guard<std::mutex> lock(tokenSyncCoordinatorMutex);
    coordinator = sharedTokenSyncCoordinator;
  }
  if (coordinator) {
    coordinator->cancelAll();
  }
}

jstring verifyTokenCacheWrite(JNIEnv* env, jclass, jlong syncTimestampMs) {
  const auto result =
      rabby::openapi::makePlatformTokenCachePersistence()
          ->verifyWriteContract(static_cast<std::int64_t>(syncTimestampMs));
  return result.success ? nullptr : toJavaString(env, result.error);
}

} // namespace

namespace rabby::openapi {

std::shared_ptr<ApiCredentialPersistence>
makePlatformApiCredentialPersistence() {
  static auto persistence =
      std::make_shared<AndroidApiCredentialPersistence>();
  return persistence;
}

std::shared_ptr<TokenCachePersistence> makePlatformTokenCachePersistence() {
  static auto persistence =
      std::make_shared<AndroidTokenCachePersistence>();
  return persistence;
}

std::string makePlatformUuid() {
  ScopedEnv scopedEnv;
  auto* env = scopedEnv.get();
  if (env == nullptr || runtimeClass == nullptr || randomUuidMethod == nullptr) {
    return {};
  }
  auto value = static_cast<jstring>(env->CallStaticObjectMethod(
      runtimeClass,
      randomUuidMethod));
  if (clearJavaException(env)) {
    return {};
  }
  const auto result = fromJavaString(env, value);
  env->DeleteLocalRef(value);
  return result;
}

std::int64_t platformEpochSeconds() {
  return std::chrono::duration_cast<std::chrono::seconds>(
             std::chrono::system_clock::now().time_since_epoch())
      .count();
}

} // namespace rabby::openapi

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  JNIEnv* env = nullptr;
  if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
    return JNI_ERR;
  }

  javaVm = vm;
  auto localRuntime =
      env->FindClass("com/rabbywallet/nativeopenapi/RabbyNativeOpenApiRuntime");
  if (localRuntime == nullptr) {
    env->ExceptionClear();
    return JNI_ERR;
  }
  runtimeClass = static_cast<jclass>(env->NewGlobalRef(localRuntime));
  env->DeleteLocalRef(localRuntime);

  loadCredentialMethod = env->GetStaticMethodID(
      runtimeClass,
      "loadCredential",
      "()[Ljava/lang/String;");
  saveCredentialMethod = env->GetStaticMethodID(
      runtimeClass,
      "saveCredential",
      "(Ljava/lang/String;J)Z");
  randomUuidMethod = env->GetStaticMethodID(
      runtimeClass,
      "randomUuid",
      "()Ljava/lang/String;");
  commitTokenSnapshotMethod = env->GetStaticMethodID(
      runtimeClass,
      "commitTokenSnapshot",
      "(Ljava/lang/String;JI[Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/nio/ByteBuffer;)Ljava/lang/String;");
  verifyTokenSnapshotMethod = env->GetStaticMethodID(
      runtimeClass,
      "verifyTokenSnapshotWriteContract",
      "(Ljava/lang/String;JI[Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/nio/ByteBuffer;)Ljava/lang/String;");
  diagnosticCompletedMethod = env->GetStaticMethodID(
      runtimeClass,
      "onDiagnosticCompleted",
      "(JZLjava/lang/String;IIJJJJLjava/lang/String;Ljava/lang/String;JJJJZ)V");
  tokenSyncCompletedMethod = env->GetStaticMethodID(
      runtimeClass,
      "onTokenSyncCompleted",
      "(JZLjava/lang/String;JLjava/lang/String;JJJJJLjava/lang/String;)V");
  if (loadCredentialMethod == nullptr || saveCredentialMethod == nullptr ||
      randomUuidMethod == nullptr || commitTokenSnapshotMethod == nullptr ||
      verifyTokenSnapshotMethod == nullptr ||
      diagnosticCompletedMethod == nullptr ||
      tokenSyncCompletedMethod == nullptr) {
    env->ExceptionClear();
    return JNI_ERR;
  }

  const JNINativeMethod methods[] = {
      {"startDiagnostic",
       "(JLjava/lang/String;Ljava/lang/String;Ljava/lang/String;)V",
       reinterpret_cast<void*>(startDiagnostic)},
      {"startTokenSync",
       "(JLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Z)V",
       reinterpret_cast<void*>(startTokenSync)},
      {"startTokenChainSync",
       "(JLjava/lang/String;Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;IZ)V",
       reinterpret_cast<void*>(startTokenChainSync)},
      {"cancelTokenSync",
       "(Ljava/lang/String;)V",
       reinterpret_cast<void*>(cancelTokenSync)},
      {"cancelAllTokenSyncs",
       "()V",
       reinterpret_cast<void*>(cancelAllTokenSyncs)},
      {"verifyTokenCacheWrite",
       "(J)Ljava/lang/String;",
       reinterpret_cast<void*>(verifyTokenCacheWrite)},
  };
  if (env->RegisterNatives(
          runtimeClass,
          methods,
          static_cast<jint>(sizeof(methods) / sizeof(methods[0]))) != JNI_OK) {
    env->ExceptionClear();
    return JNI_ERR;
  }
  return JNI_VERSION_1_6;
}
