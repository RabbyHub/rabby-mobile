#pragma once

#include <rabby/openapi/RabbyAddressCachePersistence.h>
#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace rabby::openapi {

inline constexpr const char* kTokenCacheTableName =
    "rabby_cache_tokenitem_20260816";
inline constexpr const char* kEmptyTokenItemId =
    "rabby-empty-token-item-id";
inline constexpr double kLegacyRealStorageRatio = 18.0;

struct TokenCacheCommitResult {
  bool success{false};
  std::size_t rowCount{0};
  std::string error;
};

enum class TokenCacheReplacementKind {
  Address,
  Chains,
};

struct TokenCacheReplacementScope {
  TokenCacheReplacementKind kind{TokenCacheReplacementKind::Address};
  std::vector<std::string> chainIds;
};

class TokenCachePersistence {
 public:
  virtual ~TokenCachePersistence() = default;

  virtual TokenCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const std::vector<NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const TokenCacheReplacementScope& replacementScope) = 0;

  // Exercises the production schema, bindings, and transaction against the
  // real app database, but must roll back every write before returning.
  virtual TokenCacheCommitResult verifyWriteContract(
      std::int64_t syncTimestampMs) = 0;
};

std::vector<std::string> tokenCacheColumnNames();
AddressCacheContract tokenCacheContract();
std::string tokenCacheUpsertSql();
std::string tokenCacheDeleteStaleSql();
std::string tokenCacheDeleteStaleForChainSql();

AddressCacheRow makeTokenCacheRow(
    const NativeTokenRecord& token,
    std::int64_t syncTimestampMs);
std::vector<AddressCacheRow> makeTokenCacheRows(
    const std::vector<NativeTokenRecord>& tokens,
    std::int64_t syncTimestampMs);

NativeTokenRecord makeEmptyTokenRecord(const std::string& ownerAddress);
NativeTokenRecord makeEmptyTokenRecord(
    const std::string& ownerAddress,
    const std::string& chainId);
NativeTokenRecord makeTokenCacheWriteProbeRecord(
    std::int64_t syncTimestampMs);

// Implemented by exactly one platform adapter in each native target.
std::shared_ptr<TokenCachePersistence> makePlatformTokenCachePersistence();

} // namespace rabby::openapi
