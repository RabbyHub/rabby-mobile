#include <rabby/openapi/RabbyOpenApiRequest.h>

#include <algorithm>
#include <cassert>
#include <cctype>
#include <iostream>
#include <optional>
#include <string>
#include <utility>
#include <vector>

using namespace rabby::openapi;

namespace {

OpenApiRequestInput makeInput() {
  return {
      "com.debank.rabbymobile.regression",
      "https://app-api.rabby.io/",
      rabby::http::Method::Get,
      "/v1/user/token_list",
      {
          {"chain_id", "opbnb"},
          {"id", "0x10B26700B0a2d3F5eF12fA250aba818eE3b43bf4"},
          {"is_all", "true"},
      },
      {{"Accept", "application/json"}},
      {},
      "n_request",
      1729098094,
      "rabbymobile",
      "0.6.82",
      ApiCredentialSnapshot{ApiCredential{"api-key", 1729098000}, 7},
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

void expectFailure(OpenApiRequestInput input, const std::string& error) {
  const auto result = prepareOpenApiRequest(std::move(input), fakeSigner);
  assert(!result.isSuccess());
  assert(result.error == error);
}

} // namespace

int main() {
  {
    std::optional<OpenApiSigningInput> observedSigningInput;
    const auto result = prepareOpenApiRequest(
        makeInput(),
        [&](OpenApiSigningInput input) {
          observedSigningInput = input;
          return fakeSigner(std::move(input));
        });
    assert(result.isSuccess());
    const auto& prepared = *result.value;
    assert(prepared.request.url ==
           "https://app-api.rabby.io/v1/user/token_list?"
           "chain_id=opbnb&"
           "id=0x10B26700B0a2d3F5eF12fA250aba818eE3b43bf4&"
           "is_all=true");
    assert(observedSigningInput.has_value());
    assert(observedSigningInput->parameters.size() == 3);
    assert(observedSigningInput->nonce == "n_request");
    assert(requireHeader(prepared.request.headers, "x-api-sign").value ==
           "private-signature");
    assert(requireHeader(prepared.request.headers, "x-api-key").value ==
           "api-key");
    assert(prepared.credential->revision == 7);
  }

  {
    assert(encodeQueryComponent(":$, []+!*'()~\xE4\xB8\xAD\xE6\x96\x87") ==
           ":$,+[]%2B!*'()~%E4%B8%AD%E6%96%87");

    auto input = makeInput();
    input.query = {
        {"q", "hello world+wallet"},
        {"omitted", std::nullopt},
        {"empty", ""},
    };
    std::optional<OpenApiSigningInput> observedSigningInput;
    const auto result = prepareOpenApiRequest(
        std::move(input),
        [&](OpenApiSigningInput signingInput) {
          observedSigningInput = signingInput;
          return fakeSigner(std::move(signingInput));
        });
    assert(result.isSuccess());
    assert(result.value->request.url ==
           "https://app-api.rabby.io/v1/user/token_list?"
           "q=hello+world%2Bwallet&empty=");
    assert(observedSigningInput->parameters.size() == 2);
    assert(observedSigningInput->parameters[0].key == "q");
    assert(observedSigningInput->parameters[1].key == "empty");
  }

  {
    auto input = makeInput();
    input.method = rabby::http::Method::Post;
    input.uriPath = "/v2/user/total_balance";
    input.query.clear();
    input.body = {'{', '}', '\n'};
    input.headers.push_back({"Content-Type", "application/json"});
    const auto result = prepareOpenApiRequest(input, fakeSigner);
    assert(result.isSuccess());
    assert(result.value->request.body == input.body);
  }

  {
    auto input = makeInput();
    input.baseUrl = "http://app-api.rabby.io";
    expectFailure(
        std::move(input),
        "baseUrl must be an HTTPS origin without credentials, path, query, or fragment");

    input = makeInput();
    input.uriPath = "/v1/user/token_list?id=1";
    expectFailure(
        std::move(input), "uriPath must not contain a query or fragment");

    input = makeInput();
    input.query.push_back({"id", "duplicate"});
    expectFailure(std::move(input), "duplicate query parameter key");

    input = makeInput();
    input.headers.push_back({"X-Api-Sign", "caller-value"});
    expectFailure(
        std::move(input), "caller must not provide OpenAPI-owned headers");

    input = makeInput();
    input.credential = ApiCredentialSnapshot{ApiCredential{"", 1}, 1};
    expectFailure(
        std::move(input),
        "credential snapshot must contain a valid credential and positive revision");

    input = makeInput();
    input.body = {1};
    expectFailure(
        std::move(input),
        "invalid HTTP request: GET and HEAD requests cannot contain a body");
  }

  {
    const auto missingSigner =
        prepareOpenApiRequest(makeInput(), OpenApiRequestSigner{});
    assert(!missingSigner.isSuccess());
    assert(missingSigner.error == "OpenAPI request signer is required");

    const auto unavailable = prepareOpenApiRequest(
        makeInput(), unavailableOpenApiRequestSigner);
    assert(!unavailable.isSuccess());
    assert(
        unavailable.error ==
        "signing failed: private OpenAPI signer is unavailable");

    const auto invalidHeader = prepareOpenApiRequest(
        makeInput(),
        [](OpenApiSigningInput) {
          return OpenApiSigningResult{{{"authorization", "forbidden"}}, {}};
        });
    assert(!invalidHeader.isSuccess());
    assert(
        invalidHeader.error ==
        "signer returned a header outside the OpenAPI-owned set");
  }

  std::cout << "RabbyOpenApiRequestTest passed\n";
  return 0;
}
