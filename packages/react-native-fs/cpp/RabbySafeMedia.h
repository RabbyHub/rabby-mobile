#pragma once

#include <ReactCommon/CallInvoker.h>
#include <jsi/jsi.h>

#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace rabbyfs {

enum class SafeMediaDownloadCode : int32_t {
  Ok = 0,
  InvalidUrl = 1,
  HttpStatus = 2,
  TooLarge = 3,
  Timeout = 4,
  Io = 5,
  Network = 6,
  Cancelled = 7,
};

struct SafeMediaDownloadRequest {
  uint64_t requestId;
  std::string url;
  std::string destinationPath;
  uint64_t maxBytes;
  uint32_t timeoutMs;
};

struct SafeMediaDownloadResult {
  SafeMediaDownloadCode code;
  int32_t httpStatus;
  uint64_t bytesWritten;
};

using SafeMediaDownloadCompletion =
    std::function<void(SafeMediaDownloadResult)>;
using SafeMediaDownloadStarter = std::function<void(
    SafeMediaDownloadRequest,
    SafeMediaDownloadCompletion)>;

void installSafeMedia(
    facebook::jsi::Runtime& runtime,
    facebook::jsi::Object& nativeFs,
    std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker,
    std::string cacheDirectory,
    SafeMediaDownloadStarter downloadStarter);

} // namespace rabbyfs
