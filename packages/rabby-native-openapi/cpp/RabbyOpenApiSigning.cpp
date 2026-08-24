#include <rabby/openapi/RabbyOpenApiSigning.h>

#include <array>
#include <string>
#include <vector>

#if !defined(RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER) &&                         \
    __has_include(<rabby/private_openapi/RabbyNativeOpenApiSigner.h>)
#define RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER 1
#endif

#if defined(RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER)
#include <rabby/private_openapi/RabbyNativeOpenApiSigner.h>
#endif

namespace rabby::openapi {

OpenApiSigningResult unavailableOpenApiRequestSigner(OpenApiSigningInput) {
  return {{}, "private OpenAPI signer is unavailable"};
}

OpenApiRequestSigner configuredOpenApiRequestSigner() {
#if defined(RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER)
  return [](OpenApiSigningInput input) -> OpenApiSigningResult {
    if (input.nonce.empty() || input.timestamp <= 0) {
      return {{}, "nonce and timestamp are required"};
    }

    std::vector<RabbyNativeOpenApiSigningParameter> parameters;
    parameters.reserve(input.parameters.size());
    for (const auto& parameter : input.parameters) {
      if (!parameter.value.has_value()) {
        return {{}, "private signer requires normalized parameter values"};
      }
      parameters.push_back({parameter.key.c_str(), parameter.value->c_str()});
    }

    std::array<char, 65> signature{};
    const auto status = rabby_native_openapi_sign_v2(
        input.applicationIdentity.c_str(),
        input.method.c_str(),
        input.uriPath.c_str(),
        parameters.data(),
        parameters.size(),
        input.nonce.c_str(),
        input.timestamp,
        signature.data(),
        signature.size());
    if (status != RABBY_NATIVE_OPENAPI_SIGNER_OK) {
      return {{}, rabby_native_openapi_signer_status_message(status)};
    }

    return {
        {
            {"X-API-TS", std::to_string(input.timestamp)},
            {"X-API-Nonce", std::move(input.nonce)},
            {"X-API-Ver", "v2"},
            {"X-API-Sign", signature.data()},
        },
        {},
    };
  };
#else
  return unavailableOpenApiRequestSigner;
#endif
}

} // namespace rabby::openapi
