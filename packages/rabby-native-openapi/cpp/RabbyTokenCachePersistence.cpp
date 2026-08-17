#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <sstream>

namespace rabby::openapi {
namespace {

const std::vector<std::string>& columns() {
  static const std::vector<std::string> value = {
      "_local_created_at",
      "_local_updated_at",
      "_db_id",
      "owner_addr",
      "projection_resource_id",
      "content_type",
      "content",
      "inner_id",
      "amount",
      "chain",
      "decimals",
      "display_symbol",
      "id",
      "is_core",
      "is_verified",
      "is_wallet",
      "is_scam",
      "is_infinity",
      "is_suspicious",
      "logo_url",
      "name",
      "optimized_symbol",
      "price",
      "symbol",
      "time_at",
      "usd_value",
      "credit_score",
      "protocol_id",
      "launchpad",
      "asset",
      "market_status",
      "raw_amount",
      "raw_amount_hex_str",
      "price_24h_change",
      "low_credit_score",
      "fdv",
      "value_24h_change",
      "cex_ids",
  };
  return value;
}

std::string quoteIdentifier(const std::string& value) {
  return '"' + value + '"';
}

} // namespace

std::vector<std::string> tokenCacheColumnNames() {
  return columns();
}

std::string tokenCacheUpsertSql() {
  std::ostringstream sql;
  sql << "INSERT INTO " << quoteIdentifier(kTokenCacheTableName) << " (";
  for (std::size_t index = 0; index < columns().size(); ++index) {
    if (index != 0) {
      sql << ',';
    }
    sql << quoteIdentifier(columns()[index]);
  }
  sql << ") VALUES (";
  for (std::size_t index = 0; index < columns().size(); ++index) {
    if (index != 0) {
      sql << ',';
    }
    sql << '?';
  }
  sql << ") ON CONFLICT (\"_db_id\") DO UPDATE SET ";
  bool hasUpdate = false;
  for (const auto& column : columns()) {
    if (column == "_local_created_at" || column == "_db_id") {
      continue;
    }
    if (hasUpdate) {
      sql << ',';
    }
    sql << quoteIdentifier(column) << "=excluded."
        << quoteIdentifier(column);
    hasUpdate = true;
  }
  return sql.str();
}

std::string tokenCacheDeleteStaleSql() {
  return "DELETE FROM \"" + std::string(kTokenCacheTableName) +
      "\" WHERE \"owner_addr\"=? AND \"_local_updated_at\"<?";
}

std::string tokenCacheDeleteStaleForChainSql() {
  return "DELETE FROM \"" + std::string(kTokenCacheTableName) +
      "\" WHERE \"owner_addr\"=? AND \"chain\"=? AND "
      "\"_local_updated_at\"<?";
}

NativeTokenRecord makeEmptyTokenRecord(const std::string& ownerAddress) {
  return makeEmptyTokenRecord(ownerAddress, kEmptyTokenItemId);
}

NativeTokenRecord makeEmptyTokenRecord(
    const std::string& ownerAddress,
    const std::string& chainId) {
  NativeTokenRecord token;
  token.ownerAddress = ownerAddress;
  token.chain = chainId;
  token.displaySymbol = kEmptyTokenItemId;
  token.id = kEmptyTokenItemId;
  token.isCore = false;
  token.isVerified = false;
  token.logoUrl = kEmptyTokenItemId;
  token.name = kEmptyTokenItemId;
  token.optimizedSymbol = kEmptyTokenItemId;
  token.symbol = kEmptyTokenItemId;
  token.dbId = buildTokenDbId(
      token.ownerAddress, token.id, token.chain, token.innerId);
  token.projectionResourceId = buildTokenProjectionResourceId(
      token.ownerAddress, token.chain, token.id);
  return token;
}

NativeTokenRecord makeTokenCacheWriteProbeRecord(
    std::int64_t syncTimestampMs) {
  constexpr const char* ownerAddress =
      "__rabby_native_token_cache_write_probe__";
  NativeTokenRecord token;
  token.ownerAddress = ownerAddress;
  token.chain = "native-probe";
  token.id = "token-" + std::to_string(syncTimestampMs);
  token.displaySymbol = "PROBE";
  token.isCore = true;
  token.isVerified = true;
  token.logoUrl = "native-probe";
  token.name = "Native token cache write probe";
  token.optimizedSymbol = "PROBE";
  token.symbol = "PROBE";
  token.amount = 1;
  token.price = 1;
  token.usdValue = 1;
  token.dbId = buildTokenDbId(
      token.ownerAddress, token.id, token.chain, token.innerId);
  token.projectionResourceId = buildTokenProjectionResourceId(
      token.ownerAddress, token.chain, token.id);
  return token;
}

} // namespace rabby::openapi
