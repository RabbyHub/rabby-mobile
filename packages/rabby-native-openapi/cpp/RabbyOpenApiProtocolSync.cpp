#include <rabby/openapi/RabbyOpenApiProtocolSync.h>

#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include <algorithm>
#include <cctype>
#include <mutex>
#include <unordered_map>
#include <utility>
#include <vector>

namespace rabby::openapi {
namespace {

bool isSuccessfulHttpStatus(int statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

std::string normalizeAddress(std::string address) {
  std::transform(
      address.begin(),
      address.end(),
      address.begin(),
      [](unsigned char value) { return static_cast<char>(std::tolower(value)); });
  return address;
}

std::string validateAddress(const std::string& address) {
  if (address.size() != 42 || address.rfind("0x", 0) != 0) {
    return "address must be a 20-byte 0x-prefixed value";
  }
  const auto valid = std::all_of(
      address.begin() + 2, address.end(), [](unsigned char value) {
        return std::isxdigit(value) != 0;
      });
  return valid ? std::string{} :
                 "address must contain hexadecimal characters only";
}

std::string responseBody(const http::Response& response) {
  return std::string(response.body.begin(), response.body.end());
}

OpenApiClientRequest makeProtocolListRequest(const std::string& address) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/complex_protocol_list";
  request.query = {{"id", address}};
  request.timeoutMs = 30000;
  request.maxResponseBytes = 64U * 1024U * 1024U;
  return request;
}

std::string describeRequestFailure(const OpenApiClientResult& result) {
  if (result.response.has_value()) {
    return "protocol-list request failed: HTTP " +
        std::to_string(result.response->statusCode);
  }
  if (result.transportError.has_value()) {
    return "protocol-list request failed: transport " +
        std::string(http::errorCodeName(result.transportError->code));
  }
  if (result.failureStage != OpenApiClientFailureStage::None) {
    return "protocol-list request failed: " +
        std::string(openApiClientFailureStageName(result.failureStage));
  }
  return "protocol-list request failed";
}

struct Subscriber {
  ProtocolSyncCompletion completion;
};

struct Operation {
  std::string address;
  std::uint64_t generation{0};
  std::int64_t startedAtMs{0};
  ProtocolSyncStage stage{ProtocolSyncStage::ProtocolList};
  bool finished{false};
  bool requestPending{false};
  bool committing{false};
  std::shared_ptr<http::RequestHandle> handle;
  std::vector<Subscriber> subscribers;
  std::size_t sourceItemCount{0};
  std::vector<NativeProtocolRecord> protocols;
};

struct FinishedOperation {
  bool valid{false};
  ProtocolSyncResult result;
  std::vector<Subscriber> subscribers;
  std::shared_ptr<http::RequestHandle> handle;
};

} // namespace

class ProtocolSyncCoordinator::Impl
    : public std::enable_shared_from_this<ProtocolSyncCoordinator::Impl> {
 public:
  Impl(
      ProtocolSyncExecute execute,
      std::shared_ptr<AddressCachePersistence> persistence,
      ProtocolSyncMillisecondsProvider millisecondsProvider)
      : execute_(std::move(execute)),
        persistence_(std::move(persistence)),
        millisecondsProvider_(std::move(millisecondsProvider)) {}

  ProtocolSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      ProtocolSyncCompletion completion) {
    address = normalizeAddress(std::move(address));
    if (const auto error = validateAddress(address); !error.empty()) {
      return rejectStart(address, error, std::move(completion));
    }
    if (!execute_ || !persistence_ || !millisecondsProvider_) {
      return rejectStart(
          address, "native protocol sync is unavailable", std::move(completion));
    }

    std::shared_ptr<Operation> operation;
    FinishedOperation superseded;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto active = activeOperations_.find(address);
      if (active != activeOperations_.end() && !active->second->finished &&
          !replaceExisting) {
        if (completion) {
          active->second->subscribers.push_back({std::move(completion)});
        }
        return {true, true, active->second->generation, {}};
      }
      if (active != activeOperations_.end()) {
        superseded = finishLocked(
            active->second,
            ProtocolSyncStage::Superseded,
            "protocol sync was superseded by a newer generation",
            false);
      }

      operation = std::make_shared<Operation>();
      operation->address = address;
      operation->generation = ++generations_[address];
      operation->startedAtMs = millisecondsProvider_();
      operation->requestPending = true;
      if (completion) {
        operation->subscribers.push_back({std::move(completion)});
      }
      activeOperations_[address] = operation;
    }
    deliver(std::move(superseded));
    dispatch(operation);
    return {true, false, operation->generation, {}};
  }

  void cancelAddress(const std::string& rawAddress) {
    FinishedOperation cancelled;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto active = activeOperations_.find(normalizeAddress(rawAddress));
      if (active != activeOperations_.end()) {
        cancelled = finishLocked(
            active->second,
            ProtocolSyncStage::Cancelled,
            "protocol sync was cancelled",
            false);
      }
    }
    deliver(std::move(cancelled));
  }

  void cancelAll() {
    std::vector<FinishedOperation> cancelled;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      std::vector<std::shared_ptr<Operation>> operations;
      operations.reserve(activeOperations_.size());
      for (const auto& entry : activeOperations_) {
        operations.push_back(entry.second);
      }
      for (const auto& operation : operations) {
        cancelled.push_back(finishLocked(
            operation,
            ProtocolSyncStage::Cancelled,
            "protocol sync was cancelled",
            false));
      }
    }
    {
      std::lock_guard<std::mutex> commitLock(commitMutex_);
    }
    for (auto& operation : cancelled) {
      deliver(std::move(operation));
    }
  }

  std::size_t activeSyncCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return activeOperations_.size();
  }

 private:
  static ProtocolSyncStartResult rejectStart(
      const std::string& address,
      const std::string& error,
      ProtocolSyncCompletion completion) {
    ProtocolSyncResult result;
    result.address = address;
    result.stage = ProtocolSyncStage::ProtocolList;
    result.error = error;
    if (completion) {
      completion(std::move(result));
    }
    return {false, false, 0, error};
  }

  bool isCurrentLocked(const std::shared_ptr<Operation>& operation) const {
    const auto current = activeOperations_.find(operation->address);
    return current != activeOperations_.end() && current->second == operation &&
        !operation->finished;
  }

  void dispatch(const std::shared_ptr<Operation>& operation) {
    auto weakSelf = weak_from_this();
    auto handle = execute_(
        makeProtocolListRequest(operation->address),
        [weakSelf, operation](OpenApiClientResult result) mutable {
          if (const auto self = weakSelf.lock()) {
            self->handleResponse(operation, std::move(result));
          }
        });

    bool missingHandle = false;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (isCurrentLocked(operation) && operation->requestPending) {
        if (handle) {
          operation->handle = std::move(handle);
        } else {
          missingHandle = true;
        }
      }
    }
    if (missingHandle) {
      OpenApiClientResult result;
      result.failureStage = OpenApiClientFailureStage::Transport;
      result.error = "native request did not start";
      handleResponse(operation, std::move(result));
    }
  }

  void handleResponse(
      const std::shared_ptr<Operation>& operation,
      OpenApiClientResult result) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || !operation->requestPending) {
        return;
      }
      operation->requestPending = false;
      operation->handle.reset();
    }

    if (!result.isSuccess() || !result.response.has_value() ||
        !isSuccessfulHttpStatus(result.response->statusCode)) {
      fail(
          operation,
          ProtocolSyncStage::ProtocolList,
          describeRequestFailure(result));
      return;
    }
    auto parsed = parseProtocolListResponse(
        operation->address, responseBody(*result.response));
    if (!parsed.isSuccess()) {
      fail(
          operation,
          ProtocolSyncStage::ProtocolList,
          std::move(parsed.error));
      return;
    }

    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      operation->sourceItemCount = parsed.sourceItemCount;
      operation->protocols = std::move(parsed.protocols);
    }
    commit(operation);
  }

  void commit(const std::shared_ptr<Operation>& operation) {
    std::vector<NativeProtocolRecord> protocols;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || operation->committing) {
        return;
      }
      operation->committing = true;
      operation->stage = ProtocolSyncStage::Persistence;
      protocols = operation->protocols;
    }

    AddressCacheCommitResult commitResult;
    std::int64_t committedAtMs = 0;
    {
      std::lock_guard<std::mutex> commitLock(commitMutex_);
      {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!isCurrentLocked(operation)) {
          return;
        }
      }
      committedAtMs = millisecondsProvider_();
      commitResult = persistence_->commitSnapshot(
          operation->address,
          protocolCacheContract(),
          makeProtocolCacheRows(
              operation->address, protocols, committedAtMs),
          committedAtMs);
    }

    if (!commitResult.success) {
      fail(
          operation,
          ProtocolSyncStage::Persistence,
          commitResult.error.empty()
              ? "protocol cache transaction failed"
              : std::move(commitResult.error));
      return;
    }

    FinishedOperation finished;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      auto result = makeResultLocked(operation);
      result.success = true;
      result.committedRowCount = commitResult.rowCount;
      result.committedAtMs = committedAtMs;
      finished = finishLocked(operation, std::move(result));
    }
    deliver(std::move(finished));
  }

  void fail(
      const std::shared_ptr<Operation>& operation,
      ProtocolSyncStage stage,
      std::string error) {
    FinishedOperation finished;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      finished = finishLocked(operation, stage, std::move(error), false);
    }
    deliver(std::move(finished));
  }

  ProtocolSyncResult makeResultLocked(
      const std::shared_ptr<Operation>& operation) const {
    ProtocolSyncResult result;
    result.address = operation->address;
    result.generation = operation->generation;
    result.stage = operation->stage;
    result.sourceItemCount = operation->sourceItemCount;
    result.durationMs = std::max<std::int64_t>(
        0, millisecondsProvider_() - operation->startedAtMs);
    return result;
  }

  FinishedOperation finishLocked(
      std::shared_ptr<Operation> operation,
      ProtocolSyncStage stage,
      std::string error,
      bool success) {
    auto result = makeResultLocked(operation);
    result.success = success;
    result.stage = stage;
    result.error = std::move(error);
    return finishLocked(operation, std::move(result));
  }

  FinishedOperation finishLocked(
      std::shared_ptr<Operation> operation,
      ProtocolSyncResult result) {
    FinishedOperation finished;
    if (operation->finished) {
      return finished;
    }
    operation->finished = true;
    const auto current = activeOperations_.find(operation->address);
    if (current != activeOperations_.end() && current->second == operation) {
      activeOperations_.erase(current);
    }
    finished.valid = true;
    finished.result = std::move(result);
    finished.subscribers = std::move(operation->subscribers);
    finished.handle = std::move(operation->handle);
    operation->requestPending = false;
    return finished;
  }

  static void deliver(FinishedOperation finished) {
    if (!finished.valid) {
      return;
    }
    if (finished.handle) {
      finished.handle->cancel();
    }
    for (auto& subscriber : finished.subscribers) {
      if (subscriber.completion) {
        subscriber.completion(finished.result);
      }
    }
  }

  ProtocolSyncExecute execute_;
  std::shared_ptr<AddressCachePersistence> persistence_;
  ProtocolSyncMillisecondsProvider millisecondsProvider_;
  mutable std::mutex mutex_;
  std::mutex commitMutex_;
  std::unordered_map<std::string, std::shared_ptr<Operation>> activeOperations_;
  std::unordered_map<std::string, std::uint64_t> generations_;
};

ProtocolSyncCoordinator::ProtocolSyncCoordinator(
    ProtocolSyncExecute execute,
    std::shared_ptr<AddressCachePersistence> persistence,
    ProtocolSyncMillisecondsProvider millisecondsProvider)
    : impl_(std::make_shared<Impl>(
          std::move(execute),
          std::move(persistence),
          std::move(millisecondsProvider))) {}

ProtocolSyncCoordinator::~ProtocolSyncCoordinator() {
  if (impl_) {
    impl_->cancelAll();
  }
}

ProtocolSyncStartResult ProtocolSyncCoordinator::syncAddress(
    std::string address,
    bool replaceExisting,
    ProtocolSyncCompletion completion) {
  return impl_->syncAddress(
      std::move(address), replaceExisting, std::move(completion));
}

void ProtocolSyncCoordinator::cancelAddress(const std::string& address) {
  impl_->cancelAddress(address);
}

void ProtocolSyncCoordinator::cancelAll() {
  impl_->cancelAll();
}

std::size_t ProtocolSyncCoordinator::activeSyncCount() const {
  return impl_->activeSyncCount();
}

const char* protocolSyncStageName(ProtocolSyncStage stage) {
  switch (stage) {
    case ProtocolSyncStage::None:
      return "none";
    case ProtocolSyncStage::ProtocolList:
      return "protocol_list";
    case ProtocolSyncStage::Persistence:
      return "persistence";
    case ProtocolSyncStage::Cancelled:
      return "cancelled";
    case ProtocolSyncStage::Superseded:
      return "superseded";
  }
  return "unknown";
}

} // namespace rabby::openapi
