#include <rabby/openapi/RabbyOpenApiTokenSync.h>

#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include <algorithm>
#include <cctype>
#include <deque>
#include <iterator>
#include <mutex>
#include <optional>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace rabby::openapi {
namespace {

bool isSuccessfulHttpStatus(int statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

std::string describeRequestFailure(
    const std::string& requestName,
    const std::string& context,
    const OpenApiClientResult& result) {
  std::string description = requestName + " request failed";
  if (!context.empty()) {
    description += " for " + context;
  }
  if (result.response.has_value()) {
    return description + ": HTTP " +
        std::to_string(result.response->statusCode);
  }
  if (result.transportError.has_value()) {
    return description + ": transport " +
        http::errorCodeName(result.transportError->code);
  }
  if (result.failureStage != OpenApiClientFailureStage::None) {
    return description + ": " +
        openApiClientFailureStageName(result.failureStage);
  }
  return description;
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
  if (!std::all_of(address.begin() + 2, address.end(), [](unsigned char value) {
        return std::isxdigit(value) != 0;
      })) {
    return "address must contain hexadecimal characters only";
  }
  return {};
}

std::string validateChainId(const std::string& chainId) {
  if (chainId.empty() || chainId.size() > 64) {
    return "chain id must contain between 1 and 64 characters";
  }
  const auto valid = std::all_of(
      chainId.begin(), chainId.end(), [](unsigned char value) {
        return std::isalnum(value) != 0 || value == '_' || value == '-' ||
            value == '.';
      });
  return valid ? std::string{} : "chain id contains unsupported characters";
}

std::optional<std::vector<std::string>> normalizeChainIds(
    std::vector<std::string> chainIds,
    std::string& error) {
  std::vector<std::string> normalized;
  std::set<std::string> seen;
  normalized.reserve(chainIds.size());
  for (auto& chainId : chainIds) {
    if (const auto validationError = validateChainId(chainId);
        !validationError.empty()) {
      error = validationError;
      return std::nullopt;
    }
    if (seen.insert(chainId).second) {
      normalized.push_back(std::move(chainId));
    }
  }
  return normalized;
}

bool haveSameChainIds(
    const std::vector<std::string>& left,
    const std::vector<std::string>& right) {
  return std::set<std::string>(left.begin(), left.end()) ==
      std::set<std::string>(right.begin(), right.end());
}

std::string responseBody(const http::Response& response) {
  if (response.body.empty()) {
    return {};
  }
  return std::string(
      reinterpret_cast<const char*>(response.body.data()),
      response.body.size());
}

OpenApiClientRequest makeUsedChainsRequest(const std::string& address) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/used_chain_list";
  request.query = {{"id", address}};
  request.timeoutMs = 15000;
  request.maxResponseBytes = 1024U * 1024U;
  return request;
}

OpenApiClientRequest makeTokenListRequest(
    const std::string& address,
    const std::string& chainId) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/token_list";
  request.query = {
      {"id", address},
      {"chain_id", chainId},
      {"is_all", "true"},
  };
  request.timeoutMs = 30000;
  request.maxResponseBytes = 64U * 1024U * 1024U;
  return request;
}

struct Subscriber {
  TokenSyncCompletion completion;
};

struct Operation {
  std::string address;
  std::string requestKey;
  std::uint64_t generation{0};
  std::int64_t startedAtMs{0};
  TokenSyncStage stage{TokenSyncStage::UsedChains};
  TokenCacheReplacementScope replacementScope;
  bool finished{false};
  bool committing{false};
  bool queuedForTokenDispatch{false};
  std::size_t nextRequestSlot{1};
  std::unordered_set<std::size_t> pendingSlots;
  std::unordered_set<std::size_t> tokenRequestSlots;
  std::unordered_map<std::size_t, std::shared_ptr<http::RequestHandle>> handles;
  std::vector<Subscriber> subscribers;
  std::vector<std::string> chainIds;
  std::size_t nextChainIndex{0};
  std::size_t inFlightTokenRequests{0};
  std::size_t completedTokenRequests{0};
  std::size_t sourceTokenCount{0};
  std::size_t filteredTokenCount{0};
  std::vector<NativeTokenRecord> tokens;
};

struct FinishedOperation {
  bool valid{false};
  TokenSyncResult result;
  std::vector<Subscriber> subscribers;
  std::vector<std::shared_ptr<http::RequestHandle>> handles;
};

struct ConsumedRequestSlot {
  bool found{false};
  bool current{false};
  bool tokenRequest{false};
};

struct TokenDispatch {
  std::shared_ptr<Operation> operation;
  std::string chainId;
  std::size_t slot{0};
};

std::string makeRequestKey(
    bool resolvesUsedChains,
    const std::vector<std::string>& chainIds,
    const TokenCacheReplacementScope& replacementScope) {
  std::string key = resolvesUsedChains ? "used:" : "chains:";
  key += replacementScope.kind == TokenCacheReplacementKind::Address
      ? "address:"
      : "selected:";
  for (const auto& chainId : chainIds) {
    key += chainId;
    key.push_back(',');
  }
  return key;
}

} // namespace

class TokenSyncCoordinator::Impl
    : public std::enable_shared_from_this<TokenSyncCoordinator::Impl> {
 public:
  Impl(
      OpenApiExecute execute,
      std::shared_ptr<TokenCachePersistence> persistence,
      MillisecondsProvider millisecondsProvider,
      std::size_t maximumConcurrentTokenRequests)
      : execute_(std::move(execute)),
        persistence_(std::move(persistence)),
        millisecondsProvider_(std::move(millisecondsProvider)),
        maximumConcurrentTokenRequests_(maximumConcurrentTokenRequests) {}

  TokenSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      TokenSyncCompletion completion) {
    return start(
        std::move(address),
        {},
        TokenCacheReplacementScope{},
        true,
        replaceExisting,
        std::move(completion));
  }

  TokenSyncStartResult syncChains(
      std::string address,
      std::vector<std::string> chainIds,
      TokenCacheReplacementScope replacementScope,
      bool replaceExisting,
      TokenSyncCompletion completion) {
    return start(
        std::move(address),
        std::move(chainIds),
        std::move(replacementScope),
        false,
        replaceExisting,
        std::move(completion));
  }

  void cancelAddress(const std::string& rawAddress) {
    const auto address = normalizeAddress(rawAddress);
    FinishedOperation cancelled;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto active = activeOperations_.find(address);
      if (active != activeOperations_.end()) {
        cancelled = finishLocked(
            active->second,
            TokenSyncStage::Cancelled,
            "token sync was cancelled",
            false);
      }
    }
    deliver(std::move(cancelled));
    pumpTokenRequests();
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
      cancelled.reserve(operations.size());
      for (const auto& operation : operations) {
        cancelled.push_back(finishLocked(
            operation,
            TokenSyncStage::Cancelled,
            "token sync was cancelled",
            false));
      }
    }

    // A clear-cache caller must not return while an older native transaction
    // can still repopulate the database.
    {
      std::lock_guard<std::mutex> commitLock(commitMutex_);
    }

    for (auto& operation : cancelled) {
      deliver(std::move(operation));
    }
    pumpTokenRequests();
  }

  std::size_t activeSyncCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return activeOperations_.size();
  }

 private:
  using ResponseHandler =
      std::function<void(std::size_t, OpenApiClientResult)>;

  TokenSyncStartResult start(
      std::string address,
      std::vector<std::string> chainIds,
      TokenCacheReplacementScope replacementScope,
      bool resolvesUsedChains,
      bool replaceExisting,
      TokenSyncCompletion completion) {
    address = normalizeAddress(std::move(address));
    TokenSyncStage validationStage = resolvesUsedChains
        ? TokenSyncStage::UsedChains
        : TokenSyncStage::TokenLists;
    if (const auto error = validateAddress(address); !error.empty()) {
      return rejectStart(
          address, validationStage, error, std::move(completion));
    }
    if (!execute_ || !persistence_ || !millisecondsProvider_ ||
        maximumConcurrentTokenRequests_ == 0) {
      return rejectStart(
          address,
          validationStage,
          "native token sync is unavailable",
          std::move(completion));
    }

    std::string chainError;
    auto normalizedChainIds =
        normalizeChainIds(std::move(chainIds), chainError);
    if (!normalizedChainIds.has_value()) {
      return rejectStart(
          address, validationStage, chainError, std::move(completion));
    }
    chainIds = std::move(*normalizedChainIds);

    if (resolvesUsedChains) {
      replacementScope = {};
    } else if (replacementScope.kind == TokenCacheReplacementKind::Chains) {
      auto normalizedScopeChainIds =
          normalizeChainIds(std::move(replacementScope.chainIds), chainError);
      if (!normalizedScopeChainIds.has_value()) {
        return rejectStart(
            address, validationStage, chainError, std::move(completion));
      }
      replacementScope.chainIds = std::move(*normalizedScopeChainIds);
      if (chainIds.empty()) {
        return rejectStart(
            address,
            validationStage,
            "selected-chain replacement requires at least one chain",
            std::move(completion));
      }
      if (!haveSameChainIds(chainIds, replacementScope.chainIds)) {
        return rejectStart(
            address,
            validationStage,
            "requested chains and replacement scope must match",
            std::move(completion));
      }
    } else {
      replacementScope.chainIds.clear();
    }

    const auto requestKey =
        makeRequestKey(resolvesUsedChains, chainIds, replacementScope);
    std::shared_ptr<Operation> operation;
    FinishedOperation superseded;
    TokenSyncCompletion rejectedCompletion;
    TokenSyncResult rejectedResult;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto active = activeOperations_.find(address);
      if (active != activeOperations_.end() && !active->second->finished &&
          !replaceExisting) {
        if (active->second->requestKey == requestKey) {
          if (completion) {
            active->second->subscribers.push_back({std::move(completion)});
          }
          return {true, true, active->second->generation, {}};
        }
        rejectedResult.address = address;
        rejectedResult.stage = validationStage;
        rejectedResult.error =
            "a different token sync is already active for this address";
        rejectedCompletion = std::move(completion);
      } else {
        if (active != activeOperations_.end()) {
          superseded = finishLocked(
              active->second,
              TokenSyncStage::Superseded,
              "token sync was superseded by a newer generation",
              false);
        }

        operation = std::make_shared<Operation>();
        operation->address = address;
        operation->requestKey = requestKey;
        operation->generation = ++generations_[address];
        operation->startedAtMs = millisecondsProvider_();
        operation->stage = validationStage;
        operation->replacementScope = std::move(replacementScope);
        operation->chainIds = std::move(chainIds);
        if (completion) {
          operation->subscribers.push_back({std::move(completion)});
        }
        activeOperations_[address] = operation;
      }
    }

    if (rejectedCompletion) {
      rejectedCompletion(rejectedResult);
      return {false, false, 0, rejectedResult.error};
    }
    deliver(std::move(superseded));
    pumpTokenRequests();

    if (resolvesUsedChains) {
      dispatchUsedChains(operation);
    } else if (operation->chainIds.empty()) {
      commit(operation);
    } else {
      enqueueTokenRequests(operation);
    }
    return {true, false, operation->generation, {}};
  }

  static TokenSyncStartResult rejectStart(
      const std::string& address,
      TokenSyncStage stage,
      const std::string& error,
      TokenSyncCompletion completion) {
    TokenSyncResult result;
    result.address = address;
    result.stage = stage;
    result.error = error;
    if (completion) {
      completion(std::move(result));
    }
    return {false, false, 0, error};
  }

  bool isCurrentLocked(const std::shared_ptr<Operation>& operation) const {
    const auto current = activeOperations_.find(operation->address);
    return current != activeOperations_.end() &&
        current->second == operation && !operation->finished;
  }

  std::size_t reserveRequestSlotLocked(
      const std::shared_ptr<Operation>& operation,
      bool tokenRequest) {
    const auto slot = operation->nextRequestSlot++;
    operation->pendingSlots.insert(slot);
    if (tokenRequest) {
      operation->tokenRequestSlots.insert(slot);
      ++operation->inFlightTokenRequests;
      ++activeTokenRequestCount_;
    }
    return slot;
  }

  void dispatchRequest(
      const std::shared_ptr<Operation>& operation,
      OpenApiClientRequest request,
      ResponseHandler handler) {
    std::size_t slot = 0;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      slot = reserveRequestSlotLocked(operation, false);
    }
    executeReservedRequest(
        operation, slot, std::move(request), std::move(handler));
  }

  void executeReservedRequest(
      const std::shared_ptr<Operation>& operation,
      std::size_t slot,
      OpenApiClientRequest request,
      ResponseHandler handler) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) ||
          operation->pendingSlots.count(slot) == 0) {
        return;
      }
    }

    auto weakSelf = weak_from_this();
    auto sharedHandler =
        std::make_shared<ResponseHandler>(std::move(handler));
    auto handle = execute_(
        std::move(request),
        [weakSelf, operation, slot, sharedHandler](
            OpenApiClientResult result) mutable {
          if (auto self = weakSelf.lock()) {
            (*sharedHandler)(slot, std::move(result));
          }
        });

    bool missingCompletion = false;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (operation->pendingSlots.count(slot) != 0) {
        if (handle) {
          operation->handles[slot] = std::move(handle);
        } else {
          missingCompletion = true;
        }
      }
    }
    if (missingCompletion) {
      OpenApiClientResult result;
      result.failureStage = OpenApiClientFailureStage::Transport;
      result.error = "native request did not start";
      (*sharedHandler)(slot, std::move(result));
    }
  }

  ConsumedRequestSlot consumeRequestSlotLocked(
      const std::shared_ptr<Operation>& operation,
      std::size_t slot) {
    ConsumedRequestSlot consumed;
    if (operation->pendingSlots.erase(slot) == 0) {
      return consumed;
    }
    consumed.found = true;
    operation->handles.erase(slot);
    if (operation->tokenRequestSlots.erase(slot) != 0) {
      consumed.tokenRequest = true;
      if (operation->inFlightTokenRequests > 0) {
        --operation->inFlightTokenRequests;
      }
      if (activeTokenRequestCount_ > 0) {
        --activeTokenRequestCount_;
      }
    }
    consumed.current = isCurrentLocked(operation);
    return consumed;
  }

  void dispatchUsedChains(const std::shared_ptr<Operation>& operation) {
    auto weakSelf = weak_from_this();
    dispatchRequest(
        operation,
        makeUsedChainsRequest(operation->address),
        [weakSelf, operation](
            std::size_t slot, OpenApiClientResult result) mutable {
          if (auto self = weakSelf.lock()) {
            self->handleUsedChains(operation, slot, std::move(result));
          }
        });
  }

  void handleUsedChains(
      const std::shared_ptr<Operation>& operation,
      std::size_t slot,
      OpenApiClientResult result) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      const auto consumed = consumeRequestSlotLocked(operation, slot);
      if (!consumed.found || !consumed.current) {
        return;
      }
    }

    if (!result.isSuccess() || !result.response.has_value() ||
        !isSuccessfulHttpStatus(result.response->statusCode)) {
      fail(
          operation,
          TokenSyncStage::UsedChains,
          describeRequestFailure("used-chain", {}, result));
      return;
    }
    auto parsed = parseUsedChainListResponse(responseBody(*result.response));
    if (!parsed.isSuccess()) {
      fail(operation, TokenSyncStage::UsedChains, std::move(parsed.error));
      return;
    }

    std::string chainError;
    auto normalizedChainIds =
        normalizeChainIds(std::move(parsed.chainIds), chainError);
    if (!normalizedChainIds.has_value()) {
      fail(operation, TokenSyncStage::UsedChains, std::move(chainError));
      return;
    }

    bool commitEmptySnapshot = false;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      operation->stage = TokenSyncStage::TokenLists;
      operation->chainIds = std::move(*normalizedChainIds);
      operation->requestKey = makeRequestKey(
          true, operation->chainIds, operation->replacementScope);
      commitEmptySnapshot = operation->chainIds.empty();
    }
    if (commitEmptySnapshot) {
      commit(operation);
    } else {
      enqueueTokenRequests(operation);
    }
  }

  void enqueueTokenRequests(const std::shared_ptr<Operation>& operation) {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || operation->committing ||
          operation->queuedForTokenDispatch ||
          operation->nextChainIndex >= operation->chainIds.size()) {
        return;
      }
      operation->queuedForTokenDispatch = true;
      readyTokenOperations_.push_back(operation);
    }
    pumpTokenRequests();
  }

  void pumpTokenRequests() {
    std::vector<TokenDispatch> dispatches;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      while (activeTokenRequestCount_ < maximumConcurrentTokenRequests_ &&
             !readyTokenOperations_.empty()) {
        auto operation = std::move(readyTokenOperations_.front());
        readyTokenOperations_.pop_front();
        operation->queuedForTokenDispatch = false;
        if (!isCurrentLocked(operation) || operation->committing ||
            operation->nextChainIndex >= operation->chainIds.size()) {
          continue;
        }

        const auto chainId =
            operation->chainIds[operation->nextChainIndex++];
        const auto slot = reserveRequestSlotLocked(operation, true);
        dispatches.push_back({operation, chainId, slot});

        if (operation->nextChainIndex < operation->chainIds.size()) {
          operation->queuedForTokenDispatch = true;
          readyTokenOperations_.push_back(operation);
        }
      }
    }

    for (auto& dispatch : dispatches) {
      auto weakSelf = weak_from_this();
      executeReservedRequest(
          dispatch.operation,
          dispatch.slot,
          makeTokenListRequest(dispatch.operation->address, dispatch.chainId),
          [weakSelf,
           operation = dispatch.operation,
           chainId = dispatch.chainId](
              std::size_t slot, OpenApiClientResult result) mutable {
            if (auto self = weakSelf.lock()) {
              self->handleTokenList(
                  operation, slot, chainId, std::move(result));
            }
          });
    }
  }

  void handleTokenList(
      const std::shared_ptr<Operation>& operation,
      std::size_t slot,
      const std::string& chainId,
      OpenApiClientResult result) {
    ConsumedRequestSlot consumed;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      consumed = consumeRequestSlotLocked(operation, slot);
    }
    if (!consumed.found) {
      return;
    }
    if (!consumed.current) {
      pumpTokenRequests();
      return;
    }

    if (!result.isSuccess() || !result.response.has_value() ||
        !isSuccessfulHttpStatus(result.response->statusCode)) {
      fail(
          operation,
          TokenSyncStage::TokenLists,
          describeRequestFailure(
              "token-list", "chain " + chainId, result));
      return;
    }
    auto parsed =
        parseTokenListResponse(operation->address, responseBody(*result.response));
    if (!parsed.isSuccess()) {
      fail(operation, TokenSyncStage::TokenLists, std::move(parsed.error));
      return;
    }
    if (std::any_of(
            parsed.tokens.begin(),
            parsed.tokens.end(),
            [&chainId](const NativeTokenRecord& token) {
              return token.chain != chainId;
            })) {
      fail(
          operation,
          TokenSyncStage::TokenLists,
          "token-list response contains a different chain");
      return;
    }

    bool readyToCommit = false;
    bool operationIsCurrent = false;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      operationIsCurrent = isCurrentLocked(operation);
      if (operationIsCurrent) {
        ++operation->completedTokenRequests;
        operation->sourceTokenCount += parsed.sourceItemCount;
        operation->filteredTokenCount += parsed.filteredItemCount;
        operation->tokens.insert(
            operation->tokens.end(),
            std::make_move_iterator(parsed.tokens.begin()),
            std::make_move_iterator(parsed.tokens.end()));
        readyToCommit =
            operation->completedTokenRequests == operation->chainIds.size();
      }
    }
    pumpTokenRequests();
    if (operationIsCurrent && readyToCommit) {
      commit(operation);
    }
  }

  void commit(const std::shared_ptr<Operation>& operation) {
    std::vector<NativeTokenRecord> tokens;
    TokenCacheReplacementScope replacementScope;
    std::vector<std::string> chainIds;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation) || operation->committing) {
        return;
      }
      operation->committing = true;
      operation->stage = TokenSyncStage::Persistence;
      tokens = operation->tokens;
      replacementScope = operation->replacementScope;
      chainIds = operation->chainIds;
    }
    if (tokens.empty()) {
      if (replacementScope.kind == TokenCacheReplacementKind::Chains) {
        tokens.reserve(chainIds.size());
        for (const auto& chainId : chainIds) {
          tokens.push_back(makeEmptyTokenRecord(operation->address, chainId));
        }
      } else {
        tokens.push_back(makeEmptyTokenRecord(operation->address));
      }
    }

    TokenCacheCommitResult commitResult;
    {
      std::lock_guard<std::mutex> commitLock(commitMutex_);
      {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!isCurrentLocked(operation)) {
          return;
        }
      }
      commitResult = persistence_->commitSnapshot(
          operation->address,
          tokens,
          millisecondsProvider_(),
          replacementScope);
    }

    if (!commitResult.success) {
      fail(
          operation,
          TokenSyncStage::Persistence,
          commitResult.error.empty()
              ? "token cache transaction failed"
              : std::move(commitResult.error));
      return;
    }

    FinishedOperation finished;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      TokenSyncResult result = makeResultLocked(operation);
      result.success = true;
      result.stage = TokenSyncStage::Persistence;
      result.committedRowCount = commitResult.rowCount;
      finished = finishLocked(operation, std::move(result));
    }
    deliver(std::move(finished));
    pumpTokenRequests();
  }

  void fail(
      const std::shared_ptr<Operation>& operation,
      TokenSyncStage stage,
      std::string error) {
    FinishedOperation finished;
    {
      std::lock_guard<std::mutex> lock(mutex_);
      if (!isCurrentLocked(operation)) {
        return;
      }
      finished = finishLocked(
          operation, stage, std::move(error), false);
    }
    deliver(std::move(finished));
    pumpTokenRequests();
  }

  TokenSyncResult makeResultLocked(
      const std::shared_ptr<Operation>& operation) const {
    TokenSyncResult result;
    result.address = operation->address;
    result.generation = operation->generation;
    result.stage = operation->stage;
    result.chainCount = operation->chainIds.size();
    result.sourceTokenCount = operation->sourceTokenCount;
    result.filteredTokenCount = operation->filteredTokenCount;
    result.durationMs = std::max<std::int64_t>(
        0, millisecondsProvider_() - operation->startedAtMs);
    return result;
  }

  FinishedOperation finishLocked(
      std::shared_ptr<Operation> operation,
      TokenSyncStage stage,
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
      TokenSyncResult result) {
    FinishedOperation finished;
    if (operation->finished) {
      return finished;
    }
    operation->finished = true;
    const auto current = activeOperations_.find(operation->address);
    if (current != activeOperations_.end() && current->second == operation) {
      activeOperations_.erase(current);
    }

    readyTokenOperations_.erase(
        std::remove(
            readyTokenOperations_.begin(),
            readyTokenOperations_.end(),
            operation),
        readyTokenOperations_.end());
    operation->queuedForTokenDispatch = false;

    const auto tokenSlotCount = operation->tokenRequestSlots.size();
    activeTokenRequestCount_ = tokenSlotCount > activeTokenRequestCount_
        ? 0
        : activeTokenRequestCount_ - tokenSlotCount;
    operation->inFlightTokenRequests = 0;
    operation->tokenRequestSlots.clear();

    finished.valid = true;
    finished.result = std::move(result);
    finished.subscribers = std::move(operation->subscribers);
    finished.handles.reserve(operation->handles.size());
    for (auto& entry : operation->handles) {
      if (entry.second) {
        finished.handles.push_back(std::move(entry.second));
      }
    }
    operation->handles.clear();
    operation->pendingSlots.clear();
    return finished;
  }

  static void deliver(FinishedOperation finished) {
    if (!finished.valid) {
      return;
    }
    for (const auto& handle : finished.handles) {
      handle->cancel();
    }
    for (auto& subscriber : finished.subscribers) {
      if (subscriber.completion) {
        subscriber.completion(finished.result);
      }
    }
  }

  OpenApiExecute execute_;
  std::shared_ptr<TokenCachePersistence> persistence_;
  MillisecondsProvider millisecondsProvider_;
  std::size_t maximumConcurrentTokenRequests_{15};
  mutable std::mutex mutex_;
  std::mutex commitMutex_;
  std::size_t activeTokenRequestCount_{0};
  std::deque<std::shared_ptr<Operation>> readyTokenOperations_;
  std::unordered_map<std::string, std::shared_ptr<Operation>> activeOperations_;
  std::unordered_map<std::string, std::uint64_t> generations_;
};

TokenSyncCoordinator::TokenSyncCoordinator(
    OpenApiExecute execute,
    std::shared_ptr<TokenCachePersistence> persistence,
    MillisecondsProvider millisecondsProvider,
    std::size_t maximumConcurrentTokenRequests)
    : impl_(std::make_shared<Impl>(
          std::move(execute),
          std::move(persistence),
          std::move(millisecondsProvider),
          maximumConcurrentTokenRequests)) {}

TokenSyncCoordinator::~TokenSyncCoordinator() {
  if (impl_) {
    impl_->cancelAll();
  }
}

TokenSyncStartResult TokenSyncCoordinator::syncAddress(
    std::string address,
    bool replaceExisting,
    TokenSyncCompletion completion) {
  return impl_->syncAddress(
      std::move(address), replaceExisting, std::move(completion));
}

TokenSyncStartResult TokenSyncCoordinator::syncChains(
    std::string address,
    std::vector<std::string> chainIds,
    TokenCacheReplacementScope replacementScope,
    bool replaceExisting,
    TokenSyncCompletion completion) {
  return impl_->syncChains(
      std::move(address),
      std::move(chainIds),
      std::move(replacementScope),
      replaceExisting,
      std::move(completion));
}

void TokenSyncCoordinator::cancelAddress(const std::string& address) {
  impl_->cancelAddress(address);
}

void TokenSyncCoordinator::cancelAll() {
  impl_->cancelAll();
}

std::size_t TokenSyncCoordinator::activeSyncCount() const {
  return impl_->activeSyncCount();
}

const char* tokenSyncStageName(TokenSyncStage stage) {
  switch (stage) {
    case TokenSyncStage::None:
      return "none";
    case TokenSyncStage::UsedChains:
      return "used_chains";
    case TokenSyncStage::TokenLists:
      return "token_lists";
    case TokenSyncStage::Persistence:
      return "persistence";
    case TokenSyncStage::Cancelled:
      return "cancelled";
    case TokenSyncStage::Superseded:
      return "superseded";
  }
  return "unknown";
}

} // namespace rabby::openapi
