#pragma once

#include <rabby/http/RabbyHttpTypes.h>

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

namespace rabby::openapi {

struct SigningParameter {
  std::string key;
  std::optional<std::string> value;
};

struct OpenApiSigningInput {
  std::string applicationIdentity;
  std::string method;
  std::string uriPath;
  std::vector<SigningParameter> parameters;
  std::string nonce;
  std::int64_t timestamp{0};
};

struct OpenApiSigningResult {
  std::vector<http::Header> headers;
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

// The implementation belongs to a separately reviewed private package. This
// public package owns only the typed boundary and never falls back to an
// unsigned request.
using OpenApiRequestSigner =
    std::function<OpenApiSigningResult(OpenApiSigningInput)>;

OpenApiSigningResult unavailableOpenApiRequestSigner(OpenApiSigningInput input);

// Returns the private signer when the optional native package is linked into
// this build. Public and audit builds receive the explicit unavailable signer.
OpenApiRequestSigner configuredOpenApiRequestSigner();

} // namespace rabby::openapi
