#pragma once

#include <rabby/openapi/RabbyOpenApiClient.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>

namespace rabby::openapi {

struct OpenApiDiagnosticRequestSummary {
  int statusCode{0};
  std::int64_t durationMs{0};
  std::size_t bodyBytes{0};
  CredentialResponseDisposition credentialDisposition{
      CredentialResponseDisposition::NoCredentialHeader};
  std::uint64_t requestCredentialRevision{0};
  std::uint64_t currentCredentialRevision{0};
};

struct OpenApiDiagnosticResult {
  bool success{false};
  std::string error;
  OpenApiDiagnosticRequestSummary first;
  OpenApiDiagnosticRequestSummary second;
  bool secondUsedLatestAvailableCredential{false};
};

using OpenApiDiagnosticCompletion =
    std::function<void(OpenApiDiagnosticResult)>;

// Executes the fixed, read-only used-chain request twice. This is a
// non-production diagnostic for proving native signing, HTTP transport, and
// response-driven credential rotation without exposing response data to JS.
void runUsedChainListDiagnostic(
    std::shared_ptr<OpenApiClient> client,
    std::string address,
    OpenApiDiagnosticCompletion completion);

std::string validateDiagnosticAddress(const std::string& address);

} // namespace rabby::openapi
