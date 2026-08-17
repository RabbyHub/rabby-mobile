#include "AndroidHttpClient.h"

#include <algorithm>
#include <atomic>
#include <mutex>
#include <unordered_map>
#include <utility>

namespace rabby::http::android {
namespace {

JavaVM* javaVm = nullptr;
jclass executorClass = nullptr;
jmethodID executeMethod = nullptr;
jmethodID cancelMethod = nullptr;
jclass stringClass = nullptr;

std::atomic<std::uint64_t> nextRequestId{1};

struct PendingRequest {
  Completion completion;
};

std::mutex pendingMutex;
std::unordered_map<std::uint64_t, PendingRequest> pendingRequests;

class ScopedEnv {
 public:
  ScopedEnv() {
    if (javaVm == nullptr) {
      return;
    }
    if (javaVm->GetEnv(reinterpret_cast<void**>(&env_), JNI_VERSION_1_6) == JNI_OK) {
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
  const char* chars = env->GetStringUTFChars(value, nullptr);
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

std::vector<std::uint8_t> fromJavaBytes(JNIEnv* env, jbyteArray bytes) {
  if (bytes == nullptr) {
    return {};
  }
  const auto size = env->GetArrayLength(bytes);
  std::vector<std::uint8_t> result(static_cast<std::size_t>(size));
  if (size > 0) {
    env->GetByteArrayRegion(
        bytes,
        0,
        size,
        reinterpret_cast<jbyte*>(result.data()));
  }
  return result;
}

jbyteArray toJavaBytes(JNIEnv* env, const std::vector<std::uint8_t>& bytes) {
  auto result = env->NewByteArray(static_cast<jsize>(bytes.size()));
  if (result != nullptr && !bytes.empty()) {
    env->SetByteArrayRegion(
        result,
        0,
        static_cast<jsize>(bytes.size()),
        reinterpret_cast<const jbyte*>(bytes.data()));
  }
  return result;
}

std::vector<Header> fromJavaHeaders(
    JNIEnv* env,
    jobjectArray names,
    jobjectArray values) {
  if (names == nullptr || values == nullptr) {
    return {};
  }
  const auto count = std::min(env->GetArrayLength(names), env->GetArrayLength(values));
  std::vector<Header> headers;
  headers.reserve(static_cast<std::size_t>(count));
  for (jsize index = 0; index < count; ++index) {
    auto name = static_cast<jstring>(env->GetObjectArrayElement(names, index));
    auto value = static_cast<jstring>(env->GetObjectArrayElement(values, index));
    headers.push_back({fromJavaString(env, name), fromJavaString(env, value)});
    env->DeleteLocalRef(name);
    env->DeleteLocalRef(value);
  }
  return headers;
}

jobjectArray toJavaHeaderField(
    JNIEnv* env,
    const std::vector<Header>& headers,
    bool names) {
  auto array = env->NewObjectArray(
      static_cast<jsize>(headers.size()),
      stringClass,
      nullptr);
  for (std::size_t index = 0; index < headers.size(); ++index) {
    auto value = toJavaString(env, names ? headers[index].name : headers[index].value);
    env->SetObjectArrayElement(array, static_cast<jsize>(index), value);
    env->DeleteLocalRef(value);
  }
  return array;
}

ErrorCode parseErrorCode(const std::string& code) {
  if (code == "cancelled") {
    return ErrorCode::Cancelled;
  }
  if (code == "timeout") {
    return ErrorCode::Timeout;
  }
  if (code == "network") {
    return ErrorCode::Network;
  }
  if (code == "invalid_request") {
    return ErrorCode::InvalidRequest;
  }
  if (code == "response_too_large") {
    return ErrorCode::ResponseTooLarge;
  }
  return ErrorCode::Transport;
}

void complete(std::uint64_t requestId, Result result) {
  Completion completion;
  {
    std::lock_guard<std::mutex> lock(pendingMutex);
    const auto found = pendingRequests.find(requestId);
    if (found == pendingRequests.end()) {
      return;
    }
    completion = std::move(found->second.completion);
    pendingRequests.erase(found);
  }
  if (completion) {
    completion(std::move(result));
  }
}

void cancelPlatformRequest(std::uint64_t requestId) {
  ScopedEnv scopedEnv;
  auto env = scopedEnv.get();
  if (env == nullptr || executorClass == nullptr || cancelMethod == nullptr) {
    return;
  }
  env->CallStaticVoidMethod(executorClass, cancelMethod, static_cast<jlong>(requestId));
  if (env->ExceptionCheck()) {
    env->ExceptionClear();
  }
}

class AndroidRequestHandle final : public RequestHandle {
 public:
  explicit AndroidRequestHandle(std::uint64_t requestId) : requestId_(requestId) {}

  std::uint64_t requestId() const override {
    return requestId_;
  }

  void cancel() override {
    bool expected = false;
    if (!cancelled_.compare_exchange_strong(expected, true)) {
      return;
    }
    cancelPlatformRequest(requestId_);
    complete(
        requestId_,
        Result::failure(Error{ErrorCode::Cancelled, "request cancelled", 0}));
  }

 private:
  std::uint64_t requestId_;
  std::atomic<bool> cancelled_{false};
};

class AndroidClient final : public Client {
 public:
  std::shared_ptr<RequestHandle> execute(
      Request request,
      Completion completionCallback) override {
    const auto requestId = nextRequestId.fetch_add(1);
    auto handle = std::make_shared<AndroidRequestHandle>(requestId);

    const auto validationError = validateRequest(request);
    if (!validationError.empty()) {
      completionCallback(Result::failure(
          Error{ErrorCode::InvalidRequest, validationError, 0}));
      return handle;
    }
    request.headers = normalizeRequestHeaders(request.headers);

    {
      std::lock_guard<std::mutex> lock(pendingMutex);
      pendingRequests.emplace(requestId, PendingRequest{std::move(completionCallback)});
    }

    ScopedEnv scopedEnv;
    auto env = scopedEnv.get();
    if (env == nullptr || executorClass == nullptr || executeMethod == nullptr) {
      complete(
          requestId,
          Result::failure(Error{ErrorCode::Transport, "android http executor unavailable", 0}));
      return handle;
    }

    auto url = toJavaString(env, request.url);
    auto method = env->NewStringUTF(methodName(request.method));
    auto headerNames = toJavaHeaderField(env, request.headers, true);
    auto headerValues = toJavaHeaderField(env, request.headers, false);
    auto body = toJavaBytes(env, request.body);

    env->CallStaticVoidMethod(
        executorClass,
        executeMethod,
        static_cast<jlong>(requestId),
        url,
        method,
        headerNames,
        headerValues,
        body,
        static_cast<jlong>(request.timeoutMs),
        static_cast<jlong>(request.maxResponseBytes));

    env->DeleteLocalRef(url);
    env->DeleteLocalRef(method);
    env->DeleteLocalRef(headerNames);
    env->DeleteLocalRef(headerValues);
    env->DeleteLocalRef(body);

    if (env->ExceptionCheck()) {
      env->ExceptionClear();
      complete(
          requestId,
          Result::failure(Error{ErrorCode::Transport, "android http dispatch failed", 0}));
    }
    return handle;
  }
};

} // namespace

bool initialize(JavaVM* vm, JNIEnv* env) {
  javaVm = vm;
  auto localExecutor = env->FindClass("com/rabbywallet/nativehttp/NativeHttpExecutor");
  auto localString = env->FindClass("java/lang/String");
  if (localExecutor == nullptr || localString == nullptr) {
    env->ExceptionClear();
    return false;
  }

  executorClass = static_cast<jclass>(env->NewGlobalRef(localExecutor));
  stringClass = static_cast<jclass>(env->NewGlobalRef(localString));
  env->DeleteLocalRef(localExecutor);
  env->DeleteLocalRef(localString);

  executeMethod = env->GetStaticMethodID(
      executorClass,
      "execute",
      "(JLjava/lang/String;Ljava/lang/String;[Ljava/lang/String;[Ljava/lang/String;[BJJ)V");
  cancelMethod = env->GetStaticMethodID(executorClass, "cancel", "(J)V");
  if (executeMethod == nullptr || cancelMethod == nullptr) {
    env->ExceptionClear();
    return false;
  }
  return true;
}

std::shared_ptr<Client> makeClient() {
  static auto client = std::make_shared<AndroidClient>();
  return client;
}

void completeResponse(
    JNIEnv* env,
    std::uint64_t requestId,
    jint statusCode,
    jstring finalUrl,
    jobjectArray headerNames,
    jobjectArray headerValues,
    jbyteArray body,
    jlong durationMs) {
  complete(
      requestId,
      Result::success(Response{
          static_cast<int>(statusCode),
          fromJavaString(env, finalUrl),
          fromJavaHeaders(env, headerNames, headerValues),
          fromJavaBytes(env, body),
          static_cast<std::int64_t>(durationMs)}));
}

void completeFailure(
    JNIEnv* env,
    std::uint64_t requestId,
    jstring code,
    jstring message,
    jlong durationMs) {
  const auto nativeCode = fromJavaString(env, code);
  complete(
      requestId,
      Result::failure(Error{
          parseErrorCode(nativeCode),
          fromJavaString(env, message),
          static_cast<std::int64_t>(durationMs)}));
}

} // namespace rabby::http::android

namespace rabby::http {

std::shared_ptr<Client> makePlatformClient() {
  return android::makeClient();
}

} // namespace rabby::http
