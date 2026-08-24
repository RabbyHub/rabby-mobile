#include <rabby/openapi/RabbyOpenApiDiagnostic.h>

#include <algorithm>
#include <cctype>
#include <utility>

namespace rabby::openapi {
namespace {

OpenApiClientRequest makeRequest(const std::string& address) {
  OpenApiClientRequest request;
  request.method = http::Method::Get;
  request.uriPath = "/v1/user/used_chain_list";
  request.query = {{"id", address}};
  request.timeoutMs = 15000;
  request.maxResponseBytes = 1024U * 1024U;
  return request;
}

OpenApiDiagnosticRequestSummary summarize(const OpenApiClientResult& result) {
  OpenApiDiagnosticRequestSummary summary;
  if (result.response.has_value()) {
    summary.statusCode = result.response->statusCode;
    summary.durationMs = result.response->durationMs;
    summary.bodyBytes = result.response->body.size();
  } else if (result.transportError.has_value()) {
    summary.durationMs = result.transportError->durationMs;
  }
  summary.credentialDisposition = result.credentialResponse.disposition;
  summary.requestCredentialRevision = result.requestCredentialRevision;
  summary.currentCredentialRevision = result.currentCredentialRevision;
  return summary;
}

bool isSuccessfulHttpStatus(int statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

OpenApiDiagnosticResult diagnosticFailure(std::string error) {
  OpenApiDiagnosticResult result;
  result.error = std::move(error);
  return result;
}

std::string requestFailure(
    const char* requestName,
    const OpenApiClientResult& result) {
  if (!result.error.empty()) {
    return std::string(requestName) + " request failed at " +
        openApiClientFailureStageName(result.failureStage) + ": " +
        result.error;
  }
  return std::string(requestName) + " request returned HTTP " +
      std::to_string(result.response ? result.response->statusCode : 0);
}

} // namespace

std::string validateDiagnosticAddress(const std::string& address) {
  if (address.size() != 42 || address.rfind("0x", 0) != 0) {
    return "address must be a 20-byte 0x-prefixed value";
  }
  if (!std::all_of(address.begin() + 2, address.end(), [](unsigned char value) {
        return std::isxdigit(value) != 0;
      })) {
    return "address must contain hexadecimal characters only";
  }
  return {};
}

void runUsedChainListDiagnostic(
    std::shared_ptr<OpenApiClient> client,
    std::string address,
    OpenApiDiagnosticCompletion completion) {
  if (!completion) {
    return;
  }
  if (!client) {
    completion(diagnosticFailure("native OpenAPI client is unavailable"));
    return;
  }
  if (const auto addressError = validateDiagnosticAddress(address);
      !addressError.empty()) {
    completion(diagnosticFailure(addressError));
    return;
  }

  std::transform(
      address.begin(),
      address.end(),
      address.begin(),
      [](unsigned char value) { return static_cast<char>(std::tolower(value)); });

  client->execute(
      makeRequest(address),
      [client,
       address = std::move(address),
       completion = std::move(completion)](OpenApiClientResult first) mutable {
        OpenApiDiagnosticResult diagnostic;
        diagnostic.first = summarize(first);
        if (!first.isSuccess() ||
            !isSuccessfulHttpStatus(diagnostic.first.statusCode)) {
          diagnostic.error = requestFailure("first", first);
          completion(std::move(diagnostic));
          return;
        }

        client->execute(
            makeRequest(address),
            [diagnostic = std::move(diagnostic),
             completion = std::move(completion)](
                OpenApiClientResult second) mutable {
              diagnostic.second = summarize(second);
              if (!second.isSuccess() ||
                  !isSuccessfulHttpStatus(diagnostic.second.statusCode)) {
                diagnostic.error = requestFailure("second", second);
                completion(std::move(diagnostic));
                return;
              }

              diagnostic.secondUsedLatestAvailableCredential =
                  diagnostic.second.requestCredentialRevision >=
                  diagnostic.first.currentCredentialRevision;
              diagnostic.success =
                  diagnostic.secondUsedLatestAvailableCredential;
              if (!diagnostic.success) {
                diagnostic.error =
                    "second request did not use the latest available credential";
              }
              completion(std::move(diagnostic));
            });
      });
}

} // namespace rabby::openapi
