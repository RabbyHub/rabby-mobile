#pragma once

#include <rabby/http/RabbyHttpTypes.h>
#include <rabby/openapi/RabbyOpenApiCredential.h>
#include <rabby/openapi/RabbyOpenApiSigning.h>

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace rabby::openapi {

struct OpenApiRequestInput {
  std::string applicationIdentity;
  std::string baseUrl;
  http::Method method{http::Method::Get};
  std::string uriPath;
  std::vector<SigningParameter> query;
  std::vector<http::Header> headers;
  std::vector<std::uint8_t> body;
  std::string nonce;
  std::int64_t timestamp{0};
  std::string clientName{"rabbymobile"};
  std::string clientVersion;
  std::optional<ApiCredentialSnapshot> credential;
  std::int64_t timeoutMs{30000};
  std::size_t maxResponseBytes{64U * 1024U * 1024U};
};

struct PreparedOpenApiRequest {
  http::Request request;
  std::optional<ApiCredentialSnapshot> credential;
};

struct PrepareOpenApiRequestResult {
  std::optional<PreparedOpenApiRequest> value;
  std::string error;

  bool isSuccess() const {
    return value.has_value();
  }
};

// Builds one dispatch attempt. A retry must call this again with a fresh nonce
// and timestamp instead of reusing the returned request.
PrepareOpenApiRequestResult prepareOpenApiRequest(
    OpenApiRequestInput input,
    const OpenApiRequestSigner& signer);

// Matches Axios 0.27 query encoding used by the current JavaScript OpenAPI
// path. Signing uses the original normalized value, not this encoded form.
std::string encodeQueryComponent(std::string_view value);

} // namespace rabby::openapi
