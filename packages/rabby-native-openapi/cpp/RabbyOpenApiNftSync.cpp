#include <rabby/openapi/RabbyOpenApiNftSync.h>

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

OpenApiClientRequest makeNftListRequest(const std::string& address) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/nft_list";
  request.query = {
      {"id", address},
      {"is_all", "true"},
      {"sort_by", "credit_score"},
  };
  request.timeoutMs = 30000;
  request.maxResponseBytes = 64U * 1024U * 1024U;
  return request;
}

OpenApiClientRequest makeCollectionListRequest(const std::string& address) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/collection_list";
  request.query = {{"id", address}, {"is_all", "true"}};
  request.timeoutMs = 30000;
  request.maxResponseBytes = 64U * 1024U * 1024U;
  return request;
}

std::string describeRequestFailure(
    const OpenApiClientResult& result,
    const char* requestName) {
  if (result.response.has_value()) {
    return std::string(requestName) + " request failed: HTTP " +
        std::to_string(result.response->statusCode);
  }
  if (result.transportError.has_value()) {
    return std::string(requestName) + " request failed: transport " +
        std::string(http::errorCodeName(result.transportError->code));
  }
  if (result.failureStage != OpenApiClientFailureStage::None) {
    return std::string(requestName) + " request failed: " +
        std::string(openApiClientFailureStageName(result.failureStage));
  }
  return std::string(requestName) + " request failed";
}

struct Subscriber {
  NftSyncCompletion completion;
};

struct Operation {
  std::string address;
  std::uint64_t generation{0};
  std::int64_t startedAtMs{0};
  NftSyncStage stage{NftSyncStage::NftList};
  bool finished{false};
  bool requestPending{false};
  bool committing{false};
  std::shared_ptr<http::RequestHandle> handle;
  std::vector<Subscriber> subscribers;
  std::string nftResponseBody;
  std::size_t sourceItemCount{0};
  std::size_t sourceCollectionCount{0};
  std::size_t filteredItemCount{0};
  std::vector<NativeNftRecord> nfts;
};

struct FinishedOperation {
  bool valid{false};
  NftSyncResult result;
  std::vector<Subscriber> subscribers;
  std::shared_ptr<http::RequestHandle> handle;
};

} // namespace

class NftSyncCoordinator::Impl
    : public std::enable_shared_from_this<NftSyncCoordinator::Impl> {
 public:
  Impl(
      NftSyncExecute execute,
      std::shared_ptr<AddressCachePersistence> persistence,
      NftSyncMillisecondsProvider millisecondsProvider)
      : execute_(std::move(execute)),
        persistence_(std::move(persistence)),
        millisecondsProvider_(std::move(millisecondsProvider)) {}

  NftSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      NftSyncCompletion completion) {
    address = normalizeAddress(std::move(address));
    if (const auto error = validateAddress(address); !error.empty()) {
      return rejectStart(address, error, std::move(completion));
    }
    if (!execute_ || !persistence_ || !millisecondsProvider_) {
      return rejectStart(
          address, "native NFT sync is unavailable", std::move(completion));
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
            NftSyncStage::Superseded,
            "NFT sync was superseded by a newer generation",
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
    dispatch(operation, NftSyncStage::NftList);
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
            NftSyncStage::Cancelled,
            "NFT sync was cancelled",
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
            NftSyncStage::Cancelled,
            "NFT sync was cancelled",
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
  static NftSyncStartResult rejectStart(
      const std::string& address,
      const std::string& error,
      NftSyncCompletion completion) {
    NftSyncResult result;
    result.address = address;
    result.stage = NftSyncStage::NftList;
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

  void dispatch(
      const std::shared_ptr<Operation>& operation,
      NftSyncStage stage) {
    const auto request = stage == NftSyncStage::NftList
        ? makeNftListRequest(operation->address)
        : makeCollectionListRequest(operation->address);
    auto weakSelf = weak_from_this();
    auto handle = execute_(
        request,
        [weakSelf, operation, stage](OpenApiClientResult result) mutable {
          if (const auto self = weakSelf.lock()) {
            self->handleResponse(operation, stage, std::move(result));
          }
        });

    bool missingHandle = false;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (isCurrentLocked(operation) && operation->requestPending &&
          operation->stage == stage) {
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
      handleResponse(operation, stage, std::move(result));
    }
  }

  void handleResponse(
      const std::shared_ptr<Operation>& operation,
      NftSyncStage stage,
      OpenApiClientResult result) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || !operation->requestPending ||
          operation->stage != stage) {
        return;
      }
      operation->requestPending = false;
      operation->handle.reset();
    }

    const auto* requestName = stage == NftSyncStage::NftList
        ? "NFT-list"
        : "collection-list";
    if (!result.isSuccess() || !result.response.has_value() ||
        !isSuccessfulHttpStatus(result.response->statusCode)) {
      fail(operation, stage, describeRequestFailure(result, requestName));
      return;
    }

    if (stage == NftSyncStage::NftList) {
      {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!isCurrentLocked(operation)) {
          return;
        }
        operation->nftResponseBody = responseBody(*result.response);
        operation->stage = NftSyncStage::CollectionList;
        operation->requestPending = true;
      }
      dispatch(operation, NftSyncStage::CollectionList);
      return;
    }

    auto parsed = parseNftListResponse(
        operation->address,
        operation->nftResponseBody,
        responseBody(*result.response));
    if (!parsed.isSuccess()) {
      fail(operation, NftSyncStage::CollectionList, std::move(parsed.error));
      return;
    }
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      operation->sourceItemCount = parsed.sourceItemCount;
      operation->sourceCollectionCount = parsed.sourceCollectionCount;
      operation->filteredItemCount = parsed.filteredItemCount;
      operation->nfts = std::move(parsed.nfts);
    }
    commit(operation);
  }

  void commit(const std::shared_ptr<Operation>& operation) {
    std::vector<NativeNftRecord> nfts;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || operation->committing) {
        return;
      }
      operation->committing = true;
      operation->stage = NftSyncStage::Persistence;
      nfts = operation->nfts;
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
          nftCacheContract(),
          makeNftCacheRows(operation->address, nfts, committedAtMs),
          committedAtMs);
    }

    if (!commitResult.success) {
      fail(
          operation,
          NftSyncStage::Persistence,
          commitResult.error.empty() ? "NFT cache transaction failed"
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
      NftSyncStage stage,
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

  NftSyncResult makeResultLocked(
      const std::shared_ptr<Operation>& operation) const {
    NftSyncResult result;
    result.address = operation->address;
    result.generation = operation->generation;
    result.stage = operation->stage;
    result.sourceItemCount = operation->sourceItemCount;
    result.sourceCollectionCount = operation->sourceCollectionCount;
    result.filteredItemCount = operation->filteredItemCount;
    result.durationMs = std::max<std::int64_t>(
        0, millisecondsProvider_() - operation->startedAtMs);
    return result;
  }

  FinishedOperation finishLocked(
      std::shared_ptr<Operation> operation,
      NftSyncStage stage,
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
      NftSyncResult result) {
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

  NftSyncExecute execute_;
  std::shared_ptr<AddressCachePersistence> persistence_;
  NftSyncMillisecondsProvider millisecondsProvider_;
  mutable std::mutex mutex_;
  std::mutex commitMutex_;
  std::unordered_map<std::string, std::shared_ptr<Operation>> activeOperations_;
  std::unordered_map<std::string, std::uint64_t> generations_;
};

NftSyncCoordinator::NftSyncCoordinator(
    NftSyncExecute execute,
    std::shared_ptr<AddressCachePersistence> persistence,
    NftSyncMillisecondsProvider millisecondsProvider)
    : impl_(std::make_shared<Impl>(
          std::move(execute),
          std::move(persistence),
          std::move(millisecondsProvider))) {}

NftSyncCoordinator::~NftSyncCoordinator() {
  if (impl_) {
    impl_->cancelAll();
  }
}

NftSyncStartResult NftSyncCoordinator::syncAddress(
    std::string address,
    bool replaceExisting,
    NftSyncCompletion completion) {
  return impl_->syncAddress(
      std::move(address), replaceExisting, std::move(completion));
}

void NftSyncCoordinator::cancelAddress(const std::string& address) {
  impl_->cancelAddress(address);
}

void NftSyncCoordinator::cancelAll() {
  impl_->cancelAll();
}

std::size_t NftSyncCoordinator::activeSyncCount() const {
  return impl_->activeSyncCount();
}

const char* nftSyncStageName(NftSyncStage stage) {
  switch (stage) {
    case NftSyncStage::None:
      return "none";
    case NftSyncStage::NftList:
      return "nft_list";
    case NftSyncStage::CollectionList:
      return "collection_list";
    case NftSyncStage::Persistence:
      return "persistence";
    case NftSyncStage::Cancelled:
      return "cancelled";
    case NftSyncStage::Superseded:
      return "superseded";
  }
  return "unknown";
}

} // namespace rabby::openapi
