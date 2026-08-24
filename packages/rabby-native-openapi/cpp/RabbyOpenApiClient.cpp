#include <rabby/openapi/RabbyOpenApiClient.h>

#include <utility>

namespace rabby::openapi {
namespace {

OpenApiClientResult failure(
    OpenApiClientFailureStage stage,
    std::string error) {
  OpenApiClientResult result;
  result.failureStage = stage;
  result.error = std::move(error);
  return result;
}

} // namespace

OpenApiClient::OpenApiClient(
    OpenApiClientConfiguration configuration,
    std::shared_ptr<http::Client> httpClient,
    OpenApiRequestSigner requestSigner,
    std::shared_ptr<ApiCredentialPersistence> credentialPersistence,
    ApiKeyGenerator apiKeyGenerator,
    EpochSecondsProvider epochSecondsProvider,
    NonceValueProvider nonceValueProvider)
    : configuration_(std::move(configuration)),
      httpClient_(std::move(httpClient)),
      requestSigner_(std::move(requestSigner)),
      credentialManager_(std::make_shared<ApiCredentialManager>(
          std::move(credentialPersistence),
          std::move(apiKeyGenerator),
          epochSecondsProvider)),
      epochSecondsProvider_(std::move(epochSecondsProvider)),
      nonceValueProvider_(std::move(nonceValueProvider)) {}

std::shared_ptr<http::RequestHandle> OpenApiClient::execute(
    OpenApiClientRequest request,
    OpenApiClientCompletion completion) {
  if (!completion) {
    return nullptr;
  }
  if (!httpClient_) {
    completion(failure(
        OpenApiClientFailureStage::Transport,
        "native HTTP client is required"));
    return nullptr;
  }
  if (!epochSecondsProvider_) {
    completion(failure(
        OpenApiClientFailureStage::RequestPreparation,
        "epoch seconds provider is required"));
    return nullptr;
  }
  if (!nonceValueProvider_) {
    completion(failure(
        OpenApiClientFailureStage::RequestPreparation,
        "nonce provider is required"));
    return nullptr;
  }

  if (const auto initializationError = credentialManager_->initialize();
      !initializationError.empty()) {
    completion(failure(
        OpenApiClientFailureStage::CredentialInitialization,
        std::move(initializationError)));
    return nullptr;
  }

  const auto credential = credentialManager_->snapshot();
  if (!credential.has_value()) {
    completion(failure(
        OpenApiClientFailureStage::CredentialInitialization,
        "credential manager did not publish a credential"));
    return nullptr;
  }

  auto prepared = prepareOpenApiRequest(
      {
          configuration_.applicationIdentity,
          configuration_.baseUrl,
          request.method,
          std::move(request.uriPath),
          std::move(request.query),
          std::move(request.headers),
          std::move(request.body),
          "n_" + nonceValueProvider_(),
          epochSecondsProvider_(),
          configuration_.clientName,
          configuration_.clientVersion,
          credential,
          request.timeoutMs,
          request.maxResponseBytes,
      },
      requestSigner_);
  if (!prepared.isSuccess()) {
    completion(failure(
        OpenApiClientFailureStage::RequestPreparation,
        std::move(prepared.error)));
    return nullptr;
  }

  auto preparedRequest = std::move(*prepared.value);
  const auto requestCredential = *preparedRequest.credential;
  auto credentialManager = credentialManager_;

  return httpClient_->execute(
      std::move(preparedRequest.request),
      [credentialManager,
       requestCredential,
       completion = std::move(completion)](http::Result transportResult) mutable {
        OpenApiClientResult result;
        result.requestCredentialRevision = requestCredential.revision;

        if (!transportResult.isSuccess()) {
          result.failureStage = OpenApiClientFailureStage::Transport;
          result.transportError = *transportResult.error();
          result.error = result.transportError->message;
          if (const auto current = credentialManager->snapshot();
              current.has_value()) {
            result.currentCredentialRevision = current->revision;
          }
          completion(std::move(result));
          return;
        }

        result.response = *transportResult.response();
        result.credentialResponse = credentialManager->handleResponse(
            requestCredential,
            *result.response);
        if (!result.credentialResponse.isSuccess()) {
          result.failureStage = OpenApiClientFailureStage::CredentialPersistence;
          result.error = result.credentialResponse.error;
        }
        if (const auto current = credentialManager->snapshot();
            current.has_value()) {
          result.currentCredentialRevision = current->revision;
        }
        completion(std::move(result));
      });
}

std::optional<ApiCredentialSnapshot> OpenApiClient::credentialSnapshot() const {
  return credentialManager_->snapshot();
}

const char* credentialResponseDispositionName(
    CredentialResponseDisposition disposition) {
  switch (disposition) {
    case CredentialResponseDisposition::NoCredentialHeader:
      return "no_credential_header";
    case CredentialResponseDisposition::IgnoredHttpStatus:
      return "ignored_http_status";
    case CredentialResponseDisposition::Unchanged:
      return "unchanged";
    case CredentialResponseDisposition::Updated:
      return "updated";
    case CredentialResponseDisposition::StaleResponse:
      return "stale_response";
    case CredentialResponseDisposition::Failed:
      return "failed";
  }
  return "unknown";
}

const char* openApiClientFailureStageName(OpenApiClientFailureStage stage) {
  switch (stage) {
    case OpenApiClientFailureStage::None:
      return "none";
    case OpenApiClientFailureStage::CredentialInitialization:
      return "credential_initialization";
    case OpenApiClientFailureStage::RequestPreparation:
      return "request_preparation";
    case OpenApiClientFailureStage::Transport:
      return "transport";
    case OpenApiClientFailureStage::CredentialPersistence:
      return "credential_persistence";
  }
  return "unknown";
}

} // namespace rabby::openapi
