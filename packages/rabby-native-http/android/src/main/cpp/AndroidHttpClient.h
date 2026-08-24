#pragma once

#include <rabby/http/RabbyHttpTypes.h>

#include <jni.h>

#include <memory>

namespace rabby::http::android {

bool initialize(JavaVM* javaVm, JNIEnv* env);
std::shared_ptr<Client> makeClient();

void completeResponse(
    JNIEnv* env,
    std::uint64_t requestId,
    jint statusCode,
    jstring finalUrl,
    jobjectArray headerNames,
    jobjectArray headerValues,
    jbyteArray body,
    jlong durationMs);

void completeFailure(
    JNIEnv* env,
    std::uint64_t requestId,
    jstring code,
    jstring message,
    jlong durationMs);

} // namespace rabby::http::android
