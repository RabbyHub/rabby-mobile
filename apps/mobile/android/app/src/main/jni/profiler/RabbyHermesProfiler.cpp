#include <hermes/hermes.h>
#include <jni.h>

extern "C" JNIEXPORT void JNICALL
Java_com_debank_rabbymobile_RabbyHermesProfiler_stopSamplingNative(
    JNIEnv* env, jclass) {
  try {
    // RN 0.81.6's prebuilt libhermestooling maps Java disable() to enable().
    // Use the same public Root API as the upstream fix, without a JSI runtime.
    // Remove this shim once the shipped RN AAR includes:
    // https://github.com/react/react-native/commit/7f2a58e46cdf0fd797aa58c6b0c8035913d34402
    auto* api = facebook::jsi::castInterface<facebook::hermes::IHermesRootAPI>(
        facebook::hermes::makeHermesRootAPI());
    if (!api) {
      env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),
                    "Hermes Root API is unavailable");
      return;
    }
    api->disableSamplingProfiler();
  } catch (...) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),
                  "Failed to stop Hermes sampling profiler");
  }
}
