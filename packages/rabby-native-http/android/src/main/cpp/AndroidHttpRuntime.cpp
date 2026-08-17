#include "AndroidHttpClient.h"

#include <jni.h>

namespace {

void onPlatformResponse(
    JNIEnv* env,
    jclass,
    jlong requestId,
    jint statusCode,
    jstring finalUrl,
    jobjectArray headerNames,
    jobjectArray headerValues,
    jbyteArray body,
    jlong durationMs) {
  rabby::http::android::completeResponse(
      env,
      static_cast<std::uint64_t>(requestId),
      statusCode,
      finalUrl,
      headerNames,
      headerValues,
      body,
      durationMs);
}

void onPlatformFailure(
    JNIEnv* env,
    jclass,
    jlong requestId,
    jstring code,
    jstring message,
    jlong durationMs) {
  rabby::http::android::completeFailure(
      env,
      static_cast<std::uint64_t>(requestId),
      code,
      message,
      durationMs);
}

} // namespace

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  JNIEnv* env = nullptr;
  if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
    return JNI_ERR;
  }

  auto runtimeClass =
      env->FindClass("com/rabbywallet/nativehttp/RabbyNativeHttpRuntime");
  if (runtimeClass == nullptr || !rabby::http::android::initialize(vm, env)) {
    env->ExceptionClear();
    return JNI_ERR;
  }

  const JNINativeMethod methods[] = {
      {"onPlatformResponse",
       "(JILjava/lang/String;[Ljava/lang/String;[Ljava/lang/String;[BJ)V",
       reinterpret_cast<void*>(onPlatformResponse)},
      {"onPlatformFailure",
       "(JLjava/lang/String;Ljava/lang/String;J)V",
       reinterpret_cast<void*>(onPlatformFailure)},
  };

  const auto result = env->RegisterNatives(
      runtimeClass,
      methods,
      static_cast<jint>(sizeof(methods) / sizeof(methods[0])));
  env->DeleteLocalRef(runtimeClass);
  if (result != JNI_OK) {
    env->ExceptionClear();
    return JNI_ERR;
  }
  return JNI_VERSION_1_6;
}
