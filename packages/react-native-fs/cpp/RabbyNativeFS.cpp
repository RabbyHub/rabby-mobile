#include "RabbyNativeFS.h"

#include <algorithm>
#include <cerrno>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstring>
#include <fcntl.h>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <thread>
#include <unistd.h>
#include <utility>
#include <vector>

#include <ReactCommon/CallInvoker.h>

#ifdef __ANDROID__
#include <android/log.h>
#include <sys/syscall.h>
#endif

namespace jsi = facebook::jsi;
namespace react = facebook::react;

namespace rabbyfs {
namespace {

using SteadyClock = std::chrono::steady_clock;

struct DiagnosticEvent {
  uint64_t id;
  std::string category;
  std::string operation;
  std::string pathTail;
  size_t bytes;
  int64_t durationUs;
  long tid;
  bool isError;
  std::string message;
};

std::mutex diagnosticMutex;
std::deque<DiagnosticEvent> diagnosticEvents;
uint64_t nextDiagnosticEventId = 1;

constexpr size_t kMaxDiagnosticEvents = 256;

class VectorBuffer final : public jsi::MutableBuffer {
 public:
  explicit VectorBuffer(std::vector<uint8_t>&& data) : data_(std::move(data)) {}
  explicit VectorBuffer(size_t size) : data_(size) {}

  size_t size() const override {
    return data_.size();
  }

  uint8_t* data() override {
    return data_.data();
  }

 private:
  std::vector<uint8_t> data_;
};

std::string errnoMessage(const std::string& operation, const std::string& path) {
  return operation + " '" + path + "' failed: " + std::strerror(errno);
}

int64_t durationUsSince(SteadyClock::time_point startedAt) {
  return std::chrono::duration_cast<std::chrono::microseconds>(
             SteadyClock::now() - startedAt)
      .count();
}

std::string pathTail(const std::string& path) {
  constexpr size_t maxLength = 96;
  if (path.size() <= maxLength) {
    return path;
  }
  return "..." + path.substr(path.size() - maxLength);
}

#ifdef __ANDROID__
long currentTidForLog() {
  return static_cast<long>(syscall(SYS_gettid));
}
#else
long currentTidForLog() {
  return 0;
}
#endif

void recordDiagnosticEvent(
    const char* category,
    const char* operation,
    const std::string& path,
    size_t bytes,
    int64_t durationUs,
    bool isError,
    std::string message) {
  std::lock_guard<std::mutex> lock(diagnosticMutex);
  diagnosticEvents.push_back(DiagnosticEvent{
      nextDiagnosticEventId++,
      category,
      operation,
      pathTail(path),
      bytes,
      durationUs,
      currentTidForLog(),
      isError,
      std::move(message)});
  while (diagnosticEvents.size() > kMaxDiagnosticEvents) {
    diagnosticEvents.pop_front();
  }
}

void logNativeFsInfo(
    const char* category,
    const char* operation,
    const std::string& path,
    size_t bytes,
    int64_t durationUs) {
  recordDiagnosticEvent(category, operation, path, bytes, durationUs, false, "");
#ifdef __ANDROID__
  __android_log_print(
      ANDROID_LOG_INFO,
      "RabbyNativeFS",
      "[%s] op=%s bytes=%zu duration_us=%lld tid=%ld path_tail=%s",
      category,
      operation,
      bytes,
      static_cast<long long>(durationUs),
      currentTidForLog(),
      pathTail(path).c_str());
#endif
}

void logNativeFsError(
    const char* operation,
    const std::string& path,
    const char* message) {
  recordDiagnosticEvent("io-error", operation, path, 0, 0, true, message);
#ifdef __ANDROID__
  __android_log_print(
      ANDROID_LOG_WARN,
      "RabbyNativeFS",
      "[io-error] op=%s tid=%ld path_tail=%s error=%s",
      operation,
      currentTidForLog(),
      pathTail(path).c_str(),
      message);
#endif
}

void logNativeFsOwnedClose(
    uint64_t writerId,
    const std::string& path,
    size_t bytes,
    size_t commits,
    int64_t durationUs) {
  recordDiagnosticEvent(
      "owned-write",
      "closeWriteStream",
      path,
      bytes,
      durationUs,
      false,
      "commits=" + std::to_string(commits) + ";writer_id=" + std::to_string(writerId));
#ifdef __ANDROID__
  __android_log_print(
      ANDROID_LOG_INFO,
      "RabbyNativeFS",
      "[owned-write] writer_id=%llu bytes=%zu commits=%zu close_duration_us=%lld tid=%ld path_tail=%s",
      static_cast<unsigned long long>(writerId),
      bytes,
      commits,
      static_cast<long long>(durationUs),
      currentTidForLog(),
      pathTail(path).c_str());
#endif
}

void logNativeFsInstall() {
  recordDiagnosticEvent("install", "install", "", 0, 0, false, "");
#ifdef __ANDROID__
  __android_log_print(
      ANDROID_LOG_INFO,
      "RabbyNativeFS",
      "[install] tid=%ld",
      currentTidForLog());
#endif
}

std::string requirePath(jsi::Runtime& runtime, const jsi::Value* arguments, size_t count) {
  if (count < 1 || !arguments[0].isString()) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a file path string");
  }

  std::string path = arguments[0].asString(runtime).utf8(runtime);
  static const std::string fileScheme = "file://";
  if (path.rfind(fileScheme, 0) == 0) {
    path = path.substr(fileScheme.size());
  }

  if (path.empty()) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a non-empty file path");
  }

  if (path.find("://") != std::string::npos) {
    throw jsi::JSError(runtime, "RabbyNativeFS JSI API only supports normal file paths");
  }

  return path;
}

int requireInt(jsi::Runtime& runtime, const jsi::Value& value, int fallback) {
  if (value.isUndefined() || value.isNull()) {
    return fallback;
  }
  if (!value.isNumber()) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a number");
  }
  return static_cast<int>(value.asNumber());
}

int64_t requireInt64(jsi::Runtime& runtime, const jsi::Value& value, int64_t fallback) {
  if (value.isUndefined() || value.isNull()) {
    return fallback;
  }
  if (!value.isNumber()) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a number");
  }
  return static_cast<int64_t>(value.asNumber());
}

jsi::Function requireGlobalFunction(jsi::Runtime& runtime, const char* name) {
  auto value = runtime.global().getProperty(runtime, name);
  if (!value.isObject() || !value.asObject(runtime).isFunction(runtime)) {
    throw jsi::JSError(runtime, std::string("RabbyNativeFS could not find global ") + name);
  }
  return value.asObject(runtime).asFunction(runtime);
}

jsi::Object makeUint8Array(jsi::Runtime& runtime, std::vector<uint8_t>&& bytes) {
  auto buffer = jsi::ArrayBuffer(runtime, std::make_shared<VectorBuffer>(std::move(bytes)));
  auto uint8ArrayConstructor = requireGlobalFunction(runtime, "Uint8Array");
  return uint8ArrayConstructor.callAsConstructor(runtime, std::move(buffer)).asObject(runtime);
}

bool isArrayBufferView(jsi::Runtime& runtime, const jsi::Object& object) {
  auto arrayBuffer = runtime.global().getProperty(runtime, "ArrayBuffer");
  if (!arrayBuffer.isObject()) {
    return false;
  }
  auto isView = arrayBuffer.asObject(runtime).getProperty(runtime, "isView");
  if (!isView.isObject() || !isView.asObject(runtime).isFunction(runtime)) {
    return false;
  }
  auto result = isView.asObject(runtime)
                    .asFunction(runtime)
                    .callWithThis(runtime, arrayBuffer.asObject(runtime), jsi::Value(runtime, object));
  return result.isBool() && result.getBool();
}

struct ByteSpan {
  jsi::ArrayBuffer buffer;
  size_t byteOffset;
  size_t byteLength;
};

ByteSpan requireBytes(jsi::Runtime& runtime, const jsi::Value& value) {
  if (!value.isObject()) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a Uint8Array or ArrayBuffer");
  }

  auto object = value.asObject(runtime);
  if (object.isArrayBuffer(runtime)) {
    auto buffer = object.getArrayBuffer(runtime);
    auto byteLength = buffer.size(runtime);
    return ByteSpan{std::move(buffer), 0, byteLength};
  }

  if (!isArrayBufferView(runtime, object)) {
    throw jsi::JSError(runtime, "RabbyNativeFS expected a Uint8Array or ArrayBuffer");
  }

  auto bufferValue = object.getProperty(runtime, "buffer");
  if (!bufferValue.isObject() || !bufferValue.asObject(runtime).isArrayBuffer(runtime)) {
    throw jsi::JSError(runtime, "RabbyNativeFS typed array has no ArrayBuffer");
  }

  auto buffer = bufferValue.asObject(runtime).getArrayBuffer(runtime);
  auto byteOffsetValue = object.getProperty(runtime, "byteOffset");
  auto byteLengthValue = object.getProperty(runtime, "byteLength");
  if (!byteOffsetValue.isNumber() || !byteLengthValue.isNumber()) {
    throw jsi::JSError(runtime, "RabbyNativeFS typed array has invalid byte range");
  }

  auto byteOffset = static_cast<size_t>(byteOffsetValue.asNumber());
  auto byteLength = static_cast<size_t>(byteLengthValue.asNumber());
  if (byteOffset + byteLength > buffer.size(runtime)) {
    throw jsi::JSError(runtime, "RabbyNativeFS typed array byte range is out of bounds");
  }

  return ByteSpan{std::move(buffer), byteOffset, byteLength};
}

std::vector<uint8_t> readBytesFromFile(
    const std::string& path,
    int64_t requestedLength,
    int64_t position) {
  int fd = open(path.c_str(), O_RDONLY);
  if (fd == -1) {
    throw std::runtime_error(errnoMessage("open", path));
  }

  struct stat fileStat {};
  if (fstat(fd, &fileStat) == -1) {
    int savedErrno = errno;
    close(fd);
    errno = savedErrno;
    throw std::runtime_error(errnoMessage("stat", path));
  }

  if (S_ISDIR(fileStat.st_mode)) {
    close(fd);
    throw std::runtime_error("EISDIR: illegal operation on a directory, read '" + path + "'");
  }

  int64_t fileSize = static_cast<int64_t>(fileStat.st_size);
  if (position < 0) {
    close(fd);
    throw std::runtime_error("RabbyNativeFS read position must be >= 0");
  }
  if (position > fileSize) {
    close(fd);
    return {};
  }

  int64_t available = fileSize - position;
  int64_t bytesToRead = requestedLength <= 0 ? available : std::min<int64_t>(requestedLength, available);
  if (bytesToRead < 0) {
    close(fd);
    throw std::runtime_error("RabbyNativeFS read length must be >= 0");
  }

  std::vector<uint8_t> bytes(static_cast<size_t>(bytesToRead));
  size_t totalRead = 0;
  while (totalRead < bytes.size()) {
    ssize_t readCount = pread(
        fd,
        bytes.data() + totalRead,
        bytes.size() - totalRead,
        static_cast<off_t>(position + totalRead));
    if (readCount == -1) {
      if (errno == EINTR) {
        continue;
      }
      int savedErrno = errno;
      close(fd);
      errno = savedErrno;
      throw std::runtime_error(errnoMessage("read", path));
    }
    if (readCount == 0) {
      break;
    }
    totalRead += static_cast<size_t>(readCount);
  }

  close(fd);
  if (totalRead != bytes.size()) {
    bytes.resize(totalRead);
  }
  return bytes;
}

void writeAllToFd(
    int fd,
    const uint8_t* data,
    size_t length,
    const std::string& path) {
  size_t totalWritten = 0;
  while (totalWritten < length) {
    ssize_t writeCount = write(fd, data + totalWritten, length - totalWritten);
    if (writeCount == -1) {
      if (errno == EINTR) {
        continue;
      }
      throw std::runtime_error(errnoMessage("write", path));
    }
    if (writeCount == 0) {
      throw std::runtime_error("write '" + path + "' failed: wrote zero bytes");
    }
    totalWritten += static_cast<size_t>(writeCount);
  }
}

void writeBytesToFile(
    const std::string& path,
    const uint8_t* data,
    size_t length,
    bool append,
    int64_t position) {
  int flags = O_WRONLY | O_CREAT;
  if (append || position < 0) {
    flags |= O_APPEND;
  } else if (position == 0) {
    flags |= O_TRUNC;
  }

  int fd = open(path.c_str(), flags, 0666);
  if (fd == -1) {
    throw std::runtime_error(errnoMessage("open", path));
  }

  size_t totalWritten = 0;
  while (totalWritten < length) {
    ssize_t writeCount;
    if (append || position < 0) {
      writeCount = write(fd, data + totalWritten, length - totalWritten);
    } else {
      writeCount = pwrite(
          fd,
          data + totalWritten,
          length - totalWritten,
          static_cast<off_t>(position + totalWritten));
    }

    if (writeCount == -1) {
      if (errno == EINTR) {
        continue;
      }
      int savedErrno = errno;
      close(fd);
      errno = savedErrno;
      throw std::runtime_error(errnoMessage("write", path));
    }
    if (writeCount == 0) {
      close(fd);
      throw std::runtime_error("write '" + path + "' failed: wrote zero bytes");
    }
    totalWritten += static_cast<size_t>(writeCount);
  }

  close(fd);
}

size_t requirePositiveSize(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    size_t fallback,
    const char* name) {
  if (value.isUndefined() || value.isNull()) {
    return fallback;
  }
  if (!value.isNumber()) {
    throw jsi::JSError(runtime, std::string("RabbyNativeFS expected ") + name + " to be a number");
  }
  double number = value.asNumber();
  if (number <= 0) {
    throw jsi::JSError(runtime, std::string("RabbyNativeFS expected ") + name + " to be > 0");
  }
  return static_cast<size_t>(number);
}

uint64_t nextOwnedWriterId() {
  static uint64_t nextId = 1;
  return nextId++;
}

uint64_t requireTokenNumber(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* name) {
  auto value = object.getProperty(runtime, name);
  if (!value.isNumber()) {
    throw jsi::JSError(runtime, std::string("RabbyNativeFS owned buffer is missing token ") + name);
  }
  return static_cast<uint64_t>(value.asNumber());
}

jsi::Value wrapHostFunction(
    jsi::Runtime& runtime,
    const char* name,
    unsigned int argCount,
    jsi::HostFunctionType function);

struct PromiseCallbacks {
  PromiseCallbacks(jsi::Function&& resolveFn, jsi::Function&& rejectFn)
      : resolve(std::move(resolveFn)), reject(std::move(rejectFn)) {}

  jsi::Function resolve;
  jsi::Function reject;
};

struct WriteStreamStatsSnapshot {
  uint64_t writerId;
  std::string path;
  size_t bufferSize;
  size_t bufferCount;
  size_t freeBuffers;
  size_t acquiredBuffers;
  size_t pendingBuffers;
  size_t bytesWritten;
  size_t commits;
  bool closed;
};

struct ReadStreamStatsSnapshot {
  uint64_t readerId;
  std::string path;
  size_t bufferSize;
  size_t bytesRead;
  size_t reads;
  bool closed;
  bool eof;
};

using PromiseStart = std::function<void(std::shared_ptr<PromiseCallbacks>)>;

jsi::Object makePromise(
    jsi::Runtime& runtime,
    const char* name,
    PromiseStart start) {
  auto promiseConstructor = requireGlobalFunction(runtime, "Promise");
  auto executor = jsi::Function::createFromHostFunction(
      runtime,
      jsi::PropNameID::forAscii(runtime, name),
      2,
      [start = std::move(start)](jsi::Runtime& runtime,
                                 const jsi::Value&,
                                 const jsi::Value* arguments,
                                 size_t count) -> jsi::Value {
        if (count < 2 || !arguments[0].isObject() || !arguments[1].isObject()) {
          throw jsi::JSError(runtime, "RabbyNativeFS Promise executor expected resolve and reject");
        }

        auto resolve = arguments[0].asObject(runtime).asFunction(runtime);
        auto reject = arguments[1].asObject(runtime).asFunction(runtime);
        try {
          start(std::make_shared<PromiseCallbacks>(
              std::move(resolve),
              std::move(reject)));
        } catch (const jsi::JSError&) {
          throw;
        } catch (const std::exception& error) {
          throw jsi::JSError(runtime, error.what());
        }
        return jsi::Value::undefined();
      });

  return promiseConstructor.callAsConstructor(runtime, std::move(executor)).asObject(runtime);
}

void resolvePromiseNumber(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks,
    double value) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks), value](jsi::Runtime& runtime) {
        callbacks->resolve.call(runtime, jsi::Value(value));
      });
}

void resolvePromiseNull(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks)](jsi::Runtime& runtime) {
        callbacks->resolve.call(runtime, jsi::Value::null());
      });
}

void resolvePromiseBytes(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks,
    std::vector<uint8_t>&& bytes) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks),
       bytes = std::move(bytes)](jsi::Runtime& runtime) mutable {
        auto result = makeUint8Array(runtime, std::move(bytes));
        callbacks->resolve.call(runtime, jsi::Value(runtime, result));
      });
}

void rejectPromise(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks,
    std::string message) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks),
       message = std::move(message)](jsi::Runtime& runtime) {
        callbacks->reject.call(
            runtime,
            jsi::String::createFromUtf8(runtime, message));
      });
}

jsi::Object makeWriteStreamStatsObject(
    jsi::Runtime& runtime,
    const WriteStreamStatsSnapshot& snapshot) {
  jsi::Object result(runtime);
  result.setProperty(runtime, "writerId", static_cast<double>(snapshot.writerId));
  result.setProperty(runtime, "path", jsi::String::createFromUtf8(runtime, snapshot.path));
  result.setProperty(runtime, "bufferSize", static_cast<double>(snapshot.bufferSize));
  result.setProperty(runtime, "bufferCount", static_cast<double>(snapshot.bufferCount));
  result.setProperty(runtime, "freeBuffers", static_cast<double>(snapshot.freeBuffers));
  result.setProperty(runtime, "acquiredBuffers", static_cast<double>(snapshot.acquiredBuffers));
  result.setProperty(runtime, "pendingBuffers", static_cast<double>(snapshot.pendingBuffers));
  result.setProperty(runtime, "bytesWritten", static_cast<double>(snapshot.bytesWritten));
  result.setProperty(runtime, "commits", static_cast<double>(snapshot.commits));
  result.setProperty(runtime, "closed", snapshot.closed);
  return result;
}

void resolvePromiseWriteStats(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks,
    WriteStreamStatsSnapshot snapshot) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks),
       snapshot = std::move(snapshot)](jsi::Runtime& runtime) {
        auto result = makeWriteStreamStatsObject(runtime, snapshot);
        callbacks->resolve.call(runtime, jsi::Value(runtime, result));
      });
}

jsi::Object makeReadStreamStatsObject(
    jsi::Runtime& runtime,
    const ReadStreamStatsSnapshot& snapshot) {
  jsi::Object result(runtime);
  result.setProperty(runtime, "readerId", static_cast<double>(snapshot.readerId));
  result.setProperty(runtime, "path", jsi::String::createFromUtf8(runtime, snapshot.path));
  result.setProperty(runtime, "bufferSize", static_cast<double>(snapshot.bufferSize));
  result.setProperty(runtime, "bytesRead", static_cast<double>(snapshot.bytesRead));
  result.setProperty(runtime, "reads", static_cast<double>(snapshot.reads));
  result.setProperty(runtime, "closed", snapshot.closed);
  result.setProperty(runtime, "eof", snapshot.eof);
  return result;
}

void resolvePromiseReadStats(
    const std::shared_ptr<react::CallInvoker>& jsCallInvoker,
    std::shared_ptr<PromiseCallbacks> callbacks,
    ReadStreamStatsSnapshot snapshot) {
  jsCallInvoker->invokeAsync(
      [callbacks = std::move(callbacks),
       snapshot = std::move(snapshot)](jsi::Runtime& runtime) {
        auto result = makeReadStreamStatsObject(runtime, snapshot);
        callbacks->resolve.call(runtime, jsi::Value(runtime, result));
      });
}

class OwnedWriteStreamHostObject final : public jsi::HostObject {
 public:
  OwnedWriteStreamHostObject(
      std::string path,
      size_t bufferSize,
      size_t bufferCount)
      : path_(std::move(path)),
        bufferSize_(bufferSize),
        writerId_(nextOwnedWriterId()) {
    fd_ = open(path_.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0666);
    if (fd_ == -1) {
      throw std::runtime_error(errnoMessage("open", path_));
    }

    slots_.reserve(bufferCount);
    for (size_t index = 0; index < bufferCount; index += 1) {
      slots_.push_back(Slot{std::make_shared<VectorBuffer>(bufferSize_)});
    }
  }

  ~OwnedWriteStreamHostObject() override {
    closeFd();
  }

  jsi::Value get(jsi::Runtime& runtime, const jsi::PropNameID& name) override {
    auto property = name.utf8(runtime);
    if (property == "acquireBuffer") {
      return wrapHostFunction(
          runtime,
          "acquireBuffer",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, acquireBuffer(runtime));
          });
    }
    if (property == "commit") {
      return wrapHostFunction(
          runtime,
          "commit",
          2,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value* arguments,
                 size_t count) -> jsi::Value {
            return jsi::Value(static_cast<double>(commit(runtime, arguments, count)));
          });
    }
    if (property == "close") {
      return wrapHostFunction(
          runtime,
          "close",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            close(runtime);
            return jsi::Value::undefined();
          });
    }
    if (property == "stats") {
      return wrapHostFunction(
          runtime,
          "stats",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, stats(runtime));
          });
    }
    return jsi::Value::undefined();
  }

  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& runtime) override {
    std::vector<jsi::PropNameID> names;
    names.reserve(4);
    names.push_back(jsi::PropNameID::forAscii(runtime, "acquireBuffer"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "commit"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "close"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "stats"));
    return names;
  }

 private:
  enum class SlotState {
    Free,
    Acquired,
  };

  struct Slot {
    std::shared_ptr<VectorBuffer> buffer;
    SlotState state = SlotState::Free;
    uint64_t generation = 0;
  };

  void ensureOpen(jsi::Runtime& runtime) const {
    if (closed_ || fd_ == -1) {
      throw jsi::JSError(runtime, "RabbyNativeFS owned write stream is closed");
    }
  }

  jsi::Object acquireBuffer(jsi::Runtime& runtime) {
    ensureOpen(runtime);

    for (size_t index = 0; index < slots_.size(); index += 1) {
      auto& slot = slots_[index];
      if (slot.state != SlotState::Free) {
        continue;
      }

      slot.state = SlotState::Acquired;
      slot.generation += 1;

      auto arrayBuffer = jsi::ArrayBuffer(runtime, slot.buffer);
      auto uint8ArrayConstructor = requireGlobalFunction(runtime, "Uint8Array");
      auto uint8Array = uint8ArrayConstructor.callAsConstructor(runtime, std::move(arrayBuffer)).asObject(runtime);
      uint8Array.setExternalMemoryPressure(runtime, slot.buffer->size());
      uint8Array.setProperty(runtime, "__rabbyNativeFSWriterId", static_cast<double>(writerId_));
      uint8Array.setProperty(runtime, "__rabbyNativeFSSlot", static_cast<double>(index));
      uint8Array.setProperty(runtime, "__rabbyNativeFSGeneration", static_cast<double>(slot.generation));
      return uint8Array;
    }

    throw jsi::JSError(runtime, "RabbyNativeFS owned write stream has no free buffer");
  }

  size_t commit(
      jsi::Runtime& runtime,
      const jsi::Value* arguments,
      size_t count) {
    ensureOpen(runtime);
    if (count < 1 || !arguments[0].isObject()) {
      throw jsi::JSError(runtime, "RabbyNativeFS commit expects an owned Uint8Array");
    }

    auto object = arguments[0].asObject(runtime);
    auto writerId = requireTokenNumber(runtime, object, "__rabbyNativeFSWriterId");
    auto slotIndex = requireTokenNumber(runtime, object, "__rabbyNativeFSSlot");
    auto generation = requireTokenNumber(runtime, object, "__rabbyNativeFSGeneration");

    if (writerId != writerId_) {
      throw jsi::JSError(runtime, "RabbyNativeFS owned buffer belongs to another writer");
    }
    if (slotIndex >= slots_.size()) {
      throw jsi::JSError(runtime, "RabbyNativeFS owned buffer slot is out of range");
    }

    auto& slot = slots_[static_cast<size_t>(slotIndex)];
    if (slot.state != SlotState::Acquired || slot.generation != generation) {
      throw jsi::JSError(runtime, "RabbyNativeFS owned buffer is not currently acquired");
    }

    auto bytes = requireBytes(runtime, arguments[0]);
    if (bytes.byteOffset != 0) {
      throw jsi::JSError(runtime, "RabbyNativeFS commit expects the original acquired buffer, not a subarray");
    }
    if (bytes.buffer.data(runtime) != slot.buffer->data()) {
      throw jsi::JSError(runtime, "RabbyNativeFS owned buffer storage mismatch");
    }

    size_t byteLength = bytes.byteLength;
    if (count > 1 && !arguments[1].isUndefined() && !arguments[1].isNull()) {
      if (!arguments[1].isNumber()) {
        throw jsi::JSError(runtime, "RabbyNativeFS commit length must be a number");
      }
      auto length = arguments[1].asNumber();
      if (length < 0) {
        throw jsi::JSError(runtime, "RabbyNativeFS commit length must be >= 0");
      }
      byteLength = static_cast<size_t>(length);
    }
    if (byteLength > bytes.byteLength || byteLength > slot.buffer->size()) {
      throw jsi::JSError(runtime, "RabbyNativeFS commit length exceeds the acquired buffer");
    }

    try {
      writeAllToFd(fd_, slot.buffer->data(), byteLength, path_);
    } catch (const std::exception& error) {
      throw jsi::JSError(runtime, error.what());
    }

    slot.state = SlotState::Free;
    bytesWritten_ += byteLength;
    commits_ += 1;
    return bytesWritten_;
  }

  void close(jsi::Runtime& runtime) {
    if (closed_) {
      return;
    }
    for (const auto& slot : slots_) {
      if (slot.state == SlotState::Acquired) {
        throw jsi::JSError(runtime, "RabbyNativeFS cannot close an owned write stream with acquired buffers");
      }
    }
    auto startedAt = SteadyClock::now();
    if (closeFd() == -1) {
      throw jsi::JSError(runtime, errnoMessage("close", path_));
    }
    closed_ = true;
    logNativeFsOwnedClose(
        writerId_,
        path_,
        bytesWritten_,
        commits_,
        durationUsSince(startedAt));
  }

  jsi::Object stats(jsi::Runtime& runtime) const {
    size_t freeBuffers = 0;
    size_t acquiredBuffers = 0;
    for (const auto& slot : slots_) {
      if (slot.state == SlotState::Free) {
        freeBuffers += 1;
      } else {
        acquiredBuffers += 1;
      }
    }

    jsi::Object result(runtime);
    result.setProperty(runtime, "writerId", static_cast<double>(writerId_));
    result.setProperty(runtime, "path", jsi::String::createFromUtf8(runtime, path_));
    result.setProperty(runtime, "bufferSize", static_cast<double>(bufferSize_));
    result.setProperty(runtime, "bufferCount", static_cast<double>(slots_.size()));
    result.setProperty(runtime, "freeBuffers", static_cast<double>(freeBuffers));
    result.setProperty(runtime, "acquiredBuffers", static_cast<double>(acquiredBuffers));
    result.setProperty(runtime, "bytesWritten", static_cast<double>(bytesWritten_));
    result.setProperty(runtime, "commits", static_cast<double>(commits_));
    result.setProperty(runtime, "closed", closed_);
    return result;
  }

  int closeFd() {
    if (fd_ == -1) {
      return 0;
    }
    int result = ::close(fd_);
    fd_ = -1;
    return result;
  }

  std::string path_;
  size_t bufferSize_;
  uint64_t writerId_;
  int fd_ = -1;
  bool closed_ = false;
  size_t bytesWritten_ = 0;
  size_t commits_ = 0;
  std::vector<Slot> slots_;
};

class AsyncWriteStreamHostObject final
    : public jsi::HostObject,
      public std::enable_shared_from_this<AsyncWriteStreamHostObject> {
 public:
  AsyncWriteStreamHostObject(
      std::string path,
      size_t bufferSize,
      size_t bufferCount,
      std::shared_ptr<react::CallInvoker> jsCallInvoker)
      : path_(std::move(path)),
        bufferSize_(bufferSize),
        writerId_(nextOwnedWriterId()),
        jsCallInvoker_(std::move(jsCallInvoker)) {
    if (!jsCallInvoker_) {
      throw std::runtime_error("RabbyNativeFS async stream requires JS CallInvoker");
    }

    fd_ = open(path_.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0666);
    if (fd_ == -1) {
      throw std::runtime_error(errnoMessage("open", path_));
    }

    slots_.reserve(bufferCount);
    for (size_t index = 0; index < bufferCount; index += 1) {
      slots_.push_back(Slot{std::make_shared<VectorBuffer>(bufferSize_)});
    }

    worker_ = std::thread([this] { workerLoop(); });
  }

  ~AsyncWriteStreamHostObject() override {
    shutdownWorker();
  }

  jsi::Value get(jsi::Runtime& runtime, const jsi::PropNameID& name) override {
    auto property = name.utf8(runtime);
    if (property == "acquireBuffer") {
      return wrapHostFunction(
          runtime,
          "acquireAsyncWriteBuffer",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, acquireBuffer(runtime));
          });
    }
    if (property == "commit") {
      return wrapHostFunction(
          runtime,
          "commitAsyncWriteBuffer",
          2,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value* arguments,
                 size_t count) -> jsi::Value {
            return jsi::Value(runtime, commit(runtime, arguments, count));
          });
    }
    if (property == "commitBatch") {
      return wrapHostFunction(
          runtime,
          "commitAsyncWriteBufferBatch",
          2,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value* arguments,
                 size_t count) -> jsi::Value {
            return jsi::Value(runtime, commitBatch(runtime, arguments, count));
          });
    }
    if (property == "close") {
      return wrapHostFunction(
          runtime,
          "closeAsyncWriteStream",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, close(runtime));
          });
    }
    if (property == "stats") {
      return wrapHostFunction(
          runtime,
          "statsAsyncWriteStream",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, makeWriteStreamStatsObject(runtime, statsSnapshot()));
          });
    }
    return jsi::Value::undefined();
  }

  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& runtime) override {
    std::vector<jsi::PropNameID> names;
    names.reserve(5);
    names.push_back(jsi::PropNameID::forAscii(runtime, "acquireBuffer"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "commit"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "commitBatch"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "close"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "stats"));
    return names;
  }

 private:
  enum class SlotState {
    Free,
    Acquired,
    Pending,
  };

  enum class WorkType {
    Commit,
    Close,
  };

  struct Slot {
    std::shared_ptr<VectorBuffer> buffer;
    SlotState state = SlotState::Free;
    uint64_t generation = 0;
  };

  struct PendingWrite {
    size_t slotIndex = 0;
    uint64_t generation = 0;
    size_t byteLength = 0;
  };

  struct WorkItem {
    WorkType type;
    std::vector<PendingWrite> writes;
    size_t byteLength = 0;
    SteadyClock::time_point startedAt;
    std::shared_ptr<PromiseCallbacks> callbacks;
  };

  jsi::Object acquireBuffer(jsi::Runtime& runtime) {
    std::shared_ptr<VectorBuffer> buffer;
    size_t slotIndex = 0;
    uint64_t generation = 0;

    {
      std::lock_guard<std::mutex> lock(mutex_);
      ensureOpenLocked();

      bool found = false;
      for (size_t index = 0; index < slots_.size(); index += 1) {
        auto& slot = slots_[index];
        if (slot.state != SlotState::Free) {
          continue;
        }

        slot.state = SlotState::Acquired;
        slot.generation += 1;
        buffer = slot.buffer;
        slotIndex = index;
        generation = slot.generation;
        found = true;
        break;
      }

      if (!found) {
        throw jsi::JSError(runtime, "RabbyNativeFS async write stream has no free buffer");
      }
    }

    auto arrayBuffer = jsi::ArrayBuffer(runtime, buffer);
    auto uint8ArrayConstructor = requireGlobalFunction(runtime, "Uint8Array");
    auto uint8Array = uint8ArrayConstructor.callAsConstructor(runtime, std::move(arrayBuffer)).asObject(runtime);
    uint8Array.setExternalMemoryPressure(runtime, buffer->size());
    uint8Array.setProperty(runtime, "__rabbyNativeFSWriterId", static_cast<double>(writerId_));
    uint8Array.setProperty(runtime, "__rabbyNativeFSSlot", static_cast<double>(slotIndex));
    uint8Array.setProperty(runtime, "__rabbyNativeFSGeneration", static_cast<double>(generation));
    return uint8Array;
  }

  jsi::Object commit(
      jsi::Runtime& runtime,
      const jsi::Value* arguments,
      size_t count) {
    if (count < 1 || !arguments[0].isObject()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commit expects an owned Uint8Array");
    }

    auto write = parsePendingWrite(
        runtime,
        arguments[0],
        count > 1 ? &arguments[1] : nullptr);

    auto self = shared_from_this();
    return makePromise(
        runtime,
        "commitAsyncWriteBufferPromise",
        [self, write](std::shared_ptr<PromiseCallbacks> callbacks) {
          std::vector<PendingWrite> writes;
          writes.push_back(write);
          self->enqueueCommit(std::move(writes), std::move(callbacks));
        });
  }

  jsi::Object commitBatch(
      jsi::Runtime& runtime,
      const jsi::Value* arguments,
      size_t count) {
    if (count < 1 || !arguments[0].isObject()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commitBatch expects an array of owned Uint8Array buffers");
    }

    auto arrayObject = arguments[0].asObject(runtime);
    if (!arrayObject.isArray(runtime)) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commitBatch expects an array of owned Uint8Array buffers");
    }

    bool hasLengthArray = false;
    if (count > 1 && !arguments[1].isUndefined() && !arguments[1].isNull()) {
      if (!arguments[1].isObject() || !arguments[1].asObject(runtime).isArray(runtime)) {
        throw jsi::JSError(runtime, "RabbyNativeFS async commitBatch lengths must be an array");
      }
      hasLengthArray = true;
    }

    auto array = arrayObject.asArray(runtime);
    auto length = array.length(runtime);
    if (length == 0) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commitBatch expects at least one buffer");
    }

    std::vector<PendingWrite> writes;
    writes.reserve(length);
    for (size_t index = 0; index < length; index += 1) {
      auto bufferValue = array.getValueAtIndex(runtime, index);
      auto lengthValue = hasLengthArray
          ? arguments[1].asObject(runtime).asArray(runtime).getValueAtIndex(runtime, index)
          : jsi::Value::undefined();
      writes.push_back(parsePendingWrite(
          runtime,
          bufferValue,
          hasLengthArray ? &lengthValue : nullptr));
    }

    auto self = shared_from_this();
    return makePromise(
        runtime,
        "commitAsyncWriteBufferBatchPromise",
        [self, writes = std::move(writes)](std::shared_ptr<PromiseCallbacks> callbacks) mutable {
          self->enqueueCommit(std::move(writes), std::move(callbacks));
        });
  }

  PendingWrite parsePendingWrite(
      jsi::Runtime& runtime,
      const jsi::Value& bufferValue,
      const jsi::Value* lengthValue) {
    if (!bufferValue.isObject()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commit expects an owned Uint8Array");
    }

    auto object = bufferValue.asObject(runtime);
    auto writerId = requireTokenNumber(runtime, object, "__rabbyNativeFSWriterId");
    auto slotIndex = requireTokenNumber(runtime, object, "__rabbyNativeFSSlot");
    auto generation = requireTokenNumber(runtime, object, "__rabbyNativeFSGeneration");

    if (writerId != writerId_) {
      throw jsi::JSError(runtime, "RabbyNativeFS async buffer belongs to another writer");
    }
    if (slotIndex >= slots_.size()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async buffer slot is out of range");
    }

    std::shared_ptr<VectorBuffer> expectedBuffer;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      ensureOpenLocked();
      auto& slot = slots_[static_cast<size_t>(slotIndex)];
      expectedBuffer = slot.buffer;
    }

    auto bytes = requireBytes(runtime, bufferValue);
    if (bytes.byteOffset != 0) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commit expects the original acquired buffer, not a subarray");
    }
    if (bytes.buffer.data(runtime) != expectedBuffer->data()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async buffer storage mismatch");
    }

    size_t byteLength = bytes.byteLength;
    if (lengthValue != nullptr && !lengthValue->isUndefined() && !lengthValue->isNull()) {
      if (!lengthValue->isNumber()) {
        throw jsi::JSError(runtime, "RabbyNativeFS async commit length must be a number");
      }
      auto length = lengthValue->asNumber();
      if (length < 0) {
        throw jsi::JSError(runtime, "RabbyNativeFS async commit length must be >= 0");
      }
      byteLength = static_cast<size_t>(length);
    }
    if (byteLength > bytes.byteLength || byteLength > expectedBuffer->size()) {
      throw jsi::JSError(runtime, "RabbyNativeFS async commit length exceeds the acquired buffer");
    }

    return PendingWrite{
        static_cast<size_t>(slotIndex),
        generation,
        byteLength};
  }

  jsi::Object close(jsi::Runtime& runtime) {
    auto self = shared_from_this();
    return makePromise(
        runtime,
        "closeAsyncWriteStreamPromise",
        [self](std::shared_ptr<PromiseCallbacks> callbacks) {
          self->enqueueClose(std::move(callbacks));
        });
  }

  void enqueueCommit(
      std::vector<PendingWrite> writes,
      std::shared_ptr<PromiseCallbacks> callbacks) {
    size_t totalByteLength = 0;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      ensureOpenLocked();

      std::vector<bool> seenSlots(slots_.size(), false);
      for (const auto& write : writes) {
        if (write.slotIndex >= slots_.size()) {
          throw std::runtime_error("RabbyNativeFS async buffer slot is out of range");
        }
        if (seenSlots[write.slotIndex]) {
          throw std::runtime_error("RabbyNativeFS async commitBatch contains a duplicate buffer");
        }
        seenSlots[write.slotIndex] = true;

        auto& slot = slots_[write.slotIndex];
        if (slot.state != SlotState::Acquired || slot.generation != write.generation) {
          throw std::runtime_error("RabbyNativeFS async buffer is not currently acquired");
        }
        totalByteLength += write.byteLength;
      }

      for (const auto& write : writes) {
        slots_[write.slotIndex].state = SlotState::Pending;
      }

      queue_.push_back(WorkItem{
          WorkType::Commit,
          std::move(writes),
          totalByteLength,
          SteadyClock::now(),
          std::move(callbacks)});
    }
    cv_.notify_one();
  }

  void enqueueClose(std::shared_ptr<PromiseCallbacks> callbacks) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (closed_) {
        throw std::runtime_error("RabbyNativeFS async write stream is already closed");
      }
      if (closing_) {
        throw std::runtime_error("RabbyNativeFS async write stream close is already pending");
      }
      for (const auto& slot : slots_) {
        if (slot.state == SlotState::Acquired) {
          throw std::runtime_error("RabbyNativeFS cannot close an async write stream with acquired buffers");
        }
      }

      closing_ = true;
      queue_.push_back(WorkItem{
          WorkType::Close,
          {},
          0,
          SteadyClock::now(),
          std::move(callbacks)});
    }
    cv_.notify_one();
  }

  void workerLoop() {
    for (;;) {
      WorkItem item;
      {
        std::unique_lock<std::mutex> lock(mutex_);
        cv_.wait(lock, [this] { return stopRequested_ || !queue_.empty(); });
        if (queue_.empty()) {
          if (stopRequested_) {
            break;
          }
          continue;
        }
        item = std::move(queue_.front());
        queue_.pop_front();
      }

      if (item.type == WorkType::Commit) {
        processCommit(std::move(item));
      } else {
        processClose(std::move(item));
      }
    }
  }

  void processCommit(WorkItem item) {
    try {
      std::vector<std::pair<std::shared_ptr<VectorBuffer>, PendingWrite>> writes;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        writes.reserve(item.writes.size());
        for (const auto& write : item.writes) {
          writes.push_back({slots_[write.slotIndex].buffer, write});
        }
      }

      for (const auto& write : writes) {
        writeAllToFd(fd_, write.first->data(), write.second.byteLength, path_);
      }

      size_t totalBytes = 0;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        for (const auto& write : item.writes) {
          auto& slot = slots_[write.slotIndex];
          if (slot.generation == write.generation && slot.state == SlotState::Pending) {
            slot.state = SlotState::Free;
          }
        }
        bytesWritten_ += item.byteLength;
        commits_ += item.writes.size();
        totalBytes = bytesWritten_;
      }

      logNativeFsInfo(
          "async-write",
          item.writes.size() > 1 ? "commit-batch" : "commit",
          path_,
          item.byteLength,
          durationUsSince(item.startedAt));
      resolvePromiseNumber(jsCallInvoker_, std::move(item.callbacks), static_cast<double>(totalBytes));
    } catch (const std::exception& error) {
      {
        std::lock_guard<std::mutex> lock(mutex_);
        for (const auto& write : item.writes) {
          if (write.slotIndex < slots_.size()) {
            slots_[write.slotIndex].state = SlotState::Free;
          }
        }
      }
      logNativeFsError("asyncWriteCommit", path_, error.what());
      rejectPromise(jsCallInvoker_, std::move(item.callbacks), error.what());
    }
    cv_.notify_all();
  }

  void processClose(WorkItem item) {
    try {
      if (fd_ != -1 && ::close(fd_) == -1) {
        throw std::runtime_error(errnoMessage("close", path_));
      }
      fd_ = -1;

      WriteStreamStatsSnapshot snapshot;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        closed_ = true;
        closing_ = false;
        stopRequested_ = true;
        snapshot = statsSnapshotLocked();
      }

      logNativeFsInfo(
          "async-write",
          "close",
          path_,
          snapshot.bytesWritten,
          durationUsSince(item.startedAt));
      resolvePromiseWriteStats(jsCallInvoker_, std::move(item.callbacks), std::move(snapshot));
    } catch (const std::exception& error) {
      logNativeFsError("asyncWriteClose", path_, error.what());
      rejectPromise(jsCallInvoker_, std::move(item.callbacks), error.what());
    }
    cv_.notify_all();
  }

  void ensureOpenLocked() const {
    if (closed_ || closing_ || fd_ == -1) {
      throw std::runtime_error("RabbyNativeFS async write stream is closed");
    }
  }

  WriteStreamStatsSnapshot statsSnapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return statsSnapshotLocked();
  }

  WriteStreamStatsSnapshot statsSnapshotLocked() const {
    size_t freeBuffers = 0;
    size_t acquiredBuffers = 0;
    size_t pendingBuffers = 0;

    for (const auto& slot : slots_) {
      if (slot.state == SlotState::Free) {
        freeBuffers += 1;
      } else if (slot.state == SlotState::Acquired) {
        acquiredBuffers += 1;
      } else {
        pendingBuffers += 1;
      }
    }

    return WriteStreamStatsSnapshot{
        writerId_,
        path_,
        bufferSize_,
        slots_.size(),
        freeBuffers,
        acquiredBuffers,
        pendingBuffers,
        bytesWritten_,
        commits_,
        closed_};
  }

  void shutdownWorker() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      stopRequested_ = true;
    }
    cv_.notify_all();
    if (worker_.joinable() && worker_.get_id() != std::this_thread::get_id()) {
      worker_.join();
    }
    if (fd_ != -1) {
      ::close(fd_);
      fd_ = -1;
    }
  }

  std::string path_;
  size_t bufferSize_;
  uint64_t writerId_;
  int fd_ = -1;
  bool closed_ = false;
  bool closing_ = false;
  bool stopRequested_ = false;
  size_t bytesWritten_ = 0;
  size_t commits_ = 0;
  std::vector<Slot> slots_;
  std::shared_ptr<react::CallInvoker> jsCallInvoker_;
  mutable std::mutex mutex_;
  std::condition_variable cv_;
  std::deque<WorkItem> queue_;
  std::thread worker_;
};

uint64_t nextAsyncReaderId() {
  static uint64_t nextId = 1;
  return nextId++;
}

class AsyncReadStreamHostObject final
    : public jsi::HostObject,
      public std::enable_shared_from_this<AsyncReadStreamHostObject> {
 public:
  AsyncReadStreamHostObject(
      std::string path,
      size_t bufferSize,
      std::shared_ptr<react::CallInvoker> jsCallInvoker)
      : path_(std::move(path)),
        bufferSize_(bufferSize),
        readerId_(nextAsyncReaderId()),
        jsCallInvoker_(std::move(jsCallInvoker)) {
    if (!jsCallInvoker_) {
      throw std::runtime_error("RabbyNativeFS async stream requires JS CallInvoker");
    }

    fd_ = open(path_.c_str(), O_RDONLY);
    if (fd_ == -1) {
      throw std::runtime_error(errnoMessage("open", path_));
    }

    worker_ = std::thread([this] { workerLoop(); });
  }

  ~AsyncReadStreamHostObject() override {
    shutdownWorker();
  }

  jsi::Value get(jsi::Runtime& runtime, const jsi::PropNameID& name) override {
    auto property = name.utf8(runtime);
    if (property == "readChunk") {
      return wrapHostFunction(
          runtime,
          "readAsyncChunk",
          1,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value* arguments,
                 size_t count) -> jsi::Value {
            size_t length = count > 0
                ? requirePositiveSize(runtime, arguments[0], bufferSize_, "length")
                : bufferSize_;
            auto self = shared_from_this();
            return jsi::Value(
                runtime,
                makePromise(
                    runtime,
                    "readAsyncChunkPromise",
                    [self, length](std::shared_ptr<PromiseCallbacks> callbacks) {
                      self->enqueueRead(length, std::move(callbacks));
                    }));
          });
    }
    if (property == "readBatch") {
      return wrapHostFunction(
          runtime,
          "readAsyncBatch",
          1,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value* arguments,
                 size_t count) -> jsi::Value {
            size_t length = count > 0
                ? requirePositiveSize(runtime, arguments[0], bufferSize_, "length")
                : bufferSize_;
            auto self = shared_from_this();
            return jsi::Value(
                runtime,
                makePromise(
                    runtime,
                    "readAsyncBatchPromise",
                    [self, length](std::shared_ptr<PromiseCallbacks> callbacks) {
                      self->enqueueRead(length, std::move(callbacks));
                    }));
          });
    }
    if (property == "close") {
      return wrapHostFunction(
          runtime,
          "closeAsyncReadStream",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            auto self = shared_from_this();
            return jsi::Value(
                runtime,
                makePromise(
                    runtime,
                    "closeAsyncReadStreamPromise",
                    [self](std::shared_ptr<PromiseCallbacks> callbacks) {
                      self->enqueueClose(std::move(callbacks));
                    }));
          });
    }
    if (property == "stats") {
      return wrapHostFunction(
          runtime,
          "statsAsyncReadStream",
          0,
          [this](jsi::Runtime& runtime,
                 const jsi::Value&,
                 const jsi::Value*,
                 size_t) -> jsi::Value {
            return jsi::Value(runtime, makeReadStreamStatsObject(runtime, statsSnapshot()));
          });
    }
    return jsi::Value::undefined();
  }

  std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& runtime) override {
    std::vector<jsi::PropNameID> names;
    names.reserve(4);
    names.push_back(jsi::PropNameID::forAscii(runtime, "readChunk"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "readBatch"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "close"));
    names.push_back(jsi::PropNameID::forAscii(runtime, "stats"));
    return names;
  }

 private:
  enum class WorkType {
    Read,
    Close,
  };

  struct WorkItem {
    WorkType type;
    size_t length = 0;
    SteadyClock::time_point startedAt;
    std::shared_ptr<PromiseCallbacks> callbacks;
  };

  void enqueueRead(size_t length, std::shared_ptr<PromiseCallbacks> callbacks) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      ensureOpenLocked();
      queue_.push_back(WorkItem{
          WorkType::Read,
          length,
          SteadyClock::now(),
          std::move(callbacks)});
    }
    cv_.notify_one();
  }

  void enqueueClose(std::shared_ptr<PromiseCallbacks> callbacks) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (closed_) {
        throw std::runtime_error("RabbyNativeFS async read stream is already closed");
      }
      if (closing_) {
        throw std::runtime_error("RabbyNativeFS async read stream close is already pending");
      }
      closing_ = true;
      queue_.push_back(WorkItem{
          WorkType::Close,
          0,
          SteadyClock::now(),
          std::move(callbacks)});
    }
    cv_.notify_one();
  }

  void workerLoop() {
    for (;;) {
      WorkItem item;
      {
        std::unique_lock<std::mutex> lock(mutex_);
        cv_.wait(lock, [this] { return stopRequested_ || !queue_.empty(); });
        if (queue_.empty()) {
          if (stopRequested_) {
            break;
          }
          continue;
        }
        item = std::move(queue_.front());
        queue_.pop_front();
      }

      if (item.type == WorkType::Read) {
        processRead(std::move(item));
      } else {
        processClose(std::move(item));
      }
    }
  }

  void processRead(WorkItem item) {
    try {
      {
        std::lock_guard<std::mutex> lock(mutex_);
        if (eof_) {
          resolvePromiseNull(jsCallInvoker_, std::move(item.callbacks));
          return;
        }
      }

      std::vector<uint8_t> bytes(item.length);
      size_t totalRead = 0;
      while (totalRead < bytes.size()) {
        ssize_t readCount = ::read(fd_, bytes.data() + totalRead, bytes.size() - totalRead);
        if (readCount == -1) {
          if (errno == EINTR) {
            continue;
          }
          throw std::runtime_error(errnoMessage("read", path_));
        }
        if (readCount == 0) {
          break;
        }
        totalRead += static_cast<size_t>(readCount);
      }

      if (totalRead == 0) {
        {
          std::lock_guard<std::mutex> lock(mutex_);
          eof_ = true;
        }
        logNativeFsInfo(
            "async-read",
            "read-eof",
            path_,
            0,
            durationUsSince(item.startedAt));
        resolvePromiseNull(jsCallInvoker_, std::move(item.callbacks));
        return;
      }

      if (totalRead != bytes.size()) {
        bytes.resize(totalRead);
      }
      {
        std::lock_guard<std::mutex> lock(mutex_);
        bytesRead_ += totalRead;
        reads_ += 1;
      }

      logNativeFsInfo(
          "async-read",
          "read",
          path_,
          totalRead,
          durationUsSince(item.startedAt));
      resolvePromiseBytes(jsCallInvoker_, std::move(item.callbacks), std::move(bytes));
    } catch (const std::exception& error) {
      logNativeFsError("asyncReadChunk", path_, error.what());
      rejectPromise(jsCallInvoker_, std::move(item.callbacks), error.what());
    }
  }

  void processClose(WorkItem item) {
    try {
      if (fd_ != -1 && ::close(fd_) == -1) {
        throw std::runtime_error(errnoMessage("close", path_));
      }
      fd_ = -1;

      ReadStreamStatsSnapshot snapshot;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        closed_ = true;
        closing_ = false;
        stopRequested_ = true;
        snapshot = statsSnapshotLocked();
      }

      logNativeFsInfo(
          "async-read",
          "close",
          path_,
          snapshot.bytesRead,
          durationUsSince(item.startedAt));
      resolvePromiseReadStats(jsCallInvoker_, std::move(item.callbacks), std::move(snapshot));
    } catch (const std::exception& error) {
      logNativeFsError("asyncReadClose", path_, error.what());
      rejectPromise(jsCallInvoker_, std::move(item.callbacks), error.what());
    }
    cv_.notify_all();
  }

  void ensureOpenLocked() const {
    if (closed_ || closing_ || fd_ == -1) {
      throw std::runtime_error("RabbyNativeFS async read stream is closed");
    }
  }

  ReadStreamStatsSnapshot statsSnapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return statsSnapshotLocked();
  }

  ReadStreamStatsSnapshot statsSnapshotLocked() const {
    return ReadStreamStatsSnapshot{
        readerId_,
        path_,
        bufferSize_,
        bytesRead_,
        reads_,
        closed_,
        eof_};
  }

  void shutdownWorker() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      stopRequested_ = true;
    }
    cv_.notify_all();
    if (worker_.joinable() && worker_.get_id() != std::this_thread::get_id()) {
      worker_.join();
    }
    if (fd_ != -1) {
      ::close(fd_);
      fd_ = -1;
    }
  }

  std::string path_;
  size_t bufferSize_;
  uint64_t readerId_;
  int fd_ = -1;
  bool closed_ = false;
  bool closing_ = false;
  bool stopRequested_ = false;
  bool eof_ = false;
  size_t bytesRead_ = 0;
  size_t reads_ = 0;
  std::shared_ptr<react::CallInvoker> jsCallInvoker_;
  mutable std::mutex mutex_;
  std::condition_variable cv_;
  std::deque<WorkItem> queue_;
  std::thread worker_;
};

jsi::Value wrapHostFunction(
    jsi::Runtime& runtime,
    const char* name,
    unsigned int argCount,
    jsi::HostFunctionType function) {
  return jsi::Value(
      runtime,
      jsi::Function::createFromHostFunction(
          runtime,
          jsi::PropNameID::forAscii(runtime, name),
          argCount,
          std::move(function)));
}

jsi::Array getDiagnosticsSnapshot(jsi::Runtime& runtime) {
  std::deque<DiagnosticEvent> snapshot;
  {
    std::lock_guard<std::mutex> lock(diagnosticMutex);
    snapshot = diagnosticEvents;
  }

  jsi::Array result(runtime, snapshot.size());
  for (size_t index = 0; index < snapshot.size(); index += 1) {
    const auto& event = snapshot[index];
    jsi::Object item(runtime);
    item.setProperty(runtime, "id", static_cast<double>(event.id));
    item.setProperty(
        runtime,
        "category",
        jsi::String::createFromUtf8(runtime, event.category));
    item.setProperty(
        runtime,
        "operation",
        jsi::String::createFromUtf8(runtime, event.operation));
    item.setProperty(
        runtime,
        "pathTail",
        jsi::String::createFromUtf8(runtime, event.pathTail));
    item.setProperty(runtime, "bytes", static_cast<double>(event.bytes));
    item.setProperty(
        runtime,
        "durationUs",
        static_cast<double>(event.durationUs));
    item.setProperty(runtime, "tid", static_cast<double>(event.tid));
    item.setProperty(runtime, "isError", event.isError);
    item.setProperty(
        runtime,
        "message",
        jsi::String::createFromUtf8(runtime, event.message));
    result.setValueAtIndex(runtime, index, item);
  }

  return result;
}

void clearDiagnostics() {
  std::lock_guard<std::mutex> lock(diagnosticMutex);
  diagnosticEvents.clear();
}

jsi::Value makeCreateWriteStreamFunction(
    jsi::Runtime& runtime,
    const char* functionName) {
  return wrapHostFunction(
      runtime,
      functionName,
      3,
      [functionName](jsi::Runtime& runtime,
                     const jsi::Value&,
                     const jsi::Value* arguments,
                     size_t count) -> jsi::Value {
        std::string path;
        try {
          path = requirePath(runtime, arguments, count);
          size_t bufferSize = count > 1
              ? requirePositiveSize(runtime, arguments[1], 256 * 1024, "bufferSize")
              : 256 * 1024;
          size_t bufferCount = count > 2
              ? requirePositiveSize(runtime, arguments[2], 2, "bufferCount")
              : 2;

          if (bufferSize > 16 * 1024 * 1024) {
            throw jsi::JSError(runtime, "RabbyNativeFS owned stream bufferSize is too large");
          }
          if (bufferCount > 16) {
            throw jsi::JSError(runtime, "RabbyNativeFS owned stream bufferCount is too large");
          }

          auto startedAt = SteadyClock::now();
          auto writer = std::make_shared<OwnedWriteStreamHostObject>(
              path,
              bufferSize,
              bufferCount);
          logNativeFsInfo(
              "owned-open",
              functionName,
              path,
              bufferSize * bufferCount,
              durationUsSince(startedAt));
          auto object = jsi::Object::createFromHostObject(runtime, writer);
          object.setExternalMemoryPressure(runtime, bufferSize * bufferCount);
          return jsi::Value(runtime, object);
        } catch (const jsi::JSError&) {
          throw;
        } catch (const std::exception& error) {
          logNativeFsError(functionName, path, error.what());
          throw jsi::JSError(runtime, error.what());
        }
      });
}

jsi::Value makeCreateAsyncWriteStreamFunction(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> jsCallInvoker) {
  return wrapHostFunction(
      runtime,
      "createAsyncWriteStream",
      3,
      [jsCallInvoker = std::move(jsCallInvoker)](jsi::Runtime& runtime,
                                                  const jsi::Value&,
                                                  const jsi::Value* arguments,
                                                  size_t count) -> jsi::Value {
        std::string path;
        try {
          path = requirePath(runtime, arguments, count);
          size_t bufferSize = count > 1
              ? requirePositiveSize(runtime, arguments[1], 256 * 1024, "bufferSize")
              : 256 * 1024;
          size_t bufferCount = count > 2
              ? requirePositiveSize(runtime, arguments[2], 2, "bufferCount")
              : 2;

          if (bufferSize > 16 * 1024 * 1024) {
            throw jsi::JSError(runtime, "RabbyNativeFS async write stream bufferSize is too large");
          }
          if (bufferCount > 16) {
            throw jsi::JSError(runtime, "RabbyNativeFS async write stream bufferCount is too large");
          }

          auto startedAt = SteadyClock::now();
          auto writer = std::make_shared<AsyncWriteStreamHostObject>(
              path,
              bufferSize,
              bufferCount,
              jsCallInvoker);
          logNativeFsInfo(
              "async-open",
              "createAsyncWriteStream",
              path,
              bufferSize * bufferCount,
              durationUsSince(startedAt));
          auto object = jsi::Object::createFromHostObject(runtime, writer);
          object.setExternalMemoryPressure(runtime, bufferSize * bufferCount);
          return jsi::Value(runtime, object);
        } catch (const jsi::JSError&) {
          throw;
        } catch (const std::exception& error) {
          logNativeFsError("createAsyncWriteStream", path, error.what());
          throw jsi::JSError(runtime, error.what());
        }
      });
}

jsi::Value makeCreateAsyncReadStreamFunction(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> jsCallInvoker) {
  return wrapHostFunction(
      runtime,
      "createAsyncReadStream",
      2,
      [jsCallInvoker = std::move(jsCallInvoker)](jsi::Runtime& runtime,
                                                  const jsi::Value&,
                                                  const jsi::Value* arguments,
                                                  size_t count) -> jsi::Value {
        std::string path;
        try {
          path = requirePath(runtime, arguments, count);
          size_t bufferSize = count > 1
              ? requirePositiveSize(runtime, arguments[1], 256 * 1024, "bufferSize")
              : 256 * 1024;

          if (bufferSize > 16 * 1024 * 1024) {
            throw jsi::JSError(runtime, "RabbyNativeFS async read stream bufferSize is too large");
          }

          auto startedAt = SteadyClock::now();
          auto reader = std::make_shared<AsyncReadStreamHostObject>(
              path,
              bufferSize,
              jsCallInvoker);
          logNativeFsInfo(
              "async-open",
              "createAsyncReadStream",
              path,
              bufferSize,
              durationUsSince(startedAt));
          auto object = jsi::Object::createFromHostObject(runtime, reader);
          return jsi::Value(runtime, object);
        } catch (const jsi::JSError&) {
          throw;
        } catch (const std::exception& error) {
          logNativeFsError("createAsyncReadStream", path, error.what());
          throw jsi::JSError(runtime, error.what());
        }
      });
}

} // namespace

void install(
    jsi::Runtime& runtime,
    std::shared_ptr<react::CallInvoker> jsCallInvoker) {
  logNativeFsInstall();

  auto fs = jsi::Object(runtime);

  fs.setProperty(
      runtime,
      "readFileBytes",
      wrapHostFunction(
          runtime,
          "readFileBytes",
          1,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            std::string path;
            try {
              path = requirePath(runtime, arguments, count);
              auto startedAt = SteadyClock::now();
              auto bytes = readBytesFromFile(path, 0, 0);
              logNativeFsInfo(
                  "io",
                  "readFileBytes",
                  path,
                  bytes.size(),
                  durationUsSince(startedAt));
              auto result = makeUint8Array(runtime, std::move(bytes));
              return jsi::Value(runtime, result);
            } catch (const std::exception& error) {
              logNativeFsError("readFileBytes", path, error.what());
              throw jsi::JSError(runtime, error.what());
            }
          }));

  fs.setProperty(
      runtime,
      "readBytes",
      wrapHostFunction(
          runtime,
          "readBytes",
          3,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            std::string path;
            try {
              path = requirePath(runtime, arguments, count);
              int length = count > 1 ? requireInt(runtime, arguments[1], 0) : 0;
              int64_t position = count > 2 ? requireInt64(runtime, arguments[2], 0) : 0;
              auto startedAt = SteadyClock::now();
              auto bytes = readBytesFromFile(path, length, position);
              logNativeFsInfo(
                  "io",
                  "readBytes",
                  path,
                  bytes.size(),
                  durationUsSince(startedAt));
              auto result = makeUint8Array(runtime, std::move(bytes));
              return jsi::Value(runtime, result);
            } catch (const std::exception& error) {
              logNativeFsError("readBytes", path, error.what());
              throw jsi::JSError(runtime, error.what());
            }
          }));

  fs.setProperty(
      runtime,
      "writeFileBytes",
      wrapHostFunction(
          runtime,
          "writeFileBytes",
          2,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            std::string path;
            try {
              if (count < 2) {
                throw jsi::JSError(runtime, "writeFileBytes expects path and bytes");
              }
              path = requirePath(runtime, arguments, count);
              auto bytes = requireBytes(runtime, arguments[1]);
              auto startedAt = SteadyClock::now();
              writeBytesToFile(
                  path,
                  bytes.buffer.data(runtime) + bytes.byteOffset,
                  bytes.byteLength,
                  false,
                  0);
              logNativeFsInfo(
                  "io",
                  "writeFileBytes",
                  path,
                  bytes.byteLength,
                  durationUsSince(startedAt));
              return jsi::Value::undefined();
            } catch (const jsi::JSError&) {
              throw;
            } catch (const std::exception& error) {
              logNativeFsError("writeFileBytes", path, error.what());
              throw jsi::JSError(runtime, error.what());
            }
          }));

  fs.setProperty(
      runtime,
      "appendFileBytes",
      wrapHostFunction(
          runtime,
          "appendFileBytes",
          2,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            std::string path;
            try {
              if (count < 2) {
                throw jsi::JSError(runtime, "appendFileBytes expects path and bytes");
              }
              path = requirePath(runtime, arguments, count);
              auto bytes = requireBytes(runtime, arguments[1]);
              auto startedAt = SteadyClock::now();
              writeBytesToFile(
                  path,
                  bytes.buffer.data(runtime) + bytes.byteOffset,
                  bytes.byteLength,
                  true,
                  -1);
              logNativeFsInfo(
                  "io",
                  "appendFileBytes",
                  path,
                  bytes.byteLength,
                  durationUsSince(startedAt));
              return jsi::Value::undefined();
            } catch (const jsi::JSError&) {
              throw;
            } catch (const std::exception& error) {
              logNativeFsError("appendFileBytes", path, error.what());
              throw jsi::JSError(runtime, error.what());
            }
          }));

  fs.setProperty(
      runtime,
      "writeBytes",
      wrapHostFunction(
          runtime,
          "writeBytes",
          3,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            std::string path;
            try {
              if (count < 2) {
                throw jsi::JSError(runtime, "writeBytes expects path and bytes");
              }
              path = requirePath(runtime, arguments, count);
              auto bytes = requireBytes(runtime, arguments[1]);
              int64_t position = count > 2 ? requireInt64(runtime, arguments[2], -1) : -1;
              auto startedAt = SteadyClock::now();
              writeBytesToFile(
                  path,
                  bytes.buffer.data(runtime) + bytes.byteOffset,
                  bytes.byteLength,
                  false,
                  position);
              logNativeFsInfo(
                  "io",
                  "writeBytes",
                  path,
                  bytes.byteLength,
                  durationUsSince(startedAt));
              return jsi::Value::undefined();
            } catch (const jsi::JSError&) {
              throw;
            } catch (const std::exception& error) {
              logNativeFsError("writeBytes", path, error.what());
              throw jsi::JSError(runtime, error.what());
            }
          }));

  fs.setProperty(
      runtime,
      "createWriteStream",
      makeCreateWriteStreamFunction(runtime, "createWriteStream"));

  fs.setProperty(
      runtime,
      "createOwnedWriteStreamForTest",
      makeCreateWriteStreamFunction(runtime, "createOwnedWriteStreamForTest"));

  if (jsCallInvoker) {
    fs.setProperty(
        runtime,
        "createAsyncWriteStream",
        makeCreateAsyncWriteStreamFunction(runtime, jsCallInvoker));

    fs.setProperty(
        runtime,
        "createAsyncReadStream",
        makeCreateAsyncReadStreamFunction(runtime, std::move(jsCallInvoker)));
  }

  fs.setProperty(
      runtime,
      "getDiagnosticsSnapshot",
      wrapHostFunction(
          runtime,
          "getDiagnosticsSnapshot",
          0,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value*,
             size_t) -> jsi::Value {
            return jsi::Value(runtime, getDiagnosticsSnapshot(runtime));
          }));

  fs.setProperty(
      runtime,
      "clearDiagnostics",
      wrapHostFunction(
          runtime,
          "clearDiagnostics",
          0,
          [](jsi::Runtime&,
             const jsi::Value&,
             const jsi::Value*,
             size_t) -> jsi::Value {
            clearDiagnostics();
            return jsi::Value::undefined();
          }));

  fs.setProperty(
      runtime,
      "exists",
      wrapHostFunction(
          runtime,
          "exists",
          1,
          [](jsi::Runtime& runtime,
             const jsi::Value&,
             const jsi::Value* arguments,
             size_t count) -> jsi::Value {
            auto path = requirePath(runtime, arguments, count);
            return jsi::Value(access(path.c_str(), F_OK) == 0);
          }));

  runtime.global().setProperty(runtime, "__RabbyNativeFS", std::move(fs));
}

} // namespace rabbyfs
