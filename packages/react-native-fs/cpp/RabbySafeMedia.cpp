#include "RabbySafeMedia.h"

#include "../rust/safe-svg/include/rabby_safe_svg.h"

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <dirent.h>
#include <fcntl.h>
#include <mutex>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>
#include <unistd.h>

namespace rabbyfs {
namespace {

namespace jsi = facebook::jsi;
namespace react = facebook::react;

constexpr uint64_t kMaxSvgBytes = 5ULL * 1024ULL * 1024ULL;
constexpr uint32_t kDownloadTimeoutMs = 12'000;
constexpr uint64_t kMaxCacheBytes = 128ULL * 1024ULL * 1024ULL;
constexpr size_t kMaxCacheFiles = 2'048;
constexpr char kCacheVersion[] = "safe-svg-v1";

struct VariantPolicy {
  const char* name;
  uint32_t maxEdge;
  uint32_t maxPixels;
};

constexpr VariantPolicy kThumbnailPolicy{"thumbnail", 512, 1024 * 1024};
constexpr VariantPolicy kDetailPolicy{"detail", 2048, 4 * 1024 * 1024};

struct PromiseCallbacks {
  PromiseCallbacks(jsi::Function resolveValue, jsi::Function rejectValue)
      : resolve(std::move(resolveValue)), reject(std::move(rejectValue)) {}

  jsi::Function resolve;
  jsi::Function reject;
};

struct SafeMediaResult {
  bool ready;
  std::string reason;
  std::string path;
  uint32_t width;
  uint32_t height;
  bool cacheHit;
};

std::string errnoMessage(const char* operation, const std::string& path) {
  return std::string(operation) + " failed for " + path + ": " +
      std::strerror(errno);
}

bool directoryExists(const std::string& path) {
  struct stat info {};
  return lstat(path.c_str(), &info) == 0 && S_ISDIR(info.st_mode) &&
      !S_ISLNK(info.st_mode);
}

void ensureDirectory(const std::string& path) {
  if (mkdir(path.c_str(), 0700) == 0) {
    return;
  }
  if (errno == EEXIST && directoryExists(path)) {
    return;
  }
  throw std::runtime_error(errnoMessage("mkdir", path));
}

bool readPngDimensions(
    const std::string& path,
    uint32_t* width,
    uint32_t* height) {
  struct stat info {};
  if (lstat(path.c_str(), &info) != 0 || !S_ISREG(info.st_mode) ||
      S_ISLNK(info.st_mode) || info.st_size < 24) {
    return false;
  }

  const int fd = open(path.c_str(), O_RDONLY);
  if (fd == -1) {
    return false;
  }
  std::array<uint8_t, 24> header{};
  const ssize_t bytesRead = read(fd, header.data(), header.size());
  close(fd);
  constexpr std::array<uint8_t, 8> expected{
      0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
  if (bytesRead != static_cast<ssize_t>(header.size()) ||
      !std::equal(expected.begin(), expected.end(), header.begin()) ||
      std::memcmp(header.data() + 12, "IHDR", 4) != 0) {
    return false;
  }
  const auto readBigEndian = [&header](size_t offset) {
    return (static_cast<uint32_t>(header[offset]) << 24) |
        (static_cast<uint32_t>(header[offset + 1]) << 16) |
        (static_cast<uint32_t>(header[offset + 2]) << 8) |
        static_cast<uint32_t>(header[offset + 3]);
  };
  const uint32_t parsedWidth = readBigEndian(16);
  const uint32_t parsedHeight = readBigEndian(20);
  if (parsedWidth == 0 || parsedHeight == 0) {
    return false;
  }
  if (width) {
    *width = parsedWidth;
  }
  if (height) {
    *height = parsedHeight;
  }
  return true;
}

bool isRegularPng(const std::string& path) {
  return readPngDimensions(path, nullptr, nullptr);
}

std::string sha256Hex(const std::string& value) {
  std::array<char, 65> output{};
  const int32_t code = rabby_safe_svg_sha256(
      reinterpret_cast<const uint8_t*>(value.data()),
      value.size(),
      output.data(),
      output.size());
  if (code != RABBY_SAFE_SVG_OK) {
    throw std::runtime_error("safe media cache key generation failed");
  }
  return std::string(output.data(), 64);
}

std::string fileUri(const std::string& path) {
  return "file://" + path;
}

const VariantPolicy& requireVariant(
    jsi::Runtime& runtime,
    const jsi::Object& options) {
  if (!options.hasProperty(runtime, "variant")) {
    return kThumbnailPolicy;
  }
  const auto value = options.getProperty(runtime, "variant");
  if (!value.isString()) {
    throw jsi::JSError(runtime, "resolveSvg variant must be a string");
  }
  const auto variant = value.asString(runtime).utf8(runtime);
  if (variant == kThumbnailPolicy.name) {
    return kThumbnailPolicy;
  }
  if (variant == kDetailPolicy.name) {
    return kDetailPolicy;
  }
  throw jsi::JSError(runtime, "resolveSvg variant must be thumbnail or detail");
}

std::string requireUrl(jsi::Runtime& runtime, const jsi::Object& options) {
  if (!options.hasProperty(runtime, "url")) {
    throw jsi::JSError(runtime, "resolveSvg requires a url");
  }
  const auto value = options.getProperty(runtime, "url");
  if (!value.isString()) {
    throw jsi::JSError(runtime, "resolveSvg url must be a string");
  }
  auto url = value.asString(runtime).utf8(runtime);
  if (url.empty() || url.size() > 8 * 1024) {
    throw jsi::JSError(runtime, "resolveSvg url is invalid");
  }
  return url;
}

std::string downloadFailureReason(SafeMediaDownloadCode code) {
  switch (code) {
    case SafeMediaDownloadCode::InvalidUrl:
      return "invalid_url";
    case SafeMediaDownloadCode::HttpStatus:
      return "http_status";
    case SafeMediaDownloadCode::TooLarge:
      return "too_large";
    case SafeMediaDownloadCode::Timeout:
      return "timeout";
    case SafeMediaDownloadCode::Io:
      return "io_error";
    case SafeMediaDownloadCode::Cancelled:
      return "cancelled";
    case SafeMediaDownloadCode::Network:
    case SafeMediaDownloadCode::Ok:
      return "download_failed";
  }
  return "download_failed";
}

std::string renderFailureReason(int32_t code) {
  switch (code) {
    case RABBY_SAFE_SVG_INPUT_TOO_LARGE:
      return "too_large";
    case RABBY_SAFE_SVG_UNSAFE_CONTENT:
      return "unsafe_svg";
    case RABBY_SAFE_SVG_PARSE_FAILED:
    case RABBY_SAFE_SVG_INVALID_SIZE:
      return "invalid_svg";
    case RABBY_SAFE_SVG_PIXEL_LIMIT:
      return "pixel_limit";
    case RABBY_SAFE_SVG_UNSUPPORTED_CONTENT:
      return "unsupported_svg";
    default:
      return "render_failed";
  }
}

jsi::Object makeResultObject(jsi::Runtime& runtime, const SafeMediaResult& result) {
  jsi::Object object(runtime);
  object.setProperty(
      runtime,
      "status",
      jsi::String::createFromUtf8(runtime, result.ready ? "ready" : "failed"));
  if (result.ready) {
    object.setProperty(
        runtime, "uri", jsi::String::createFromUtf8(runtime, fileUri(result.path)));
    object.setProperty(runtime, "width", static_cast<double>(result.width));
    object.setProperty(runtime, "height", static_cast<double>(result.height));
    object.setProperty(runtime, "cacheHit", result.cacheHit);
  } else {
    object.setProperty(
        runtime,
        "reason",
        jsi::String::createFromUtf8(runtime, result.reason));
  }
  return object;
}

void resolveCallbacks(
    const std::shared_ptr<react::CallInvoker>& invoker,
    std::vector<std::shared_ptr<PromiseCallbacks>> callbacks,
    SafeMediaResult result) {
  invoker->invokeAsync(
      [callbacks = std::move(callbacks), result = std::move(result)](
          jsi::Runtime& runtime) mutable {
        for (auto& callback : callbacks) {
          auto object = makeResultObject(runtime, result);
          callback->resolve.call(runtime, jsi::Value(runtime, object));
        }
      });
}

class SafeMediaService final
    : public std::enable_shared_from_this<SafeMediaService> {
 public:
  SafeMediaService(
      std::shared_ptr<react::CallInvoker> invoker,
      std::string cacheDirectory,
      SafeMediaDownloadStarter downloadStarter)
      : invoker_(std::move(invoker)),
        downloadStarter_(std::move(downloadStarter)),
        cacheDirectory_(cacheDirectory + "/safe-media"),
        versionDirectory_(cacheDirectory_ + "/v1") {
    if (!invoker_ || !downloadStarter_ || cacheDirectory.empty()) {
      throw std::invalid_argument("safe media platform bindings are incomplete");
    }
    ensureDirectory(cacheDirectory_);
    ensureDirectory(versionDirectory_);
    removeOrphanedTemporaryFiles();
  }

  jsi::Object resolveSvg(
      jsi::Runtime& runtime,
      std::string url,
      const VariantPolicy& policy) {
    const std::string key = sha256Hex(
        std::string(kCacheVersion) + "\n" + policy.name + "\n" + url);
    const std::string targetPath = versionDirectory_ + "/" + key + ".png";
    auto promiseConstructor = runtime.global()
                                  .getPropertyAsFunction(runtime, "Promise");
    auto executor = jsi::Function::createFromHostFunction(
        runtime,
        jsi::PropNameID::forAscii(runtime, "resolveSvgExecutor"),
        2,
        [self = shared_from_this(),
         url = std::move(url),
         policy,
         key,
         targetPath](jsi::Runtime& runtime,
                     const jsi::Value&,
                     const jsi::Value* arguments,
                     size_t count) -> jsi::Value {
          if (count < 2 || !arguments[0].isObject() ||
              !arguments[1].isObject()) {
            throw jsi::JSError(
                runtime, "resolveSvg Promise executor is invalid");
          }
          auto callbacks = std::make_shared<PromiseCallbacks>(
              arguments[0].asObject(runtime).asFunction(runtime),
              arguments[1].asObject(runtime).asFunction(runtime));
          self->start(
              std::move(url), policy, key, targetPath, std::move(callbacks));
          return jsi::Value::undefined();
        });
    return promiseConstructor
        .callAsConstructor(runtime, std::move(executor))
        .asObject(runtime);
  }

  jsi::Object clearCache(jsi::Runtime& runtime) {
    auto promiseConstructor = runtime.global()
                                  .getPropertyAsFunction(runtime, "Promise");
    auto executor = jsi::Function::createFromHostFunction(
        runtime,
        jsi::PropNameID::forAscii(runtime, "clearSafeSvgCacheExecutor"),
        2,
        [self = shared_from_this()](jsi::Runtime& runtime,
                                    const jsi::Value&,
                                    const jsi::Value* arguments,
                                    size_t count) -> jsi::Value {
          if (count < 2 || !arguments[0].isObject() ||
              !arguments[1].isObject()) {
            throw jsi::JSError(
                runtime, "clearSafeSvgCache Promise executor is invalid");
          }
          auto callbacks = std::make_shared<PromiseCallbacks>(
              arguments[0].asObject(runtime).asFunction(runtime),
              arguments[1].asObject(runtime).asFunction(runtime));
          std::thread([self, callbacks = std::move(callbacks)] {
            self->removeCachedFiles();
            self->invoker_->invokeAsync(
                [callbacks](jsi::Runtime& runtime) {
                  callbacks->resolve.call(runtime, jsi::Value::undefined());
                });
          }).detach();
          return jsi::Value::undefined();
        });
    return promiseConstructor
        .callAsConstructor(runtime, std::move(executor))
        .asObject(runtime);
  }

 private:
  struct PendingJob {
    std::string inputPath;
    std::string outputPath;
    std::string targetPath;
    VariantPolicy policy;
    std::vector<std::shared_ptr<PromiseCallbacks>> callbacks;
  };

  void removeOrphanedTemporaryFiles() {
    DIR* directory = opendir(versionDirectory_.c_str());
    if (!directory) {
      return;
    }
    while (dirent* entry = readdir(directory)) {
      const std::string name(entry->d_name);
      if (name.empty() || name.front() != '.' || name.size() < 6 ||
          name.substr(name.size() - 5) != ".part") {
        continue;
      }
      const std::string path = versionDirectory_ + "/" + name;
      struct stat info {};
      if (lstat(path.c_str(), &info) == 0 && S_ISREG(info.st_mode) &&
          !S_ISLNK(info.st_mode)) {
        unlink(path.c_str());
      }
    }
    closedir(directory);
  }

  void start(
      std::string url,
      const VariantPolicy& policy,
      const std::string& key,
      const std::string& targetPath,
      std::shared_ptr<PromiseCallbacks> callbacks) {
    uint32_t cachedWidth = 0;
    uint32_t cachedHeight = 0;
    if (readPngDimensions(targetPath, &cachedWidth, &cachedHeight)) {
      resolveCallbacks(
          invoker_,
          {std::move(callbacks)},
          {true, "", targetPath, cachedWidth, cachedHeight, true});
      return;
    }

    uint64_t requestId = 0;
    std::string inputPath;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      auto pending = jobsByKey_.find(key);
      if (pending != jobsByKey_.end()) {
        pending->second.callbacks.push_back(std::move(callbacks));
        return;
      }

      requestId = nextRequestId_.fetch_add(1, std::memory_order_relaxed);
      inputPath = versionDirectory_ + "/." + key + "." +
          std::to_string(requestId) + ".svg.part";
      const std::string outputPath = versionDirectory_ + "/." + key + "." +
          std::to_string(requestId) + ".png.part";
      PendingJob job{
          inputPath, outputPath, targetPath, policy, {std::move(callbacks)}};
      jobsByKey_.emplace(key, std::move(job));
    }

    SafeMediaDownloadRequest request{
        requestId, std::move(url), inputPath, kMaxSvgBytes, kDownloadTimeoutMs};
    std::weak_ptr<SafeMediaService> weakSelf = shared_from_this();
    try {
      downloadStarter_(
          std::move(request),
          [weakSelf, key](SafeMediaDownloadResult result) {
            if (auto self = weakSelf.lock()) {
              self->downloadCompleted(key, result);
            }
          });
    } catch (...) {
      finish(key, {false, "download_failed", "", 0, 0, false});
    }
  }

  void downloadCompleted(
      std::string key,
      SafeMediaDownloadResult downloadResult) {
    if (downloadResult.code != SafeMediaDownloadCode::Ok) {
      finish(
          key,
          {false,
           downloadFailureReason(downloadResult.code),
           "",
           0,
           0,
           false});
      return;
    }

    // Platform downloaders already execute completions on bounded native
    // worker queues. Keep rasterization on that queue so a large NFT grid
    // cannot turn a burst of completed downloads into an unbounded number of
    // detached render threads. No work in this path runs on the JS thread.
    render(key);
  }

  void render(const std::string& key) {
    PendingJob snapshot;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto found = jobsByKey_.find(key);
      if (found == jobsByKey_.end()) {
        return;
      }
      snapshot = found->second;
    }

    const RabbySafeSvgRenderResult rendered = rabby_safe_svg_render_file(
        snapshot.inputPath.c_str(),
        snapshot.outputPath.c_str(),
        snapshot.policy.maxEdge,
        snapshot.policy.maxPixels);
    unlink(snapshot.inputPath.c_str());
    if (rendered.code != RABBY_SAFE_SVG_OK) {
      unlink(snapshot.outputPath.c_str());
      finish(
          key,
          {false, renderFailureReason(rendered.code), "", 0, 0, false});
      return;
    }
    if (!isRegularPng(snapshot.outputPath) ||
        rename(snapshot.outputPath.c_str(), snapshot.targetPath.c_str()) != 0) {
      unlink(snapshot.outputPath.c_str());
      finish(key, {false, "cache_write_failed", "", 0, 0, false});
      return;
    }

    finish(
        key,
        {true,
         "",
         snapshot.targetPath,
         rendered.width,
         rendered.height,
         false});
    pruneCache();
  }

  void finish(const std::string& key, SafeMediaResult result) {
    std::vector<std::shared_ptr<PromiseCallbacks>> callbacks;
    std::string inputPath;
    std::string outputPath;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto found = jobsByKey_.find(key);
      if (found == jobsByKey_.end()) {
        return;
      }
      inputPath = found->second.inputPath;
      outputPath = found->second.outputPath;
      callbacks = std::move(found->second.callbacks);
      jobsByKey_.erase(found);
    }
    unlink(inputPath.c_str());
    unlink(outputPath.c_str());
    resolveCallbacks(invoker_, std::move(callbacks), std::move(result));
  }

  void removeCachedFiles() {
    DIR* directory = opendir(versionDirectory_.c_str());
    if (!directory) {
      return;
    }
    while (dirent* entry = readdir(directory)) {
      const std::string name(entry->d_name);
      if (name.size() != 68 || name.substr(name.size() - 4) != ".png") {
        continue;
      }
      const std::string path = versionDirectory_ + "/" + name;
      struct stat info {};
      if (lstat(path.c_str(), &info) == 0 && S_ISREG(info.st_mode) &&
          !S_ISLNK(info.st_mode)) {
        unlink(path.c_str());
      }
    }
    closedir(directory);
  }

  void pruneCache() {
    struct CacheFile {
      std::string path;
      uint64_t size;
      time_t modifiedAt;
    };
    std::vector<CacheFile> files;
    uint64_t totalBytes = 0;
    DIR* directory = opendir(versionDirectory_.c_str());
    if (!directory) {
      return;
    }
    while (dirent* entry = readdir(directory)) {
      const std::string name(entry->d_name);
      if (name.size() != 68 || name.substr(name.size() - 4) != ".png") {
        continue;
      }
      const std::string path = versionDirectory_ + "/" + name;
      struct stat info {};
      if (lstat(path.c_str(), &info) == 0 && S_ISREG(info.st_mode) &&
          !S_ISLNK(info.st_mode)) {
        const uint64_t size = static_cast<uint64_t>(info.st_size);
        totalBytes += size;
        files.push_back({path, size, info.st_mtime});
      }
    }
    closedir(directory);
    if (totalBytes <= kMaxCacheBytes && files.size() <= kMaxCacheFiles) {
      return;
    }
    std::sort(
        files.begin(), files.end(), [](const CacheFile& left, const CacheFile& right) {
          return left.modifiedAt < right.modifiedAt;
        });
    size_t remainingFiles = files.size();
    for (const auto& file : files) {
      if (totalBytes <= kMaxCacheBytes && remainingFiles <= kMaxCacheFiles) {
        break;
      }
      if (unlink(file.path.c_str()) == 0) {
        totalBytes -= file.size;
        remainingFiles -= 1;
      }
    }
  }

  std::shared_ptr<react::CallInvoker> invoker_;
  SafeMediaDownloadStarter downloadStarter_;
  std::string cacheDirectory_;
  std::string versionDirectory_;
  std::mutex mutex_;
  std::unordered_map<std::string, PendingJob> jobsByKey_;
  std::atomic<uint64_t> nextRequestId_{1};
};

} // namespace

void installSafeMedia(
    jsi::Runtime& runtime,
    jsi::Object& nativeFs,
    std::shared_ptr<react::CallInvoker> jsCallInvoker,
    std::string cacheDirectory,
    SafeMediaDownloadStarter downloadStarter) {
  if (!jsCallInvoker || cacheDirectory.empty() || !downloadStarter) {
    return;
  }
  auto service = std::make_shared<SafeMediaService>(
      std::move(jsCallInvoker),
      std::move(cacheDirectory),
      std::move(downloadStarter));

  nativeFs.setProperty(
      runtime,
      "resolveSvg",
      jsi::Function::createFromHostFunction(
          runtime,
          jsi::PropNameID::forAscii(runtime, "resolveSvg"),
          1,
          [service](jsi::Runtime& runtime,
                    const jsi::Value&,
                    const jsi::Value* arguments,
                    size_t count) -> jsi::Value {
            if (count < 1 || !arguments[0].isObject()) {
              throw jsi::JSError(runtime, "resolveSvg expects an options object");
            }
            const auto options = arguments[0].asObject(runtime);
            auto url = requireUrl(runtime, options);
            const auto policy = requireVariant(runtime, options);
            return jsi::Value(
                runtime, service->resolveSvg(runtime, std::move(url), policy));
          }));

  nativeFs.setProperty(
      runtime,
      "clearSafeSvgCache",
      jsi::Function::createFromHostFunction(
          runtime,
          jsi::PropNameID::forAscii(runtime, "clearSafeSvgCache"),
          0,
          [service](jsi::Runtime& runtime,
                    const jsi::Value&,
                    const jsi::Value*,
                    size_t) -> jsi::Value {
            return jsi::Value(runtime, service->clearCache(runtime));
          }));
}

} // namespace rabbyfs
