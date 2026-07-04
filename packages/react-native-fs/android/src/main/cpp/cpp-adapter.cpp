#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <ReactCommon/CallInvokerHolder.h>

#include "RabbyNativeFS.h"

using namespace facebook;

class RabbyNativeFSAdapter : public jni::HybridClass<RabbyNativeFSAdapter> {
 public:
  static constexpr auto kJavaDescriptor = "Lcom/rnfs/RNFSManager;";

  static jni::local_ref<jhybriddata> initHybrid(jni::alias_ref<jhybridobject>) {
    return makeCxxInstance();
  }

  void nativeInstall(
      jlong jsiPtr,
      jni::alias_ref<react::CallInvokerHolder::javaobject> jsCallInvokerHolder) {
    auto runtime = reinterpret_cast<jsi::Runtime*>(jsiPtr);
    if (runtime != nullptr) {
      rabbyfs::install(
          *runtime,
          jsCallInvokerHolder != nullptr
              ? jsCallInvokerHolder->cthis()->getCallInvoker()
              : nullptr);
    }
  }

  static void registerNatives() {
    registerHybrid({
        makeNativeMethod("initHybrid", RabbyNativeFSAdapter::initHybrid),
        makeNativeMethod("nativeInstall", RabbyNativeFSAdapter::nativeInstall),
    });
  }

 private:
  friend HybridBase;
};

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, [] { RabbyNativeFSAdapter::registerNatives(); });
}
