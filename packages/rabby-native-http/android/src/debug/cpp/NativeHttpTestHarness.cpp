#include <rabby/http/RabbyHttpTypes.h>

#include <jni.h>

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>

namespace {

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

struct ProbeState {
  std::mutex mutex;
  std::condition_variable condition;
  std::unique_ptr<rabby::http::Result> result;
  std::size_t completionCount{0};
};

} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_rabbywallet_nativehttp_NativeHttpTestHarness_runProbe(
    JNIEnv* env,
    jclass,
    jstring url,
    jstring method,
    jbyteArray body,
    jlong timeoutMs,
    jlong maxResponseBytes,
    jboolean cancelImmediately) {
  rabby::http::Request request;
  request.url = fromJavaString(env, url);
  request.allowsInsecureHttp = true;
  request.timeoutMs = static_cast<std::int64_t>(timeoutMs);
  request.maxResponseBytes = static_cast<std::size_t>(maxResponseBytes);
  request.body = fromJavaBytes(env, body);
  if (!rabby::http::parseMethod(fromJavaString(env, method), request.method)) {
    return env->NewStringUTF("invalid_method");
  }

  auto state = std::make_shared<ProbeState>();
  auto handle = rabby::http::makePlatformClient()->execute(
      std::move(request),
      [state](rabby::http::Result result) {
        {
          std::lock_guard<std::mutex> lock(state->mutex);
          ++state->completionCount;
          if (state->result == nullptr) {
            state->result =
                std::make_unique<rabby::http::Result>(std::move(result));
          }
        }
        state->condition.notify_all();
      });
  if (cancelImmediately == JNI_TRUE) {
    handle->cancel();
    handle->cancel();
  }

  {
    std::unique_lock<std::mutex> lock(state->mutex);
    const auto waitFor = std::chrono::milliseconds(
        std::max<std::int64_t>(3000, request.timeoutMs + 1000));
    if (!state->condition.wait_for(lock, waitFor, [state] {
          return state->result != nullptr;
        })) {
      return env->NewStringUTF("wait_timeout");
    }
  }
  std::this_thread::sleep_for(std::chrono::milliseconds(100));

  std::ostringstream output;
  std::lock_guard<std::mutex> lock(state->mutex);
  if (state->result->isSuccess()) {
    const auto* response = state->result->response();
    output << "success|" << response->statusCode << '|'
           << response->body.size() << '|' << state->completionCount;
  } else {
    output << "error|"
           << rabby::http::errorCodeName(state->result->error()->code) << '|'
           << state->completionCount;
  }
  return env->NewStringUTF(output.str().c_str());
}
