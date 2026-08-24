#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <op-sqlite/OPSqlite.hpp>

#include <algorithm>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace rabby::openapi::apple {
namespace {

constexpr const char* kDatabaseName = "rabby-app.db";

class AppleTokenCachePersistence final : public TokenCachePersistence {
 public:
  TokenCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const std::vector<NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const TokenCacheReplacementScope& replacementScope) override {
    return runSnapshot(
        ownerAddress,
        tokens,
        syncTimestampMs,
        replacementScope,
        false);
  }

  TokenCacheCommitResult verifyWriteContract(
      std::int64_t syncTimestampMs) override {
    auto probe = makeTokenCacheWriteProbeRecord(syncTimestampMs);
    const auto ownerAddress = probe.ownerAddress;
    return runSnapshot(
        ownerAddress,
        {std::move(probe)},
        syncTimestampMs,
        TokenCacheReplacementScope{},
        true);
  }

 private:
  TokenCacheCommitResult runSnapshot(
      const std::string& ownerAddress,
      const std::vector<NativeTokenRecord>& tokens,
      std::int64_t syncTimestampMs,
      const TokenCacheReplacementScope& replacementScope,
      bool rollbackOnly) {
    std::vector<AddressCacheRow> deleteRows;
    std::string deleteSql;
    std::size_t deleteColumnCount = 0;
    if (replacementScope.kind == TokenCacheReplacementKind::Address) {
      deleteSql = tokenCacheDeleteStaleSql();
      deleteColumnCount = 2;
      deleteRows.push_back({
          AddressCacheValue::textValue(ownerAddress),
          AddressCacheValue::integerValue(syncTimestampMs),
      });
    } else {
      if (replacementScope.chainIds.empty()) {
        return {false, 0, "selected-chain replacement requires a chain"};
      }
      deleteSql = tokenCacheDeleteStaleForChainSql();
      deleteColumnCount = 3;
      for (const auto& chainId : replacementScope.chainIds) {
        deleteRows.push_back({
            AddressCacheValue::textValue(ownerAddress),
            AddressCacheValue::textValue(chainId),
            AddressCacheValue::integerValue(syncTimestampMs),
        });
      }
    }

    for (const auto& token : tokens) {
      if (token.ownerAddress != ownerAddress ||
          (replacementScope.kind == TokenCacheReplacementKind::Chains &&
           std::find(
               replacementScope.chainIds.begin(),
               replacementScope.chainIds.end(),
               token.chain) == replacementScope.chainIds.end())) {
        return {false, 0, "Apple token cache snapshot scope is invalid"};
      }
    }

    const auto contract = tokenCacheContract();
    const auto rows = makeTokenCacheRows(tokens, syncTimestampMs);
    const auto rowPayload = encodeAddressSnapshot(
        rows, contract.columns.size());
    const auto deletePayload = encodeAddressSnapshot(
        deleteRows, deleteColumnCount);
    if (rowPayload.empty() || deletePayload.empty()) {
      return {false, 0, "Apple token cache snapshot encoding failed"};
    }

    opsqlite::NativeSnapshotRequest request{
        contract.tableName,
        contract.columns,
        tokenCacheUpsertSql(),
        std::move(deleteSql),
        {rowPayload.data(), rowPayload.size()},
        {deletePayload.data(), deletePayload.size()},
        rollbackOnly,
    };
    const auto result = opsqlite::executeNativeSnapshotForDatabase(
        kDatabaseName, request);
    return result.success
        ? TokenCacheCommitResult{true, result.rowCount, {}}
        : TokenCacheCommitResult{
              false,
              0,
              result.error.empty()
                  ? "Apple token cache transaction failed"
                  : result.error,
          };
  }
};

} // namespace
} // namespace rabby::openapi::apple

namespace rabby::openapi {

std::shared_ptr<TokenCachePersistence> makePlatformTokenCachePersistence() {
  static auto persistence =
      std::make_shared<apple::AppleTokenCachePersistence>();
  return persistence;
}

} // namespace rabby::openapi
