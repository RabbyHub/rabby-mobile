#include <rabby/openapi/RabbyOpenApiClient.h>

#include <cassert>
#include <cctype>
#include <cstdint>
#include <deque>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace {

using rabby::http::Error;
using rabby::http::ErrorCode;
using rabby::http::Header;
using rabby::http::Request;
using rabby::http::Response;
using rabby::openapi::ApiCredential;
using rabby::openapi::CredentialResponseDisposition;
using rabby::openapi::OpenApiClient;
using rabby::openapi::OpenApiClientFailureStage;
using rabby::openapi::OpenApiClientResult;

rabby::openapi::OpenApiSigningResult fakeSigner(
    rabby::openapi::OpenApiSigningInput input) {
  return {
      {
          {"x-api-ts", std::to_string(input.timestamp)},
          {"x-api-nonce", std::move(input.nonce)},
          {"x-api-ver", "private-test"},
          {"x-api-sign", "private-signature"},
      },
      {},
  };
}

class MemoryPersistence final
    : public rabby::openapi::ApiCredentialPersistence {
 public:
  rabby::openapi::LoadApiCredentialResult load() override {
    return {value, loadError};
  }

  std::string save(const ApiCredential& credential) override {
    ++saveCount;
    if (!saveError.empty()) {
      return saveError;
    }
    value = credential;
    return {};
  }

  std::optional<ApiCredential> value;
  std::string loadError;
  std::string saveError;
  int saveCount{0};
};

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

class FakeHttpClient final : public rabby::http::Client {
 public:
  struct Pending {
    Request request;
    rabby::http::Completion completion;
    std::shared_ptr<FakeRequestHandle> handle;
  };

  std::shared_ptr<rabby::http::RequestHandle> execute(
      Request request,
      rabby::http::Completion completion) override {
    auto handle = std::make_shared<FakeRequestHandle>(nextId++);
    pending.push_back(
        {std::move(request), std::move(completion), handle});
    return handle;
  }

  void succeed(std::size_t index, Response response) {
    auto completion = std::move(pending.at(index).completion);
    completion(rabby::http::Result::success(std::move(response)));
  }

  void fail(std::size_t index, Error error) {
    auto completion = std::move(pending.at(index).completion);
    completion(rabby::http::Result::failure(std::move(error)));
  }

  std::vector<Pending> pending;
  std::uint64_t nextId{1};
};

std::optional<std::string> headerValue(
    const Request& request,
    const std::string& name) {
  const auto equalsCaseInsensitive = [](const std::string& left,
                                        const std::string& right) {
    if (left.size() != right.size()) {
      return false;
    }
    for (std::size_t index = 0; index < left.size(); ++index) {
      if (std::tolower(static_cast<unsigned char>(left[index])) !=
          std::tolower(static_cast<unsigned char>(right[index]))) {
        return false;
      }
    }
    return true;
  };
  for (const auto& header : request.headers) {
    if (equalsCaseInsensitive(header.name, name)) {
      return header.value;
    }
  }
  return std::nullopt;
}

std::shared_ptr<OpenApiClient> makeClient(
    const std::shared_ptr<FakeHttpClient>& httpClient,
    const std::shared_ptr<MemoryPersistence>& persistence) {
  auto nonceCounter = std::make_shared<int>(0);
  return std::make_shared<OpenApiClient>(
      rabby::openapi::OpenApiClientConfiguration{
          "com.debank.rabbymobile.regression",
          "https://app-api.rabby.io",
          "rabbymobile",
          "0.6.84",
      },
      httpClient,
      fakeSigner,
      persistence,
      []() { return "installation-uuid"; },
      []() { return 1700000000; },
      [nonceCounter]() {
        return "request-" + std::to_string(++*nonceCounter);
      });
}

rabby::openapi::OpenApiClientRequest makeGetRequest(
    std::string uriPath,
    std::vector<rabby::openapi::SigningParameter> query = {}) {
  rabby::openapi::OpenApiClientRequest request;
  request.method = rabby::http::Method::Get;
  request.uriPath = std::move(uriPath);
  request.query = std::move(query);
  return request;
}

void testCredentialRotationFeedsTheNextRequest() {
  auto persistence = std::make_shared<MemoryPersistence>();
  auto httpClient = std::make_shared<FakeHttpClient>();
  auto client = makeClient(httpClient, persistence);

  std::optional<OpenApiClientResult> firstResult;
  auto firstHandle = client->execute(
      makeGetRequest(
          "/v1/user/used_chain_list",
          {{"id", "0x1111111111111111111111111111111111111111"}}),
      [&](OpenApiClientResult result) { firstResult = std::move(result); });

  assert(firstHandle != nullptr);
  assert(httpClient->pending.size() == 1);
  assert(
      headerValue(httpClient->pending[0].request, "x-api-key") ==
      "installation-uuid");
  assert(
      headerValue(httpClient->pending[0].request, "x-api-time") ==
      "1700000000");
  assert(
      headerValue(httpClient->pending[0].request, "x-api-nonce") ==
      "n_request-1");

  httpClient->succeed(
      0,
      Response{
          200,
          "https://app-api.rabby.io/v1/user/used_chain_list",
          {Header{"X-Set-API-Key", "rotated-key"}},
          {},
          12});

  assert(firstResult.has_value());
  assert(firstResult->isSuccess());
  assert(
      firstResult->credentialResponse.disposition ==
      CredentialResponseDisposition::Updated);
  assert(firstResult->requestCredentialRevision == 1);
  assert(firstResult->currentCredentialRevision == 2);
  assert(persistence->value->apiKey == "rotated-key");

  std::optional<OpenApiClientResult> secondResult;
  client->execute(
      makeGetRequest(
          "/v1/user/used_chain_list",
          {{"id", "0x1111111111111111111111111111111111111111"}}),
      [&](OpenApiClientResult result) { secondResult = std::move(result); });

  assert(httpClient->pending.size() == 2);
  assert(
      headerValue(httpClient->pending[1].request, "x-api-key") ==
      "rotated-key");
  assert(
      headerValue(httpClient->pending[1].request, "x-api-nonce") ==
      "n_request-2");

  httpClient->succeed(
      1,
      Response{
          200,
          "https://app-api.rabby.io/v1/user/used_chain_list",
          {},
          {},
          8});
  assert(secondResult.has_value());
  assert(secondResult->isSuccess());
  assert(secondResult->requestCredentialRevision == 2);
  assert(secondResult->currentCredentialRevision == 2);
  assert(persistence->saveCount == 2);
}

void testOlderResponseCannotReplaceNewerCredential() {
  auto persistence = std::make_shared<MemoryPersistence>();
  auto httpClient = std::make_shared<FakeHttpClient>();
  auto client = makeClient(httpClient, persistence);

  std::optional<OpenApiClientResult> firstResult;
  std::optional<OpenApiClientResult> secondResult;
  client->execute(
      makeGetRequest("/v1/wallet/version"),
      [&](OpenApiClientResult result) { firstResult = std::move(result); });
  client->execute(
      makeGetRequest("/v1/wallet/version"),
      [&](OpenApiClientResult result) { secondResult = std::move(result); });

  httpClient->succeed(
      1,
      Response{200, {}, {Header{"x-set-api-key", "newer-key"}}, {}, 2});
  httpClient->succeed(
      0,
      Response{200, {}, {Header{"x-set-api-key", "older-key"}}, {}, 8});

  assert(secondResult->credentialResponse.didUpdate());
  assert(
      firstResult->credentialResponse.disposition ==
      CredentialResponseDisposition::StaleResponse);
  assert(persistence->value->apiKey == "newer-key");
  assert(persistence->saveCount == 2);
}

void testCredentialPersistenceFailureIsVisibleAndDoesNotPublish() {
  auto persistence = std::make_shared<MemoryPersistence>();
  persistence->value = ApiCredential{"existing-key", 1700000000};
  persistence->saveError = "storage unavailable";
  auto httpClient = std::make_shared<FakeHttpClient>();
  auto client = makeClient(httpClient, persistence);

  std::optional<OpenApiClientResult> result;
  client->execute(
      makeGetRequest("/v1/wallet/version"),
      [&](OpenApiClientResult value) { result = std::move(value); });
  httpClient->succeed(
      0,
      Response{200, {}, {Header{"x-set-api-key", "rotated-key"}}, {}, 3});

  assert(result.has_value());
  assert(!result->isSuccess());
  assert(
      result->failureStage ==
      OpenApiClientFailureStage::CredentialPersistence);
  assert(result->response->statusCode == 200);
  assert(result->requestCredentialRevision == 1);
  assert(result->currentCredentialRevision == 1);
  assert(client->credentialSnapshot()->value.apiKey == "existing-key");
}

void testTransportFailureDoesNotRetry() {
  auto persistence = std::make_shared<MemoryPersistence>();
  auto httpClient = std::make_shared<FakeHttpClient>();
  auto client = makeClient(httpClient, persistence);

  std::optional<OpenApiClientResult> result;
  client->execute(
      makeGetRequest("/v1/wallet/version"),
      [&](OpenApiClientResult value) { result = std::move(value); });
  httpClient->fail(
      0,
      Error{ErrorCode::Network, "network unavailable", 10});

  assert(result.has_value());
  assert(!result->isSuccess());
  assert(result->failureStage == OpenApiClientFailureStage::Transport);
  assert(result->transportError->code == ErrorCode::Network);
  assert(httpClient->pending.size() == 1);
}

} // namespace

int main() {
  testCredentialRotationFeedsTheNextRequest();
  testOlderResponseCannotReplaceNewerCredential();
  testCredentialPersistenceFailureIsVisibleAndDoesNotPublish();
  testTransportFailureDoesNotRetry();
  return 0;
}
