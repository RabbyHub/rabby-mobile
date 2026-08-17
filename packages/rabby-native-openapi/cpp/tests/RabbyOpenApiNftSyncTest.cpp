#include <rabby/openapi/RabbyOpenApiNftSync.h>

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
using rabby::openapi::NftSyncCoordinator;
using rabby::openapi::NftSyncResult;
using rabby::openapi::NftSyncStage;
using rabby::openapi::OpenApiClientCompletion;
using rabby::openapi::OpenApiClientRequest;
using rabby::openapi::OpenApiClientResult;

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

std::shared_ptr<NftSyncCoordinator> makeCoordinator(
    const std::shared_ptr<FakeExecutor>& executor,
    const std::shared_ptr<FakePersistence>& persistence) {
  auto now = std::make_shared<std::int64_t>(1000);
  return std::make_shared<NftSyncCoordinator>(
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

const std::string kNftResponse = R"([{
  "chain":"eth","id":"nft-one","contract_id":"contract",
  "inner_id":"inner","token_id":"7","name":"NFT One",
  "collection_id":"eth:collection","amount":1,"is_erc721":true
}])";

const std::string kCollectionResponse = R"([{
  "id":"collection","chain":"eth","name":"Collection",
  "is_verified":true,"credit_score":88,"is_core":true,
  "is_hidden":false
}])";

void completeSuccessfulSync(
    const std::shared_ptr<FakeExecutor>& executor,
    std::size_t nftRequestIndex) {
  executor->complete(nftRequestIndex, 200, kNftResponse);
  executor->complete(nftRequestIndex + 1, 200, kCollectionResponse);
}

void testSuccessAndEmptySnapshot() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  NftSyncResult result;

  const auto started = coordinator->syncAddress(
      kAddress, false, [&result](NftSyncResult value) {
        result = std::move(value);
      });
  assert(started.accepted);
  assert(executor->pending.size() == 1);
  assert(executor->pending[0].request.uriPath == "/v1/user/nft_list");
  assert(executor->pending[0].request.query.size() == 3);
  assert(executor->pending[0].request.query[0].value == kAddress);
  executor->complete(0, 200, kNftResponse);
  assert(executor->pending.size() == 2);
  assert(executor->pending[1].request.uriPath ==
      "/v1/user/collection_list");
  executor->complete(1, 200, kCollectionResponse);

  assert(result.success);
  assert(result.stage == NftSyncStage::Persistence);
  assert(result.sourceItemCount == 1);
  assert(result.sourceCollectionCount == 1);
  assert(result.filteredItemCount == 0);
  assert(result.committedRowCount == 1);
  assert(persistence->lastContract.tableName ==
      "rabby_cache_nftitem_20260813");
  assert(persistence->lastRows[0][5].text == "nft-one");

  NftSyncResult emptyResult;
  coordinator->syncAddress(
      kAddress, false, [&emptyResult](NftSyncResult value) {
        emptyResult = std::move(value);
      });
  executor->complete(2, 200, "[]");
  executor->complete(3, 200, "[]");
  assert(emptyResult.success);
  assert(emptyResult.sourceItemCount == 0);
  assert(persistence->lastRows[0][5].text ==
      "rabby-empty-nft-item-id");
}

void testJoinSupersedeAndCancel() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);
  std::vector<NftSyncResult> joinedResults;

  const auto first = coordinator->syncAddress(
      kAddress, false, [&joinedResults](NftSyncResult value) {
        joinedResults.push_back(std::move(value));
      });
  const auto joined = coordinator->syncAddress(
      kAddress, false, [&joinedResults](NftSyncResult value) {
        joinedResults.push_back(std::move(value));
      });
  assert(first.accepted && joined.accepted && joined.joinedExisting);
  assert(first.generation == joined.generation);
  assert(executor->pending.size() == 1);
  completeSuccessfulSync(executor, 0);
  assert(joinedResults.size() == 2);
  assert(joinedResults[0].success && joinedResults[1].success);

  NftSyncResult superseded;
  coordinator->syncAddress(
      kAddress, false, [&superseded](NftSyncResult value) {
        superseded = std::move(value);
      });
  coordinator->syncAddress(kAddress, true, nullptr);
  assert(superseded.stage == NftSyncStage::Superseded);
  assert(executor->pending[2].handle->cancelled);

  NftSyncResult cancelled;
  coordinator->syncAddress(
      "0x2222222222222222222222222222222222222222",
      false,
      [&cancelled](NftSyncResult value) {
        cancelled = std::move(value);
      });
  coordinator->cancelAddress(
      "0x2222222222222222222222222222222222222222");
  assert(cancelled.stage == NftSyncStage::Cancelled);
}

void testFailuresAreNotCommitted() {
  auto executor = std::make_shared<FakeExecutor>();
  auto persistence = std::make_shared<FakePersistence>();
  auto coordinator = makeCoordinator(executor, persistence);

  NftSyncResult nftFailure;
  coordinator->syncAddress(
      kAddress, false, [&nftFailure](NftSyncResult value) {
        nftFailure = std::move(value);
      });
  executor->complete(0, 429, "{}");
  assert(!nftFailure.success);
  assert(nftFailure.stage == NftSyncStage::NftList);
  assert(nftFailure.error.find("HTTP 429") != std::string::npos);

  NftSyncResult collectionFailure;
  coordinator->syncAddress(
      kAddress, false, [&collectionFailure](NftSyncResult value) {
        collectionFailure = std::move(value);
      });
  executor->complete(1, 200, kNftResponse);
  executor->complete(2, 500, "{}");
  assert(!collectionFailure.success);
  assert(collectionFailure.stage == NftSyncStage::CollectionList);

  NftSyncResult parseFailure;
  coordinator->syncAddress(
      kAddress, false, [&parseFailure](NftSyncResult value) {
        parseFailure = std::move(value);
      });
  executor->complete(3, 200, "{}");
  executor->complete(4, 200, "[]");
  assert(!parseFailure.success);

  persistence->error = "database unavailable";
  NftSyncResult persistenceFailure;
  coordinator->syncAddress(
      kAddress, false, [&persistenceFailure](NftSyncResult value) {
        persistenceFailure = std::move(value);
      });
  executor->complete(5, 200, "[]");
  executor->complete(6, 200, "[]");
  assert(!persistenceFailure.success);
  assert(persistenceFailure.stage == NftSyncStage::Persistence);
  assert(persistenceFailure.error == "database unavailable");
  assert(persistence->commitCount == 1);
}

} // namespace

int main() {
  testSuccessAndEmptySnapshot();
  testJoinSupersedeAndCancel();
  testFailuresAreNotCommitted();
  return 0;
}
