#pragma once

#include <rabby/openapi/RabbyOpenApiClient.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace rabby::openapi {

enum class TokenSyncStage {
  None,
  UsedChains,
  TokenLists,
  Persistence,
  Cancelled,
  Superseded,
};

struct TokenSyncResult {
  bool success{false};
  std::string address;
  std::uint64_t generation{0};
  TokenSyncStage stage{TokenSyncStage::None};
  std::size_t chainCount{0};
  std::size_t sourceTokenCount{0};
  std::size_t filteredTokenCount{0};
  std::size_t committedRowCount{0};
  std::int64_t durationMs{0};
  std::string error;
};

struct TokenSyncStartResult {
  bool accepted{false};
  bool joinedExisting{false};
  std::uint64_t generation{0};
  std::string error;
};

using TokenSyncCompletion = std::function<void(TokenSyncResult)>;
using OpenApiExecute = std::function<std::shared_ptr<http::RequestHandle>(
    OpenApiClientRequest,
    OpenApiClientCompletion)>;
using MillisecondsProvider = std::function<std::int64_t()>;

class TokenSyncCoordinator {
 public:
  TokenSyncCoordinator(
      OpenApiExecute execute,
      std::shared_ptr<TokenCachePersistence> persistence,
      MillisecondsProvider millisecondsProvider,
      std::size_t maximumConcurrentTokenRequests = 15);
  ~TokenSyncCoordinator();

  TokenSyncStartResult syncAddress(
      std::string address,
      bool replaceExisting,
      TokenSyncCompletion completion);

  TokenSyncStartResult syncChains(
      std::string address,
      std::vector<std::string> chainIds,
      TokenCacheReplacementScope replacementScope,
      bool replaceExisting,
      TokenSyncCompletion completion);

  void cancelAddress(const std::string& address);
  void cancelAll();
  std::size_t activeSyncCount() const;

 private:
  class Impl;
  std::shared_ptr<Impl> impl_;
};

const char* tokenSyncStageName(TokenSyncStage stage);

} // namespace rabby::openapi
