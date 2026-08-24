#pragma once

#include <rabby/http/RabbyHttpTypes.h>

#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>

namespace rabby::openapi {

struct ApiCredential {
  std::string apiKey;
  std::int64_t apiTime{0};
};

bool operator==(const ApiCredential& left, const ApiCredential& right);
bool operator!=(const ApiCredential& left, const ApiCredential& right);

// revision is process-local and prevents an older in-flight response from
// replacing a credential learned from a newer response.
struct ApiCredentialSnapshot {
  ApiCredential value;
  std::uint64_t revision{0};
};

bool operator==(
    const ApiCredentialSnapshot& left,
    const ApiCredentialSnapshot& right);
bool operator!=(
    const ApiCredentialSnapshot& left,
    const ApiCredentialSnapshot& right);

struct LoadApiCredentialResult {
  std::optional<ApiCredential> value;
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

class ApiCredentialPersistence {
 public:
  virtual ~ApiCredentialPersistence() = default;

  // A successful empty value means that no credential has been persisted.
  virtual LoadApiCredentialResult load() = 0;

  // Returns an empty string on success. Implementations must not include the
  // credential value in an error message.
  virtual std::string save(const ApiCredential& credential) = 0;
};

using ApiKeyGenerator = std::function<std::string()>;
using EpochSecondsProvider = std::function<std::int64_t()>;

enum class CredentialResponseDisposition {
  NoCredentialHeader,
  IgnoredHttpStatus,
  Unchanged,
  Updated,
  StaleResponse,
  Failed,
};

struct CredentialResponseResult {
  CredentialResponseDisposition disposition{
      CredentialResponseDisposition::Failed};
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }

  bool didUpdate() const {
    return disposition == CredentialResponseDisposition::Updated;
  }
};

// Owns the X-API-Key/X-API-Time lifecycle used alongside the legacy request
// signature. Platform code supplies secure UUID generation and persistence;
// this class owns ordering, validation, and response-driven key rotation.
class ApiCredentialManager {
 public:
  ApiCredentialManager(
      std::shared_ptr<ApiCredentialPersistence> persistence,
      ApiKeyGenerator apiKeyGenerator,
      EpochSecondsProvider epochSecondsProvider);

  // Loads an existing credential or creates and persists a new one. Calling
  // initialize more than once is idempotent after the first success.
  std::string initialize();

  std::optional<ApiCredentialSnapshot> snapshot() const;

  // Applies x-set-api-key only for a successful response to a request that
  // used the current credential revision. apiTime remains the installation
  // time, matching the existing JavaScript OpenAPI protocol.
  CredentialResponseResult handleResponse(
      const ApiCredentialSnapshot& requestCredential,
      const http::Response& response);

 private:
  std::shared_ptr<ApiCredentialPersistence> persistence_;
  ApiKeyGenerator apiKeyGenerator_;
  EpochSecondsProvider epochSecondsProvider_;

  mutable std::mutex mutex_;
  std::optional<ApiCredentialSnapshot> current_;
};

std::string validateApiCredential(const ApiCredential& credential);

} // namespace rabby::openapi
