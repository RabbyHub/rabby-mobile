#import <Foundation/Foundation.h>

#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <sqlite3.h>

#include <memory>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace rabby::openapi::apple {
namespace {

constexpr const char* kDatabaseDirectory = "LocalDatabase";
constexpr const char* kDatabaseName = "rabby-app.db";

bool executeSql(sqlite3* database, const std::string& sql) {
  return sqlite3_exec(database, sql.c_str(), nullptr, nullptr, nullptr) ==
      SQLITE_OK;
}

bool bindText(sqlite3_stmt* statement, int index, const std::string& value) {
  return sqlite3_bind_text(
             statement,
             index,
             value.data(),
             static_cast<int>(value.size()),
             SQLITE_TRANSIENT) == SQLITE_OK;
}

bool bindBoolean(sqlite3_stmt* statement, int index, bool value) {
  return sqlite3_bind_int(statement, index, value ? 1 : 0) == SQLITE_OK;
}

bool bindOptionalBoolean(
    sqlite3_stmt* statement,
    int index,
    const std::optional<bool>& value) {
  if (!value.has_value()) {
    return sqlite3_bind_null(statement, index) == SQLITE_OK;
  }
  return bindBoolean(statement, index, *value);
}

bool bindOptionalDouble(
    sqlite3_stmt* statement,
    int index,
    const std::optional<double>& value) {
  if (!value.has_value()) {
    return sqlite3_bind_null(statement, index) == SQLITE_OK;
  }
  return sqlite3_bind_double(statement, index, *value) == SQLITE_OK;
}

bool bindOptionalText(
    sqlite3_stmt* statement,
    int index,
    const std::optional<std::string>& value) {
  if (!value.has_value()) {
    return sqlite3_bind_null(statement, index) == SQLITE_OK;
  }
  return bindText(statement, index, *value);
}

bool bindToken(
    sqlite3_stmt* statement,
    const NativeTokenRecord& token,
    std::int64_t syncTimestampMs) {
  return sqlite3_bind_int64(statement, 1, syncTimestampMs) == SQLITE_OK &&
      sqlite3_bind_int64(statement, 2, syncTimestampMs) == SQLITE_OK &&
      bindText(statement, 3, token.dbId) &&
      bindText(statement, 4, token.ownerAddress) &&
      bindText(statement, 5, token.projectionResourceId) &&
      bindText(statement, 6, token.contentType) &&
      bindText(statement, 7, token.content) &&
      bindText(statement, 8, token.innerId) &&
      sqlite3_bind_double(
          statement, 9, token.amount * kLegacyRealStorageRatio) == SQLITE_OK &&
      bindText(statement, 10, token.chain) &&
      sqlite3_bind_double(statement, 11, token.decimals) == SQLITE_OK &&
      bindText(statement, 12, token.displaySymbol) &&
      bindText(statement, 13, token.id) &&
      bindOptionalBoolean(statement, 14, token.isCore) &&
      bindOptionalBoolean(statement, 15, token.isVerified) &&
      bindBoolean(statement, 16, token.isWallet) &&
      bindBoolean(statement, 17, token.isScam) &&
      bindBoolean(statement, 18, token.isInfinity) &&
      bindBoolean(statement, 19, token.isSuspicious) &&
      bindText(statement, 20, token.logoUrl) &&
      bindText(statement, 21, token.name) &&
      bindText(statement, 22, token.optimizedSymbol) &&
      sqlite3_bind_double(
          statement, 23, token.price * kLegacyRealStorageRatio) == SQLITE_OK &&
      bindText(statement, 24, token.symbol) &&
      sqlite3_bind_double(statement, 25, token.timeAt) == SQLITE_OK &&
      sqlite3_bind_double(statement, 26, token.usdValue) == SQLITE_OK &&
      sqlite3_bind_double(statement, 27, token.creditScore) == SQLITE_OK &&
      bindText(statement, 28, token.protocolId) &&
      bindOptionalText(statement, 29, token.launchpadJson) &&
      bindOptionalText(statement, 30, token.assetJson) &&
      bindText(statement, 31, token.marketStatus) &&
      bindText(statement, 32, token.rawAmount) &&
      bindText(statement, 33, token.rawAmountHex) &&
      bindOptionalDouble(statement, 34, token.price24hChange) &&
      bindBoolean(statement, 35, token.lowCreditScore) &&
      sqlite3_bind_double(statement, 36, token.fdv) == SQLITE_OK &&
      bindText(statement, 37, token.value24hChange) &&
      bindText(statement, 38, token.cexIdsJson);
}

bool hasExpectedSchema(sqlite3* database) {
  const std::string sql =
      "PRAGMA table_info(\"" + std::string(kTokenCacheTableName) + "\")";
  sqlite3_stmt* statement = nullptr;
  if (sqlite3_prepare_v2(
          database, sql.c_str(), -1, &statement, nullptr) != SQLITE_OK) {
    return false;
  }

  std::set<std::string> actualColumns;
  int stepResult = SQLITE_ROW;
  while ((stepResult = sqlite3_step(statement)) == SQLITE_ROW) {
    const auto* name = sqlite3_column_text(statement, 1);
    const auto size = sqlite3_column_bytes(statement, 1);
    if (name == nullptr || size <= 0) {
      sqlite3_finalize(statement);
      return false;
    }
    actualColumns.emplace(
        reinterpret_cast<const char*>(name), static_cast<std::size_t>(size));
  }
  sqlite3_finalize(statement);
  if (stepResult != SQLITE_DONE) {
    return false;
  }

  const auto expected = tokenCacheColumnNames();
  return actualColumns == std::set<std::string>(expected.begin(), expected.end());
}

std::optional<std::int64_t> countRowsForOwner(
    sqlite3* database,
    const std::string& ownerAddress) {
  const std::string sql = "SELECT COUNT(*) FROM \"" +
      std::string(kTokenCacheTableName) + "\" WHERE \"owner_addr\"=?";
  sqlite3_stmt* statement = nullptr;
  if (sqlite3_prepare_v2(
          database, sql.c_str(), -1, &statement, nullptr) != SQLITE_OK ||
      !bindText(statement, 1, ownerAddress) ||
      sqlite3_step(statement) != SQLITE_ROW) {
    if (statement != nullptr) {
      sqlite3_finalize(statement);
    }
    return std::nullopt;
  }
  const auto count = sqlite3_column_int64(statement, 0);
  sqlite3_finalize(statement);
  return count;
}

NSString* databasePath() {
  auto* libraryPaths = NSSearchPathForDirectoriesInDomains(
      NSLibraryDirectory, NSUserDomainMask, YES);
  if (libraryPaths.count == 0) {
    return nil;
  }
  auto* databaseDirectory =
      [NSString stringWithUTF8String:kDatabaseDirectory];
  auto* databaseName = [NSString stringWithUTF8String:kDatabaseName];
  auto* directory = [libraryPaths.firstObject
      stringByAppendingPathComponent:databaseDirectory];
  return [directory stringByAppendingPathComponent:databaseName];
}

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
    const std::set<std::string> replacementChains(
        replacementScope.chainIds.begin(),
        replacementScope.chainIds.end());
    if (replacementScope.kind == TokenCacheReplacementKind::Chains &&
        replacementChains.empty()) {
      return {false, 0, "selected-chain replacement requires a chain"};
    }
    auto* path = databasePath();
    if (path == nil ||
        ![[NSFileManager defaultManager] fileExistsAtPath:path]) {
      return {false, 0, "Apple token cache database is unavailable"};
    }

    sqlite3* database = nullptr;
    if (sqlite3_open_v2(
            path.fileSystemRepresentation,
            &database,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
            nullptr) != SQLITE_OK) {
      if (database != nullptr) {
        sqlite3_close(database);
      }
      return {false, 0, "Apple token cache database is unavailable"};
    }
    sqlite3_busy_timeout(database, 5000);
    if (!hasExpectedSchema(database)) {
      sqlite3_close(database);
      return {
          false,
          0,
          "token cache schema does not match the native writer contract",
      };
    }

    if (!executeSql(database, "BEGIN IMMEDIATE")) {
      sqlite3_close(database);
      return {false, 0, "Apple token cache transaction failed"};
    }

    bool success = true;
    sqlite3_stmt* upsert = nullptr;
    const auto upsertSql = tokenCacheUpsertSql();
    if (sqlite3_prepare_v2(
            database,
            upsertSql.c_str(),
            -1,
            &upsert,
            nullptr) != SQLITE_OK) {
      success = false;
    }

    for (const auto& token : tokens) {
      if (!success || token.ownerAddress != ownerAddress ||
          (replacementScope.kind == TokenCacheReplacementKind::Chains &&
           replacementChains.count(token.chain) == 0) ||
          !bindToken(upsert, token, syncTimestampMs) ||
          sqlite3_step(upsert) != SQLITE_DONE ||
          sqlite3_reset(upsert) != SQLITE_OK ||
          sqlite3_clear_bindings(upsert) != SQLITE_OK) {
        success = false;
        break;
      }
    }
    if (upsert != nullptr) {
      sqlite3_finalize(upsert);
    }

    if (replacementScope.kind == TokenCacheReplacementKind::Address) {
      sqlite3_stmt* deleteStale = nullptr;
      const auto deleteStaleSql = tokenCacheDeleteStaleSql();
      if (success &&
          sqlite3_prepare_v2(
              database,
              deleteStaleSql.c_str(),
              -1,
              &deleteStale,
              nullptr) == SQLITE_OK) {
        success = bindText(deleteStale, 1, ownerAddress) &&
            sqlite3_bind_int64(deleteStale, 2, syncTimestampMs) == SQLITE_OK &&
            sqlite3_step(deleteStale) == SQLITE_DONE;
      } else {
        success = false;
      }
      if (deleteStale != nullptr) {
        sqlite3_finalize(deleteStale);
      }
    } else {
      sqlite3_stmt* deleteStaleForChain = nullptr;
      const auto deleteStaleForChainSql = tokenCacheDeleteStaleForChainSql();
      if (!success ||
          sqlite3_prepare_v2(
              database,
              deleteStaleForChainSql.c_str(),
              -1,
              &deleteStaleForChain,
              nullptr) != SQLITE_OK) {
        success = false;
      }
      for (const auto& chainId : replacementChains) {
        if (!success ||
            !bindText(deleteStaleForChain, 1, ownerAddress) ||
            !bindText(deleteStaleForChain, 2, chainId) ||
            sqlite3_bind_int64(
                deleteStaleForChain, 3, syncTimestampMs) != SQLITE_OK ||
            sqlite3_step(deleteStaleForChain) != SQLITE_DONE ||
            sqlite3_reset(deleteStaleForChain) != SQLITE_OK ||
            sqlite3_clear_bindings(deleteStaleForChain) != SQLITE_OK) {
          success = false;
          break;
        }
      }
      if (deleteStaleForChain != nullptr) {
        sqlite3_finalize(deleteStaleForChain);
      }
    }

    if (success) {
      success = executeSql(database, rollbackOnly ? "ROLLBACK" : "COMMIT");
    }
    if (!success) {
      executeSql(database, "ROLLBACK");
    }
    if (success && rollbackOnly) {
      const auto persistedProbeRows = countRowsForOwner(database, ownerAddress);
      success = persistedProbeRows.has_value() && *persistedProbeRows == 0;
    }
    sqlite3_close(database);
    return success
        ? TokenCacheCommitResult{true, tokens.size(), {}}
        : TokenCacheCommitResult{
              false, 0, "Apple token cache transaction failed"};
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
