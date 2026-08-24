#pragma once

#include <rabby/http/RabbyHttpTypes.h>
#include <rabby/openapi/RabbyOpenApiCredential.h>
#include <rabby/openapi/RabbyOpenApiRequest.h>
#include <rabby/openapi/RabbyOpenApiSigning.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace rabby::openapi {

struct OpenApiClientConfiguration {
  std::string applicationIdentity;
  std::string baseUrl;
  std::string clientName{"rabbymobile"};
  std::string clientVersion;
};

struct OpenApiClientRequest {
  http::Method method{http::Method::Get};
  std::string uriPath;
  std::vector<SigningParameter> query;
  std::vector<http::Header> headers;
  std::vector<std::uint8_t> body;
  std::int64_t timeoutMs{30000};
  std::size_t maxResponseBytes{64U * 1024U * 1024U};
};

enum class OpenApiClientFailureStage {
  None,
  CredentialInitialization,
  RequestPreparation,
  Transport,
  CredentialPersistence,
};

struct OpenApiClientResult {
  std::optional<http::Response> response;
  std::optional<http::Error> transportError;
  CredentialResponseResult credentialResponse{
      CredentialResponseDisposition::NoCredentialHeader,
      {}};
  OpenApiClientFailureStage failureStage{OpenApiClientFailureStage::None};
  std::uint64_t requestCredentialRevision{0};
  std::uint64_t currentCredentialRevision{0};
  std::string error;

  // HTTP status codes, including 4xx/5xx, are valid transport responses.
  bool isSuccess() const {
    return response.has_value() && error.empty();
  }
};

using OpenApiClientCompletion = std::function<void(OpenApiClientResult)>;
using NonceValueProvider = std::function<std::string()>;

// Owns one native OpenAPI request attempt. It intentionally does not retry:
// callers decide whether a business operation is safe to repeat.
class OpenApiClient {
 public:
  OpenApiClient(
      OpenApiClientConfiguration configuration,
      std::shared_ptr<http::Client> httpClient,
      OpenApiRequestSigner requestSigner,
      std::shared_ptr<ApiCredentialPersistence> credentialPersistence,
      ApiKeyGenerator apiKeyGenerator,
      EpochSecondsProvider epochSecondsProvider,
      NonceValueProvider nonceValueProvider);

  std::shared_ptr<http::RequestHandle> execute(
      OpenApiClientRequest request,
      OpenApiClientCompletion completion);

  std::optional<ApiCredentialSnapshot> credentialSnapshot() const;

 private:
  OpenApiClientConfiguration configuration_;
  std::shared_ptr<http::Client> httpClient_;
  OpenApiRequestSigner requestSigner_;
  std::shared_ptr<ApiCredentialManager> credentialManager_;
  EpochSecondsProvider epochSecondsProvider_;
  NonceValueProvider nonceValueProvider_;
};

const char* credentialResponseDispositionName(
    CredentialResponseDisposition disposition);
const char* openApiClientFailureStageName(OpenApiClientFailureStage stage);

} // namespace rabby::openapi
