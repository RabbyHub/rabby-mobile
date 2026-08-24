#include <rabby/openapi/RabbyOpenApiCredential.h>
#include <rabby/openapi/RabbyOpenApiRequest.h>

#include <algorithm>
#include <cassert>
#include <cctype>
#include <iostream>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

using namespace rabby::openapi;

namespace {

class MemoryCredentialPersistence final : public ApiCredentialPersistence {
 public:
  LoadApiCredentialResult load() override {
    loadCount += 1;
    return {value, loadError};
  }

  std::string save(const ApiCredential& credential) override {
    saveCount += 1;
    if (!saveError.empty()) {
      return saveError;
    }
    value = credential;
    return {};
  }

  std::optional<ApiCredential> value;
  std::string loadError;
  std::string saveError;
  int loadCount{0};
  int saveCount{0};
};

rabby::http::Response response(
    int statusCode,
    std::vector<rabby::http::Header> headers = {}) {
  return {
      statusCode,
      "https://app-api.rabby.io/v1/user/token_list",
      std::move(headers),
      {},
      10,
  };
}

const rabby::http::Header& requireHeader(
    const std::vector<rabby::http::Header>& headers,
    const std::string& name) {
  const auto found = std::find_if(
      headers.begin(), headers.end(), [&](const auto& header) {
        if (header.name.size() != name.size()) {
          return false;
        }
        for (std::size_t index = 0; index < name.size(); ++index) {
          if (std::tolower(static_cast<unsigned char>(header.name[index])) !=
              std::tolower(static_cast<unsigned char>(name[index]))) {
            return false;
          }
        }
        return true;
      });
  assert(found != headers.end());
  return *found;
}

OpenApiRequestInput requestInput(ApiCredentialSnapshot credential) {
  return {
      "com.debank.rabbymobile.regression",
      "https://app-api.rabby.io",
      rabby::http::Method::Get,
      "/v1/user/token_list",
      {{"id", "0x1"}},
      {},
      {},
      "n_credential_lifecycle",
      1729098100,
      "rabbymobile",
      "0.6.82",
      std::move(credential),
  };
}

OpenApiSigningResult fakeSigner(OpenApiSigningInput input) {
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

} // namespace

int main() {
  {
    auto persistence = std::make_shared<MemoryCredentialPersistence>();
    int generatedCount = 0;
    ApiCredentialManager manager(
        persistence,
        [&]() {
          generatedCount += 1;
          return "11111111-2222-4333-8444-555555555555";
        },
        []() { return 1729098000; });

    assert(manager.initialize().empty());
    assert(manager.initialize().empty());
    assert(generatedCount == 1);
    assert(persistence->loadCount == 1);
    assert(persistence->saveCount == 1);

    const auto initial = manager.snapshot();
    assert(initial.has_value());
    assert(initial->revision == 1);
    assert(initial->value.apiKey ==
           "11111111-2222-4333-8444-555555555555");
    assert(initial->value.apiTime == 1729098000);

    const auto firstRequest =
        prepareOpenApiRequest(requestInput(*initial), fakeSigner);
    assert(firstRequest.isSuccess());
    assert(firstRequest.value->credential == initial);
    assert(
        requireHeader(firstRequest.value->request.headers, "x-api-key").value ==
        initial->value.apiKey);

    const auto noHeader = manager.handleResponse(*initial, response(200));
    assert(noHeader.isSuccess());
    assert(
        noHeader.disposition ==
        CredentialResponseDisposition::NoCredentialHeader);
    assert(persistence->saveCount == 1);

    const auto updated = manager.handleResponse(
        *initial,
        response(200, {{"X-Set-API-Key", "server-derived-key"}}));
    assert(updated.isSuccess());
    assert(updated.didUpdate());
    assert(persistence->saveCount == 2);

    const auto rotated = manager.snapshot();
    assert(rotated.has_value());
    assert(rotated->revision == 2);
    assert(rotated->value.apiKey == "server-derived-key");
    assert(rotated->value.apiTime == initial->value.apiTime);
    assert(persistence->value == rotated->value);

    const auto secondRequest =
        prepareOpenApiRequest(requestInput(*rotated), fakeSigner);
    assert(secondRequest.isSuccess());
    assert(
        requireHeader(secondRequest.value->request.headers, "x-api-key").value ==
        "server-derived-key");
    assert(
        requireHeader(secondRequest.value->request.headers, "x-api-time")
            .value == "1729098000");

    const auto stale = manager.handleResponse(
        *initial,
        response(200, {{"x-set-api-key", "stale-response-key"}}));
    assert(stale.isSuccess());
    assert(
        stale.disposition == CredentialResponseDisposition::StaleResponse);
    assert(persistence->saveCount == 2);
    assert(manager.snapshot()->value == rotated->value);

    const auto unchanged = manager.handleResponse(
        *rotated,
        response(204, {{"x-set-api-key", "server-derived-key"}}));
    assert(unchanged.isSuccess());
    assert(unchanged.disposition == CredentialResponseDisposition::Unchanged);
    assert(persistence->saveCount == 2);

    const auto ignored = manager.handleResponse(
        *rotated,
        response(429, {{"x-set-api-key", "must-not-be-used"}}));
    assert(ignored.isSuccess());
    assert(
        ignored.disposition ==
        CredentialResponseDisposition::IgnoredHttpStatus);
    assert(persistence->saveCount == 2);
  }

  {
    auto persistence = std::make_shared<MemoryCredentialPersistence>();
    persistence->value = ApiCredential{"persisted-key", 100};
    int generatedCount = 0;
    ApiCredentialManager manager(
        persistence,
        [&]() {
          generatedCount += 1;
          return "unused-generated-key";
        },
        []() { return 200; });

    assert(manager.initialize().empty());
    assert(generatedCount == 0);
    assert(persistence->saveCount == 0);
    assert(manager.snapshot()->value == *persistence->value);
  }

  {
    auto persistence = std::make_shared<MemoryCredentialPersistence>();
    persistence->value = ApiCredential{"persisted-key", 100};
    ApiCredentialManager manager(
        persistence,
        []() { return "unused-generated-key"; },
        []() { return 200; });
    assert(manager.initialize().empty());
    const auto initial = *manager.snapshot();

    const auto conflicting = manager.handleResponse(
        initial,
        response(
            200,
            {
                {"x-set-api-key", "first"},
                {"X-SET-API-KEY", "second"},
            }));
    assert(!conflicting.isSuccess());
    assert(
        conflicting.error ==
        "response contains conflicting x-set-api-key headers");

    const auto invalid = manager.handleResponse(
        initial,
        response(200, {{"x-set-api-key", "contains a space"}}));
    assert(!invalid.isSuccess());
    assert(
        invalid.error ==
        "response API credential is invalid: apiKey must contain visible ASCII characters only");
    assert(manager.snapshot()->value == initial.value);

    persistence->saveError = "storage unavailable";
    const auto failedSave = manager.handleResponse(
        initial,
        response(200, {{"x-set-api-key", "valid-next-key"}}));
    assert(!failedSave.isSuccess());
    assert(
        failedSave.error ==
        "failed to persist response API credential: storage unavailable");
    assert(manager.snapshot()->value == initial.value);
    assert(manager.snapshot()->revision == initial.revision);
  }

  {
    auto persistence = std::make_shared<MemoryCredentialPersistence>();
    persistence->value = ApiCredential{"", 100};
    ApiCredentialManager manager(
        persistence,
        []() { return "unused-generated-key"; },
        []() { return 200; });
    assert(
        manager.initialize() ==
        "persisted API credential is invalid: apiKey must not be empty");
    assert(!manager.snapshot().has_value());
  }

  {
    auto persistence = std::make_shared<MemoryCredentialPersistence>();
    persistence->saveError = "disk full";
    ApiCredentialManager manager(
        persistence,
        []() { return "generated-key"; },
        []() { return 200; });
    assert(
        manager.initialize() ==
        "failed to persist generated API credential: disk full");
    assert(!manager.snapshot().has_value());
  }

  std::cout << "RabbyOpenApiCredentialTest passed\n";
  return 0;
}
