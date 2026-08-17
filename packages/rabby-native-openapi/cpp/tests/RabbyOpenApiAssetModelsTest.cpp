#include <rabby/openapi/RabbyOpenApiAssetModels.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>
#include <rabby/openapi/RabbyTokenSnapshotCodec.h>

#include <cassert>
#include <cmath>
#include <string>

namespace {

using rabby::openapi::parseTokenListResponse;
using rabby::openapi::parseUsedChainListResponse;
using rabby::openapi::parseNftListResponse;
using rabby::openapi::parseProtocolListResponse;

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

void testProtocolParsingMatchesProjectionSemantics() {
  const auto result = parseProtocolListResponse(
      "0xAbC",
      R"([{
        "id":"Aave",
        "chain":"ETH",
        "name":"Aave",
        "site_url":"https://aave.example",
        "logo_url":"https://aave.example/logo.png",
        "has_supported_portfolio":true,
        "tvl":100,
        "portfolio_item_list":[
          {
            "asset_token_list":[
              {"price":2,"amount":3},
              {"price":4,"amount":-1}
            ],
            "stats":{"net_usd_value":7}
          },
          {
            "asset_token_list":[
              {"price":5,"amount":2},
              {"price":3,"amount":-1}
            ],
            "stats":null
          }
        ]
      }])");

  assert(result.isSuccess());
  assert(result.sourceItemCount == 1);
  assert(result.protocols.size() == 1);
  const auto& protocol = result.protocols[0];
  assert(protocol.ownerAddress == "0xabc");
  assert(protocol.dbId == "0xabc-ETH-Aave");
  assert(protocol.projectionResourceId == "0xabc:eth:aave");
  assert(protocol.sourceIndex == 0);
  assert(std::abs(protocol.netWorth - 20) < 0.000001);
  assert(std::abs(protocol.positiveRealUsdValue - 9) < 0.000001);
  assert(protocol.portfolioItemListJson.find("asset_token_list") !=
      std::string::npos);
}

void testProtocolParsingFailsClosed() {
  const auto missingPortfolio = parseProtocolListResponse(
      "0xabc", R"([{"id":"aave","chain":"eth","name":"Aave"}])");
  assert(!missingPortfolio.isSuccess());

  const auto invalidToken = parseProtocolListResponse(
      "0xabc",
      R"([{
        "id":"aave","chain":"eth","name":"Aave",
        "portfolio_item_list":[{"asset_token_list":[{"price":"2"}]}]
      }])");
  assert(!invalidToken.isSuccess());
  assert(invalidToken.protocols.empty());
}

void testNftParsingMatchesCollectionSemantics() {
  const auto result = parseNftListResponse(
      "0xAbC",
      R"([{
        "chain":"ETH",
        "id":"NftOne",
        "contract_id":"contract",
        "inner_id":"Inner",
        "token_id":"7",
        "name":"NFT One",
        "contract_name":"Contract",
        "collection_name":"Collection",
        "description":"Description",
        "usd_price":2.5,
        "amount":1,
        "collection_id":"ETH:Collection",
        "content_type":"image_url",
        "content":"https://example.test/nft.png",
        "detail_url":"https://example.test/nft",
        "total_supply":"10",
        "is_erc1155":false,
        "is_erc721":true,
        "is_core":true,
        "thumbnail_url":"https://example.test/thumb.png",
        "pay_token":{"id":"eth"}
      }])",
      R"([{
        "id":"Collection",
        "chain":"ETH",
        "name":"Collection",
        "is_verified":true,
        "credit_score":88,
        "is_core":true,
        "is_hidden":false
      }])");

  assert(result.isSuccess());
  assert(result.sourceItemCount == 1);
  assert(result.sourceCollectionCount == 1);
  assert(result.filteredItemCount == 0);
  assert(result.nfts.size() == 1);
  const auto& nft = result.nfts[0];
  assert(nft.ownerAddress == "0xabc");
  assert(nft.dbId == "0xabc-ETH-NftOne-7");
  assert(nft.projectionResourceId ==
      "0xabc:eth:eth:collection:nftone:inner");
  assert(nft.collectionResourceId == "0xabc::eth::collection");
  assert(nft.collectionCreditScore == 88);
  assert(nft.collectionIsCore);
  assert(!nft.collectionIsHidden);
  assert(nft.collectionJson.find("\"nft_list\": []") !=
      std::string::npos);
  assert(nft.payTokenJson == R"({"id": "eth"})");
}

void testNftParsingPreservesBaselineFilteringAndStandaloneRows() {
  const auto result = parseNftListResponse(
      "0xabc",
      R"([
        {"chain":"eth","id":"hidden","collection_id":"eth:bad","is_erc721":true},
        {"chain":"eth","id":"standalone","inner_id":"one","is_erc721":true},
        {"chain":"eth","id":"missing","collection_id":"eth:missing","is_erc721":true}
      ])",
      R"([{
        "id":"bad","chain":"eth","is_verified":false,
        "credit_score":1,"is_core":false
      }])");

  assert(result.isSuccess());
  assert(result.sourceItemCount == 3);
  assert(result.filteredItemCount == 1);
  assert(result.nfts.size() == 2);
  assert(result.nfts[0].id == "standalone");
  assert(result.nfts[0].collectionResourceId.empty());
  assert(result.nfts[1].id == "missing");
  assert(result.nfts[1].collectionResourceId == "0xabc::eth::");
}

void testNftParsingFailsClosed() {
  const auto invalidCollection = parseNftListResponse(
      "0xabc",
      "[]",
      R"([{"id":"collection","chain":"eth","credit_score":"1"}])");
  assert(!invalidCollection.isSuccess());

  const auto invalidNft = parseNftListResponse(
      "0xabc",
      R"([{"chain":"eth","id":"nft","amount":"1"}])",
      "[]");
  assert(!invalidNft.isSuccess());
  assert(invalidNft.nfts.empty());
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
  testProtocolParsingMatchesProjectionSemantics();
  testProtocolParsingFailsClosed();
  testNftParsingMatchesCollectionSemantics();
  testNftParsingPreservesBaselineFilteringAndStandaloneRows();
  testNftParsingFailsClosed();
  return 0;
}
