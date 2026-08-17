#include <rabby/openapi/RabbyOpenApiTokenSync.h>

#include <cassert>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <future>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace {

using rabby::openapi::OpenApiClientCompletion;
using rabby::openapi::OpenApiClientRequest;
using rabby::openapi::OpenApiClientResult;
using rabby::openapi::TokenCacheCommitResult;
using rabby::openapi::TokenCacheReplacementKind;
using rabby::openapi::TokenCacheReplacementScope;
using rabby::openapi::TokenSyncCoordinator;
using rabby::openapi::TokenSyncResult;
using rabby::openapi::TokenSyncStage;

constexpr const char* kAddress =
    "0x1111111111111111111111111111111111111111";

class FakeRequestHandle final : public rabby::http::RequestHandle {
 public:
  explicit FakeRequestHandle(std::uint64_t id) : id_(id) {}

  std::uint64_t requestId() const override {
    return id_;
  }

  void cancel() override {
    cancelled = true;
  }

  bool cancelled{false};

 private:
  std::uint64_t id_;
};

class FakeExecutor {
 public:
  struct Pending {
    OpenApiClientRequest request;
    OpenApiClientCompletion completion;
    std::shared_ptr<FakeRequestHandle> handle;
  };

  std::shared_ptr<rabby::http::RequestHandle> execute(
      OpenApiClientRequest request,
      OpenApiClientCompletion completion) {
    auto handle = std::make_shared<FakeRequestHandle>(nextRequestId_++);
    pending.push_back(
        {std::move(request), std::move(completion), handle});
    return handle;
  }

  void complete(
      std::size_t index,
      int statusCode,
      const std::string& body,
      std::string error = {}) {
    auto completion = std::move(pending.at(index).completion);
    assert(completion);
    OpenApiClientResult result;
    result.error = std::move(error);
    if (result.error.empty()) {
      rabby::http::Response response;
      response.statusCode = statusCode;
      response.body.assign(body.begin(), body.end());
      result.response = std::move(response);
    }
    completion(std::move(result));
  }

  std::vector<Pending> pending;

 private:
  std::uint64_t nextRequestId_{1};
};

class FakePersistence final : public rabby::openapi::TokenCachePersistence {
 public:
  TokenCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const std::vector<rabby::openapi::NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const TokenCacheReplacementScope& replacementScope) override {
    ++commitCount;
    lastOwnerAddress = ownerAddress;
    lastTokens = tokens;
    lastSyncTimestampMs = syncTimestampMs;
    lastReplacementScope = replacementScope;
    if (!error.empty()) {
      return {false, 0, error};
    }
    return {true, tokens.size(), {}};
  }

  TokenCacheCommitResult verifyWriteContract(std::int64_t) override {
    return {true, 1, {}};
  }

  int commitCount{0};
  std::string lastOwnerAddress;
  std::vector<rabby::openapi::NativeTokenRecord> lastTokens;
  std::int64_t lastSyncTimestampMs{0};
  TokenCacheReplacementScope lastReplacementScope;
  std::string error;
};

class BlockingPersistence final
    : public rabby::openapi::TokenCachePersistence {
 public:
  TokenCacheCommitResult commitSnapshot(
      const std::string&,
      const std::vector<rabby::openapi::NativeTokenRecord>& tokens,
      std::int64_t,
      const TokenCacheReplacementScope&) override {
    std::unique_lock<std::mutex> lock(mutex_);
    commitStarted_ = true;
    condition_.notify_all();
    condition_.wait(lock, [this]() { return releaseCommit_; });
    ++commitCount;
    return {true, tokens.size(), {}};
  }

  TokenCacheCommitResult verifyWriteContract(std::int64_t) override {
    return {true, 1, {}};
  }

  void waitUntilCommitStarts() {
    std::unique_lock<std::mutex> lock(mutex_);
    condition_.wait(lock, [this]() { return commitStarted_; });
  }

  void releaseCommit() {
    {
      std::lock_guard<std::mutex> lock(mutex_);
      releaseCommit_ = true;
    }
    condition_.notify_all();
  }

  int commitCount{0};

 private:
  std::mutex mutex_;
  std::condition_variable condition_;
  bool commitStarted_{false};
  bool releaseCommit_{false};
};

OpenApiClientResult successfulResult(
    int statusCode,
    const std::string& body) {
  OpenApiClientResult result;
  rabby::http::Response response;
  response.statusCode = statusCode;
  response.body.assign(body.begin(), body.end());
  result.response = std::move(response);
  return result;
}

std::shared_ptr<TokenSyncCoordinator> makeCoordinator(
    const std::shared_ptr<FakeExecutor>& executor,
    const std::shared_ptr<FakePersistence>& persistence,
    std::size_t concurrency = 15) {
  auto now = std::make_shared<std::int64_t>(1000);
  return std::make_shared<TokenSyncCoordinator>(
      [executor](
          OpenApiClientRequest request,
          OpenApiClientCompletion completion) {
        return executor->execute(
            std::move(request), std::move(completion));
      },
      persistence,
      [now]() {
        *now += 10;
        return *now;
      },
      concurrency);
}

std::string usedChainsJson(std::size_t count) {
  std::string result = "[";
  for (std::size_t index = 0; index < count; ++index) {
    if (index != 0) {
      result += ',';
    }
    result += "{\"id\":\"chain" + std::to_string(index) + "\"}";
  }
  result += ']';
  return result;
}

std::string tokenJson(std::size_t index) {
  return "[{\"id\":\"token" + std::to_string(index) +
      "\",\"chain\":\"chain" + std::to_string(index) +
      "\",\"amount\":1,\"price\":2}]";
}

std::string tokenJsonForChain(
    const std::string& chainId,
    const std::string& tokenId) {
  return "[{\"id\":\"" + tokenId + "\",\"chain\":\"" + chainId +
      "\",\"amount\":1,\"price\":2}]";
}

void testCoalescingConcurrencyAndCommit() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> firstResult;
  std::optional<TokenSyncResult> joinedResult;

  const auto first = coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult result) { firstResult = std::move(result); });
  const auto joined = coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult result) { joinedResult = std::move(result); });

  assert(first.accepted && !first.joinedExisting);
  assert(joined.accepted && joined.joinedExisting);
  assert(first.generation == joined.generation);
  assert(executor->pending.size() == 1);

  executor->complete(0, 200, usedChainsJson(16));
  assert(executor->pending.size() == 16);

  executor->complete(1, 200, tokenJson(0));
  assert(executor->pending.size() == 17);
  for (std::size_t index = 2; index < 17; ++index) {
    executor->complete(index, 200, tokenJson(index - 1));
  }

  assert(firstResult.has_value());
  assert(joinedResult.has_value());
  assert(firstResult->success);
  assert(joinedResult->success);
  assert(firstResult->generation == joinedResult->generation);
  assert(firstResult->chainCount == 16);
  assert(firstResult->sourceTokenCount == 16);
  assert(firstResult->committedRowCount == 16);
  assert(firstResult->committedAtMs == persistence->lastSyncTimestampMs);
  assert(firstResult->committedAtMs > 0);
  assert(firstResult->durationMs > 0);
  assert(persistence->commitCount == 1);
  assert(persistence->lastOwnerAddress == kAddress);
  assert(persistence->lastTokens.size() == 16);
  assert(coordinator->activeSyncCount() == 0);
}

void testFailureCancelsSiblingsAndDoesNotCommit() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> result;

  coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) { result = std::move(value); });
  executor->complete(0, 200, usedChainsJson(2));
  assert(executor->pending.size() == 3);

  executor->complete(1, 429, R"({"error":"rate limited"})");

  assert(result.has_value());
  assert(!result->success);
  assert(result->stage == TokenSyncStage::TokenLists);
  assert(
      result->error ==
      "token-list request failed for chain chain0: HTTP 429");
  assert(persistence->commitCount == 0);
  assert(executor->pending[2].handle->cancelled);
  assert(coordinator->activeSyncCount() == 0);
}

void testRequestFailureDiagnosticsStayBounded() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> result;

  coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) { result = std::move(value); });

  auto completion = std::move(executor->pending.at(0).completion);
  OpenApiClientResult failure;
  failure.failureStage =
      rabby::openapi::OpenApiClientFailureStage::Transport;
  failure.transportError = rabby::http::Error{
      rabby::http::ErrorCode::Timeout,
      "sensitive upstream detail must not be copied",
      30,
  };
  failure.error = "sensitive client detail must not be copied";
  completion(std::move(failure));

  assert(result.has_value());
  assert(!result->success);
  assert(result->stage == TokenSyncStage::UsedChains);
  assert(result->error == "used-chain request failed: transport timeout");
}

void testReplacementSupersedesOldGeneration() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> oldResult;
  std::optional<TokenSyncResult> newResult;

  const auto oldStart = coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) { oldResult = std::move(value); });
  const auto newStart = coordinator->syncAddress(
      kAddress,
      true,
      [&](TokenSyncResult value) { newResult = std::move(value); });

  assert(oldResult.has_value());
  assert(oldResult->stage == TokenSyncStage::Superseded);
  assert(!oldResult->success);
  assert(executor->pending[0].handle->cancelled);
  assert(newStart.generation == oldStart.generation + 1);
  assert(executor->pending.size() == 2);

  executor->complete(0, 200, "[]");
  assert(persistence->commitCount == 0);
  executor->complete(1, 200, "[]");

  assert(newResult.has_value());
  assert(newResult->success);
  assert(newResult->generation == newStart.generation);
  assert(persistence->commitCount == 1);
  assert(persistence->lastTokens.size() == 1);
  assert(
      persistence->lastTokens[0].id ==
      rabby::openapi::kEmptyTokenItemId);
}

void testCancellationAndPersistenceFailure() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> cancelledResult;

  coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) { cancelledResult = std::move(value); });
  coordinator->cancelAll();
  assert(cancelledResult.has_value());
  assert(cancelledResult->stage == TokenSyncStage::Cancelled);
  assert(executor->pending[0].handle->cancelled);
  assert(coordinator->activeSyncCount() == 0);

  persistence->error = "database unavailable";
  std::optional<TokenSyncResult> persistenceResult;
  coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) {
        persistenceResult = std::move(value);
      });
  executor->complete(1, 200, "[]");
  assert(persistenceResult.has_value());
  assert(!persistenceResult->success);
  assert(persistenceResult->stage == TokenSyncStage::Persistence);
  assert(persistenceResult->error == "database unavailable");
}

void testSynchronousCompletionAndMissingHandle() {
  auto persistence = std::make_shared<FakePersistence>();
  std::optional<TokenSyncResult> synchronousResult;
  auto coordinator = std::make_shared<TokenSyncCoordinator>(
      [](OpenApiClientRequest, OpenApiClientCompletion completion) {
        completion(successfulResult(200, "[]"));
        return std::shared_ptr<rabby::http::RequestHandle>{};
      },
      persistence,
      []() { return 1000; });

  const auto start = coordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) {
        synchronousResult = std::move(value);
      });
  assert(start.accepted);
  assert(synchronousResult.has_value());
  assert(synchronousResult->success);
  assert(persistence->commitCount == 1);

  std::optional<TokenSyncResult> missingHandleResult;
  auto missingHandleCoordinator = std::make_shared<TokenSyncCoordinator>(
      [](OpenApiClientRequest, OpenApiClientCompletion) {
        return std::shared_ptr<rabby::http::RequestHandle>{};
      },
      std::make_shared<FakePersistence>(),
      []() { return 1000; });
  missingHandleCoordinator->syncAddress(
      kAddress,
      false,
      [&](TokenSyncResult value) {
        missingHandleResult = std::move(value);
      });
  assert(missingHandleResult.has_value());
  assert(!missingHandleResult->success);
  assert(missingHandleResult->stage == TokenSyncStage::UsedChains);
}

void testCancelAllWaitsForAnInFlightCommit() {
  auto persistence = std::make_shared<BlockingPersistence>();
  std::optional<TokenSyncResult> result;
  auto coordinator = std::make_shared<TokenSyncCoordinator>(
      [](OpenApiClientRequest, OpenApiClientCompletion completion) {
        completion(successfulResult(200, "[]"));
        return std::shared_ptr<rabby::http::RequestHandle>{};
      },
      persistence,
      []() { return 1000; });

  auto sync = std::async(std::launch::async, [&]() {
    coordinator->syncAddress(
        kAddress,
        false,
        [&](TokenSyncResult value) { result = std::move(value); });
  });
  persistence->waitUntilCommitStarts();

  std::promise<void> cancelStarted;
  auto cancel = std::async(std::launch::async, [&]() {
    cancelStarted.set_value();
    coordinator->cancelAll();
  });
  cancelStarted.get_future().wait();
  assert(
      cancel.wait_for(std::chrono::milliseconds(30)) ==
      std::future_status::timeout);
  assert(!result.has_value());

  persistence->releaseCommit();
  assert(
      cancel.wait_for(std::chrono::seconds(1)) ==
      std::future_status::ready);
  cancel.get();
  sync.get();

  assert(result.has_value());
  assert(!result->success);
  assert(result->stage == TokenSyncStage::Cancelled);
  assert(persistence->commitCount == 1);
  assert(coordinator->activeSyncCount() == 0);
}

void testExplicitChainsSkipUsedChainDiscoveryAndCommitSelectedScope() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> result;

  TokenCacheReplacementScope scope;
  scope.kind = TokenCacheReplacementKind::Chains;
  scope.chainIds = {"eth", "arb"};
  const auto start = coordinator->syncChains(
      kAddress,
      {"eth", "arb", "eth"},
      scope,
      true,
      [&](TokenSyncResult value) { result = std::move(value); });

  assert(start.accepted);
  assert(executor->pending.size() == 2);
  assert(executor->pending[0].request.uriPath == "/v1/user/token_list");
  assert(executor->pending[1].request.uriPath == "/v1/user/token_list");
  executor->complete(0, 200, "[]");
  executor->complete(1, 200, "[]");

  assert(result.has_value() && result->success);
  assert(result->chainCount == 2);
  assert(persistence->commitCount == 1);
  assert(
      persistence->lastReplacementScope.kind ==
      TokenCacheReplacementKind::Chains);
  assert(persistence->lastReplacementScope.chainIds.size() == 2);
  assert(persistence->lastTokens.size() == 2);
  assert(persistence->lastTokens[0].id == rabby::openapi::kEmptyTokenItemId);
  assert(persistence->lastTokens[0].chain == "eth");
  assert(persistence->lastTokens[1].chain == "arb");
}

void testExplicitChainResponseCannotEscapeItsScope() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::optional<TokenSyncResult> result;

  TokenCacheReplacementScope scope;
  scope.kind = TokenCacheReplacementKind::Chains;
  scope.chainIds = {"eth"};
  coordinator->syncChains(
      kAddress,
      {"eth"},
      scope,
      true,
      [&](TokenSyncResult value) { result = std::move(value); });
  executor->complete(0, 200, tokenJsonForChain("arb", "wrong-chain"));

  assert(result.has_value() && !result->success);
  assert(result->stage == TokenSyncStage::TokenLists);
  assert(result->error == "token-list response contains a different chain");
  assert(persistence->commitCount == 0);
}

void testTokenRequestConcurrencyIsGlobalAcrossAddresses() {
  constexpr const char* secondAddress =
      "0x2222222222222222222222222222222222222222";
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence, 2);
  std::optional<TokenSyncResult> firstResult;
  std::optional<TokenSyncResult> secondResult;
  TokenCacheReplacementScope scope;

  coordinator->syncChains(
      kAddress,
      {"chain0", "chain1", "chain2"},
      scope,
      true,
      [&](TokenSyncResult value) { firstResult = std::move(value); });
  assert(executor->pending.size() == 2);

  coordinator->syncChains(
      secondAddress,
      {"chain0", "chain1", "chain2"},
      scope,
      true,
      [&](TokenSyncResult value) { secondResult = std::move(value); });
  assert(executor->pending.size() == 2);

  std::size_t nextCompletion = 0;
  while (!firstResult.has_value() || !secondResult.has_value()) {
    assert(nextCompletion < executor->pending.size());
    const auto& request = executor->pending[nextCompletion].request;
    std::string chainId;
    for (const auto& query : request.query) {
      if (query.key == "chain_id" && query.value.has_value()) {
        chainId = *query.value;
      }
    }
    assert(!chainId.empty());
    executor->complete(
        nextCompletion,
        200,
        tokenJsonForChain(chainId, "token-" + std::to_string(nextCompletion)));
    ++nextCompletion;
    assert(executor->pending.size() <= nextCompletion + 2);
  }

  assert(firstResult->success);
  assert(secondResult->success);
  assert(persistence->commitCount == 2);
}

} // namespace

int main() {
  testCoalescingConcurrencyAndCommit();
  testFailureCancelsSiblingsAndDoesNotCommit();
  testRequestFailureDiagnosticsStayBounded();
  testReplacementSupersedesOldGeneration();
  testCancellationAndPersistenceFailure();
  testSynchronousCompletionAndMissingHandle();
  testCancelAllWaitsForAnInFlightCommit();
  testExplicitChainsSkipUsedChainDiscoveryAndCommitSelectedScope();
  testExplicitChainResponseCannotEscapeItsScope();
  testTokenRequestConcurrencyIsGlobalAcrossAddresses();
  return 0;
}
