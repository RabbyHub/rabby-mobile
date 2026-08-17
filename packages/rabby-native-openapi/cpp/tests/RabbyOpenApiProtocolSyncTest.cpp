#include <rabby/openapi/RabbyOpenApiProtocolSync.h>

#include <cassert>
#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace {

using rabby::openapi::AddressCacheCommitResult;
using rabby::openapi::AddressCacheContract;
using rabby::openapi::AddressCacheRow;
using rabby::openapi::OpenApiClientCompletion;
using rabby::openapi::OpenApiClientRequest;
using rabby::openapi::OpenApiClientResult;
using rabby::openapi::ProtocolSyncCoordinator;
using rabby::openapi::ProtocolSyncResult;
using rabby::openapi::ProtocolSyncStage;

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
    pending.push_back({std::move(request), std::move(completion), handle});
    return handle;
  }

  void complete(std::size_t index, int statusCode, const std::string& body) {
    auto completion = std::move(pending.at(index).completion);
    assert(completion);
    OpenApiClientResult result;
    rabby::http::Response response;
    response.statusCode = statusCode;
    response.body.assign(body.begin(), body.end());
    result.response = std::move(response);
    completion(std::move(result));
  }

  std::vector<Pending> pending;

 private:
  std::uint64_t nextRequestId_{1};
};

class FakePersistence final : public rabby::openapi::AddressCachePersistence {
 public:
  AddressCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const AddressCacheContract& contract,
      const std::vector<AddressCacheRow>& rows,
      std::int64_t syncTimestampMs) override {
    ++commitCount;
    lastOwnerAddress = ownerAddress;
    lastContract = contract;
    lastRows = rows;
    lastSyncTimestampMs = syncTimestampMs;
    return error.empty()
        ? AddressCacheCommitResult{true, rows.size(), {}}
        : AddressCacheCommitResult{false, 0, error};
  }

  int commitCount{0};
  std::string lastOwnerAddress;
  AddressCacheContract lastContract;
  std::vector<AddressCacheRow> lastRows;
  std::int64_t lastSyncTimestampMs{0};
  std::string error;
};

std::shared_ptr<ProtocolSyncCoordinator> makeCoordinator(
    const std::shared_ptr<FakeExecutor>& executor,
    const std::shared_ptr<FakePersistence>& persistence) {
  auto now = std::make_shared<std::int64_t>(1000);
  return std::make_shared<ProtocolSyncCoordinator>(
      [executor](
          OpenApiClientRequest request,
          OpenApiClientCompletion completion) {
        return executor->execute(std::move(request), std::move(completion));
      },
      persistence,
      [now]() mutable {
        const auto value = *now;
        *now += 25;
        return value;
      });
}

const std::string kProtocolResponse = R"([{
  "id":"aave","chain":"eth","name":"Aave","site_url":"",
  "logo_url":"","has_supported_portfolio":true,"tvl":100,
  "portfolio_item_list":[{
    "asset_token_list":[{"price":2,"amount":3}],
    "stats":{"net_usd_value":6}
  }]
}])";

void testSuccessAndEmptySnapshot() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  ProtocolSyncResult result;

  const auto started = coordinator->syncAddress(
      kAddress, false, [&result](ProtocolSyncResult value) {
        result = std::move(value);
      });
  assert(started.accepted);
  assert(executor->pending.size() == 1);
  assert(executor->pending[0].request.uriPath ==
      "/v1/user/complex_protocol_list");
  assert(executor->pending[0].request.query.size() == 1);
  assert(executor->pending[0].request.query[0].value == kAddress);
  executor->complete(0, 200, kProtocolResponse);

  assert(result.success);
  assert(result.stage == ProtocolSyncStage::Persistence);
  assert(result.sourceItemCount == 1);
  assert(result.committedRowCount == 1);
  assert(persistence->lastContract.tableName ==
      "rabby_cache_portocolitem_20260817");
  assert(persistence->lastRows[0][5].text == "aave");

  ProtocolSyncResult emptyResult;
  coordinator->syncAddress(
      kAddress, false, [&emptyResult](ProtocolSyncResult value) {
        emptyResult = std::move(value);
      });
  executor->complete(1, 200, "[]");
  assert(emptyResult.success);
  assert(emptyResult.sourceItemCount == 0);
  assert(persistence->lastRows[0][5].text ==
      "rabby-empty-protocol-item-id");
}

void testJoinSupersedeAndCancel() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::vector<ProtocolSyncResult> joinedResults;

  const auto first = coordinator->syncAddress(
      kAddress, false, [&joinedResults](ProtocolSyncResult value) {
        joinedResults.push_back(std::move(value));
      });
  const auto joined = coordinator->syncAddress(
      kAddress, false, [&joinedResults](ProtocolSyncResult value) {
        joinedResults.push_back(std::move(value));
      });
  assert(first.accepted && joined.accepted && joined.joinedExisting);
  assert(first.generation == joined.generation);
  assert(executor->pending.size() == 1);
  executor->complete(0, 200, "[]");
  assert(joinedResults.size() == 2);
  assert(joinedResults[0].success && joinedResults[1].success);

  ProtocolSyncResult superseded;
  coordinator->syncAddress(
      kAddress, false, [&superseded](ProtocolSyncResult value) {
        superseded = std::move(value);
      });
  coordinator->syncAddress(kAddress, true, nullptr);
  assert(superseded.stage == ProtocolSyncStage::Superseded);
  assert(executor->pending[1].handle->cancelled);

  ProtocolSyncResult cancelled;
  coordinator->syncAddress(
      "0x2222222222222222222222222222222222222222",
      false,
      [&cancelled](ProtocolSyncResult value) {
        cancelled = std::move(value);
      });
  coordinator->cancelAddress(
      "0x2222222222222222222222222222222222222222");
  assert(cancelled.stage == ProtocolSyncStage::Cancelled);
}

void testFailuresAreNotCommitted() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  ProtocolSyncResult httpFailure;
  coordinator->syncAddress(
      kAddress, false, [&httpFailure](ProtocolSyncResult value) {
        httpFailure = std::move(value);
      });
  executor->complete(0, 429, "{}");
  assert(!httpFailure.success);
  assert(httpFailure.stage == ProtocolSyncStage::ProtocolList);
  assert(httpFailure.error.find("HTTP 429") != std::string::npos);
  assert(persistence->commitCount == 0);

  ProtocolSyncResult parseFailure;
  coordinator->syncAddress(
      kAddress, false, [&parseFailure](ProtocolSyncResult value) {
        parseFailure = std::move(value);
      });
  executor->complete(1, 200, "{}");
  assert(!parseFailure.success);
  assert(persistence->commitCount == 0);

  persistence->error = "database unavailable";
  ProtocolSyncResult persistenceFailure;
  coordinator->syncAddress(
      kAddress, false, [&persistenceFailure](ProtocolSyncResult value) {
        persistenceFailure = std::move(value);
      });
  executor->complete(2, 200, "[]");
  assert(!persistenceFailure.success);
  assert(persistenceFailure.stage == ProtocolSyncStage::Persistence);
  assert(persistenceFailure.error == "database unavailable");
}

} // namespace

int main() {
  testSuccessAndEmptySnapshot();
  testJoinSupersedeAndCancel();
  testFailuresAreNotCommitted();
  return 0;
}
