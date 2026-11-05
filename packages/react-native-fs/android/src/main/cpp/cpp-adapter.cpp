#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <ReactCommon/CallInvokerHolder.h>

#include <algorithm>
#include <mutex>
#include <unordered_map>

#include "RabbyNativeFS.h"

using namespace facebook;

class RabbyNativeFSAdapter : public jni::HybridClass<RabbyNativeFSAdapter> {
 public:
  static constexpr auto kJavaDescriptor = "Lcom/rnfs/RNFSManager;";

  explicit RabbyNativeFSAdapter(jni::global_ref<jhybridobject> javaPart)
      : javaPart_(std::move(javaPart)) {}

  static jni::local_ref<jhybriddata> initHybrid(
      jni::alias_ref<jhybridobject> javaPart) {
    return makeCxxInstance(jni::make_global(javaPart));
  }

  void nativeInstall(
      jlong jsiPtr,
      jni::alias_ref<react::CallInvokerHolder::javaobject> jsCallInvokerHolder,
      jni::alias_ref<jni::JString> cacheDirectory) {
    auto runtime = reinterpret_cast<jsi::Runtime*>(jsiPtr);
    if (runtime != nullptr) {
      auto callInvoker =
          jsCallInvokerHolder != nullptr
          ? jsCallInvokerHolder->cthis()->getCallInvoker()
          : nullptr;
      rabbyfs::install(
          *runtime,
          callInvoker,
          cacheDirectory != nullptr ? cacheDirectory->toStdString() : "",
          [this](
              rabbyfs::SafeMediaDownloadRequest request,
              rabbyfs::SafeMediaDownloadCompletion completion) {
            startSafeMediaDownload(std::move(request), std::move(completion));
          });
    }
  }

  void nativeCompleteSafeMediaDownload(
      jlong requestId,
      jint code,
      jint httpStatus,
      jlong bytesWritten) {
    rabbyfs::SafeMediaDownloadCompletion completion;
    {
      std::lock_guard<std::mutex> lock(completionsMutex_);
      const auto found = completions_.find(static_cast<uint64_t>(requestId));
      if (found == completions_.end()) {
        return;
      }
      completion = std::move(found->second);
      completions_.erase(found);
    }
    completion({
        static_cast<rabbyfs::SafeMediaDownloadCode>(code),
        static_cast<int32_t>(httpStatus),
        static_cast<uint64_t>(std::max<jlong>(0, bytesWritten)),
    });
  }

  static void registerNatives() {
    registerHybrid({
        makeNativeMethod("initHybrid", RabbyNativeFSAdapter::initHybrid),
        makeNativeMethod("nativeInstall", RabbyNativeFSAdapter::nativeInstall),
        makeNativeMethod(
            "nativeCompleteSafeMediaDownload",
            RabbyNativeFSAdapter::nativeCompleteSafeMediaDownload),
    });
  }

 private:
  void startSafeMediaDownload(
      rabbyfs::SafeMediaDownloadRequest request,
      rabbyfs::SafeMediaDownloadCompletion completion) {
    {
      std::lock_guard<std::mutex> lock(completionsMutex_);
      completions_.emplace(request.requestId, std::move(completion));
    }
    try {
      static const auto method = javaClassStatic()->getMethod<void(
          jlong,
          jni::alias_ref<jni::JString>,
          jni::alias_ref<jni::JString>,
          jlong,
          jint)>("startSafeMediaDownload");
      method(
          javaPart_,
          static_cast<jlong>(request.requestId),
          jni::make_jstring(request.url),
          jni::make_jstring(request.destinationPath),
          static_cast<jlong>(request.maxBytes),
          static_cast<jint>(request.timeoutMs));
    } catch (...) {
      std::lock_guard<std::mutex> lock(completionsMutex_);
      completions_.erase(request.requestId);
      throw;
    }
  }

  friend HybridBase;

  jni::global_ref<jhybridobject> javaPart_;
  std::mutex completionsMutex_;
  std::unordered_map<uint64_t, rabbyfs::SafeMediaDownloadCompletion>
      completions_;
};

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] { RabbyNativeFSAdapter::registerNatives(); });
}
