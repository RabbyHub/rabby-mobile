#include <rabby/openapi/RabbyOpenApiCredential.h>

#include <algorithm>
#include <cctype>
#include <limits>
#include <string_view>
#include <utility>

namespace rabby::openapi {
namespace {

constexpr std::string_view kSetApiKeyHeader = "x-set-api-key";
constexpr std::size_t kMaxApiKeyBytes = 4096;

bool equalsCaseInsensitive(std::string_view left, std::string_view right) {
  if (left.size() != right.size()) {
    return false;
  }
  for (std::size_t index = 0; index < left.size(); ++index) {
    if (std::tolower(static_cast<unsigned char>(left[index])) !=
        std::tolower(static_cast<unsigned char>(right[index]))) {
      return false;
    }
  }
  return true;
}

struct RotatedApiKeyResult {
  std::optional<std::string> value;
  std::string error;
};

RotatedApiKeyResult findRotatedApiKey(
    const std::vector<http::Header>& headers) {
  std::optional<std::string> value;
  for (const auto& header : headers) {
    if (!equalsCaseInsensitive(header.name, kSetApiKeyHeader)) {
      continue;
    }
    if (value.has_value() && *value != header.value) {
      return {
          std::nullopt,
          "response contains conflicting x-set-api-key headers",
      };
    }
    value = header.value;
  }
  return {std::move(value), {}};
}

CredentialResponseResult failed(std::string error) {
  return {
      CredentialResponseDisposition::Failed,
      std::move(error),
  };
}

} // namespace

bool operator==(const ApiCredential& left, const ApiCredential& right) {
  return left.apiKey == right.apiKey && left.apiTime == right.apiTime;
}

bool operator!=(const ApiCredential& left, const ApiCredential& right) {
  return !(left == right);
}

bool operator==(
    const ApiCredentialSnapshot& left,
    const ApiCredentialSnapshot& right) {
  return left.revision == right.revision && left.value == right.value;
}

bool operator!=(
    const ApiCredentialSnapshot& left,
    const ApiCredentialSnapshot& right) {
  return !(left == right);
}

std::string validateApiCredential(const ApiCredential& credential) {
  if (credential.apiKey.empty()) {
    return "apiKey must not be empty";
  }
  if (credential.apiKey.size() > kMaxApiKeyBytes) {
    return "apiKey exceeds the maximum length";
  }
  if (std::any_of(
          credential.apiKey.begin(),
          credential.apiKey.end(),
          [](unsigned char character) {
            return character <= 0x20 || character >= 0x7f;
          })) {
    return "apiKey must contain visible ASCII characters only";
  }
  if (credential.apiTime <= 0) {
    return "apiTime must be positive";
  }
  return {};
}

ApiCredentialManager::ApiCredentialManager(
    std::shared_ptr<ApiCredentialPersistence> persistence,
    ApiKeyGenerator apiKeyGenerator,
    EpochSecondsProvider epochSecondsProvider)
    : persistence_(std::move(persistence)),
      apiKeyGenerator_(std::move(apiKeyGenerator)),
      epochSecondsProvider_(std::move(epochSecondsProvider)) {}

std::string ApiCredentialManager::initialize() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (current_.has_value()) {
    return {};
  }
  if (!persistence_) {
    return "credential persistence is required";
  }
  if (!apiKeyGenerator_) {
    return "API key generator is required";
  }
  if (!epochSecondsProvider_) {
    return "epoch seconds provider is required";
  }

  auto loaded = persistence_->load();
  if (!loaded.isSuccess()) {
    return "failed to load API credential: " + loaded.error;
  }
  if (loaded.value.has_value()) {
    if (const auto error = validateApiCredential(*loaded.value);
        !error.empty()) {
      return "persisted API credential is invalid: " + error;
    }
    current_ = ApiCredentialSnapshot{std::move(*loaded.value), 1};
    return {};
  }

  ApiCredential generated{
      apiKeyGenerator_(),
      epochSecondsProvider_(),
  };
  if (const auto error = validateApiCredential(generated); !error.empty()) {
    return "generated API credential is invalid: " + error;
  }
  if (const auto error = persistence_->save(generated); !error.empty()) {
    return "failed to persist generated API credential: " + error;
  }
  current_ = ApiCredentialSnapshot{std::move(generated), 1};
  return {};
}

std::optional<ApiCredentialSnapshot> ApiCredentialManager::snapshot() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return current_;
}

CredentialResponseResult ApiCredentialManager::handleResponse(
    const ApiCredentialSnapshot& requestCredential,
    const http::Response& response) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {CredentialResponseDisposition::IgnoredHttpStatus, {}};
  }

  auto rotatedKey = findRotatedApiKey(response.headers);
  if (!rotatedKey.error.empty()) {
    return failed(std::move(rotatedKey.error));
  }
  if (!rotatedKey.value.has_value()) {
    return {CredentialResponseDisposition::NoCredentialHeader, {}};
  }

  std::lock_guard<std::mutex> lock(mutex_);
  if (!current_.has_value()) {
    return failed("credential manager is not initialized");
  }
  if (requestCredential.revision != current_->revision ||
      requestCredential.value != current_->value) {
    return {CredentialResponseDisposition::StaleResponse, {}};
  }
  if (*rotatedKey.value == current_->value.apiKey) {
    return {CredentialResponseDisposition::Unchanged, {}};
  }
  if (current_->revision == std::numeric_limits<std::uint64_t>::max()) {
    return failed("credential revision is exhausted");
  }

  ApiCredential next{
      std::move(*rotatedKey.value),
      current_->value.apiTime,
  };
  if (const auto error = validateApiCredential(next); !error.empty()) {
    return failed("response API credential is invalid: " + error);
  }
  if (const auto error = persistence_->save(next); !error.empty()) {
    return failed("failed to persist response API credential: " + error);
  }

  const auto nextRevision = current_->revision + 1;
  current_ = ApiCredentialSnapshot{std::move(next), nextRevision};
  return {CredentialResponseDisposition::Updated, {}};
}

} // namespace rabby::openapi
