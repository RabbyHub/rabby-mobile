#include <rabby/openapi/RabbyOpenApiAssetModels.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>
#include <rabby/openapi/RabbyTokenSnapshotCodec.h>

#include <cassert>
#include <cmath>
#include <string>

namespace {

using rabby::openapi::parseTokenListResponse;
using rabby::openapi::parseUsedChainListResponse;

void testUsedChainListParsing() {
  const auto result = parseUsedChainListResponse(
      R"([{"id":"eth","name":"Ethereum"},{"id":"arb"}])");
  assert(result.isSuccess());
  assert(result.chainIds.size() == 2);
  assert(result.chainIds[0] == "eth");
  assert(result.chainIds[1] == "arb");
}

void testUsedChainListRejectsMalformedItems() {
  const auto wrongRoot = parseUsedChainListResponse(R"({"id":"eth"})");
  assert(!wrongRoot.isSuccess());

  const auto missingId = parseUsedChainListResponse(R"([{"name":"eth"}])");
  assert(!missingId.isSuccess());
  assert(missingId.chainIds.empty());
}

void testTokenParsingMatchesEntitySemantics() {
  const auto result = parseTokenListResponse(
      "0xAbC",
      R"([{
        "content_type":"image_url",
        "content":"https://example.test/token.png",
        "inner_id":7,
        "amount":2.5,
        "chain":"ETH",
        "decimals":18,
        "display_symbol":null,
        "id":"0xToken",
        "is_core":true,
        "is_verified":null,
        "is_wallet":true,
        "is_scam":false,
        "is_infinity":false,
        "is_suspicious":false,
        "logo_url":"https://example.test/logo.png",
        "name":"Token",
        "optimized_symbol":"TKN",
        "price":4,
        "symbol":"TKN",
        "time_at":1700000000,
        "credit_score":88,
        "protocol_id":"protocol",
        "launchpad":{"id":"launch"},
        "asset":{"id":"asset"},
        "market_status":"open",
        "raw_amount":"2500000000000000000",
        "raw_amount_hex_str":"0x22b1c8c1227a0000",
        "price_24h_change":0.12,
        "low_credit_score":false,
        "fdv":100,
        "cex_ids":["binance"],
        "identity":{"fdv":200}
      }])");

  assert(result.isSuccess());
  assert(result.sourceItemCount == 1);
  assert(result.filteredItemCount == 0);
  assert(result.tokens.size() == 1);
  const auto& token = result.tokens[0];
  assert(token.ownerAddress == "0xabc");
  assert(token.innerId == "7");
  assert(token.dbId == "0xabc-0xToken-ETH-7");
  assert(token.projectionResourceId == "0xabc:eth:0xtoken");
  assert(token.displaySymbol.empty());
  assert(token.isCore == true);
  assert(!token.isVerified.has_value());
  assert(std::abs(token.usdValue - 10) < 0.000001);
  assert(std::abs(token.fdv - 200) < 0.000001);
  assert(token.cexIdsJson == R"(["binance"])");
  assert(token.launchpadJson == R"({"id": "launch"})");
  assert(token.assetJson == R"({"id": "asset"})");
}

void testTokenDefaultsAndCommonFilter() {
  const auto result = parseTokenListResponse(
      "0xABC",
      R"([
        {"id":"good","chain":"eth","amount":1,"price":2},
        {"id":"unverified","chain":"eth","is_verified":false},
        {"id":"suspicious","chain":"eth","is_suspicious":true}
      ])");

  assert(result.isSuccess());
  assert(result.sourceItemCount == 3);
  assert(result.filteredItemCount == 2);
  assert(result.tokens.size() == 1);
  const auto& token = result.tokens[0];
  assert(token.id == "good");
  assert(token.decimals == 18);
  assert(!token.isCore.has_value());
  assert(!token.isVerified.has_value());
  assert(!token.isWallet);
  assert(token.rawAmount.empty());
  assert(token.cexIdsJson == "[]");
  assert(token.value24hChange == "1");
}

void testTokenParsingFailsClosed() {
  const auto invalidRequired =
      parseTokenListResponse("0xabc", R"([{"chain":"eth"}])");
  assert(!invalidRequired.isSuccess());
  assert(invalidRequired.tokens.empty());

  const auto invalidType = parseTokenListResponse(
      "0xabc", R"([{"id":"token","chain":"eth","amount":"1"}])");
  assert(!invalidType.isSuccess());
  assert(invalidType.tokens.empty());

  const auto invalidNested = parseTokenListResponse(
      "0xabc", R"([{"id":"token","chain":"eth","cex_ids":[1]}])");
  assert(!invalidNested.isSuccess());
  assert(invalidNested.tokens.empty());
}

void testTokenSnapshotCodecRoundTrip() {
  const auto parsed = parseTokenListResponse(
      "0xAbC",
      R"([{
        "id":"0xToken",
        "chain":"ETH",
        "amount":2.5,
        "price":4,
        "is_core":true,
        "price_24h_change":null,
        "launchpad":{"id":"launch"}
      }])");
  assert(parsed.isSuccess());
  const auto encoded = rabby::openapi::encodeTokenSnapshot(parsed.tokens);
  const auto decoded = rabby::openapi::decodeTokenSnapshot(encoded);
  assert(decoded.isSuccess());
  assert(decoded.tokens.size() == 1);
  const auto& token = decoded.tokens[0];
  assert(token.dbId == parsed.tokens[0].dbId);
  assert(token.ownerAddress == "0xabc");
  assert(token.isCore == true);
  assert(!token.price24hChange.has_value());
  assert(token.launchpadJson == R"({"id": "launch"})");
  assert(std::abs(token.usdValue - 10) < 0.000001);

  auto trailing = encoded;
  trailing.push_back(0);
  assert(!rabby::openapi::decodeTokenSnapshot(trailing).isSuccess());
}

void testTokenCacheSqlAndEmptySentinel() {
  const auto columns = rabby::openapi::tokenCacheColumnNames();
  assert(columns.size() == 38);
  assert(columns[0] == "_local_created_at");
  assert(columns[2] == "_db_id");
  assert(columns.back() == "cex_ids");

  const auto sql = rabby::openapi::tokenCacheUpsertSql();
  assert(sql.find("rabby_cache_tokenitem_20260816") != std::string::npos);
  assert(sql.find("ON CONFLICT (\"_db_id\")") != std::string::npos);
  assert(sql.find("\"_local_created_at\"=excluded") == std::string::npos);

  const auto empty = rabby::openapi::makeEmptyTokenRecord("0xabc");
  assert(empty.id == "rabby-empty-token-item-id");
  assert(empty.isCore == false);
  assert(empty.isVerified == false);
  assert(empty.dbId ==
      "0xabc-rabby-empty-token-item-id-rabby-empty-token-item-id");

  const auto probe =
      rabby::openapi::makeTokenCacheWriteProbeRecord(123456789);
  assert(probe.ownerAddress ==
      "__rabby_native_token_cache_write_probe__");
  assert(probe.id == "token-123456789");
  assert(probe.dbId ==
      "__rabby_native_token_cache_write_probe__-token-123456789-native-probe");
  assert(probe.usdValue == 1);
}

} // namespace

int main() {
  testUsedChainListParsing();
  testUsedChainListRejectsMalformedItems();
  testTokenParsingMatchesEntitySemantics();
  testTokenDefaultsAndCommonFilter();
  testTokenParsingFailsClosed();
  testTokenSnapshotCodecRoundTrip();
  testTokenCacheSqlAndEmptySentinel();
  return 0;
}
