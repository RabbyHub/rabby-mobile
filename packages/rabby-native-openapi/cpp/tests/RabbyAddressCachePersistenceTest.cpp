#include <rabby/openapi/RabbyAddressCachePersistence.h>
#include <rabby/openapi/RabbyTokenCachePersistence.h>

#include <cassert>
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>
#include <vector>

namespace {

void testAddressSnapshotRoundTrip() {
  using rabby::openapi::AddressCacheValue;
  const std::vector<rabby::openapi::AddressCacheRow> rows = {
      {
          AddressCacheValue::null(),
          AddressCacheValue::textValue("hello"),
          AddressCacheValue::realValue(1.5),
          AddressCacheValue::integerValue(-7),
      },
  };
  const auto encoded = rabby::openapi::encodeAddressSnapshot(rows, 4);
  assert(!encoded.empty());
  const auto decoded =
      rabby::openapi::decodeAddressSnapshot(encoded, 4);
  assert(decoded.isSuccess());
  assert(decoded.rows.size() == 1);
  assert(decoded.rows[0].size() == 4);
  assert(decoded.rows[0][0].kind ==
      rabby::openapi::AddressCacheValueKind::Null);
  assert(decoded.rows[0][1].text == "hello");
  assert(std::abs(decoded.rows[0][2].real - 1.5) < 0.000001);
  assert(decoded.rows[0][3].integer == -7);

  auto trailing = encoded;
  trailing.push_back(0);
  assert(!rabby::openapi::decodeAddressSnapshot(trailing, 4).isSuccess());
  assert(!rabby::openapi::decodeAddressSnapshot(encoded, 3).isSuccess());
}

void testAddressSnapshotRejectsInvalidRows() {
  using rabby::openapi::AddressCacheValue;
  const std::vector<rabby::openapi::AddressCacheRow> wrongWidth = {
      {AddressCacheValue::textValue("one")},
  };
  assert(rabby::openapi::encodeAddressSnapshot(wrongWidth, 2).empty());

  const std::vector<rabby::openapi::AddressCacheRow> nonFinite = {
      {AddressCacheValue::realValue(
          std::numeric_limits<double>::infinity())},
  };
  assert(rabby::openapi::encodeAddressSnapshot(nonFinite, 1).empty());
}

void testProtocolCacheContractAndRows() {
  const auto contract = rabby::openapi::protocolCacheContract();
  assert(contract.tableName == "rabby_cache_portocolitem_20260817");
  assert(contract.columns.size() == 16);
  assert(contract.columns[0] == "_local_created_at");
  assert(contract.columns[3] == "owner_addr");
  assert(contract.columns.back() == "source_order");

  const auto upsert = rabby::openapi::addressCacheUpsertSql(contract);
  assert(upsert.find(contract.tableName) != std::string::npos);
  assert(upsert.find("ON CONFLICT (\"_db_id\")") != std::string::npos);
  assert(upsert.find("\"_local_created_at\"=excluded") ==
      std::string::npos);
  assert(rabby::openapi::addressCacheDeleteStaleSql(contract).find(
             "\"owner_addr\"=?") != std::string::npos);

  auto protocol = rabby::openapi::NativeProtocolRecord{};
  protocol.ownerAddress = "0xabc";
  protocol.id = "aave";
  protocol.chain = "eth";
  protocol.dbId = "0xabc-eth-aave";
  protocol.projectionResourceId = "0xabc:eth:aave";
  protocol.netWorth = 10;
  protocol.positiveRealUsdValue = 8;
  protocol.sourceIndex = 3;
  const auto rows = rabby::openapi::makeProtocolCacheRows(
      "0xabc", {protocol}, 1234);
  assert(rows.size() == 1);
  assert(rows[0].size() == contract.columns.size());
  assert(rows[0][0].integer == 1234);
  assert(rows[0][3].text == "0xabc");
  assert(rows[0][13].real == 10);
  assert(rows[0][15].integer == 3);

  const auto emptyRows = rabby::openapi::makeProtocolCacheRows(
      "0xabc", {}, 1234);
  assert(emptyRows.size() == 1);
  assert(emptyRows[0][5].text == "rabby-empty-protocol-item-id");
}

void testNftCacheContractAndRows() {
  const auto contract = rabby::openapi::nftCacheContract();
  assert(contract.tableName == "rabby_cache_nftitem_20260813");
  assert(contract.columns.size() == 26);
  assert(contract.columns[3] == "owner_addr");
  assert(contract.columns[14] == "amount");
  assert(contract.columns.back() == "collection");

  auto nft = rabby::openapi::NativeNftRecord{};
  nft.ownerAddress = "0xabc";
  nft.chain = "eth";
  nft.id = "nft-1";
  nft.dbId = "0xabc-eth-nft-1";
  nft.amount = 1.5;
  nft.collectionJson = R"({"id":"collection","nft_list":[]})";
  const auto rows = rabby::openapi::makeNftCacheRows("0xabc", {nft}, 1234);
  assert(rows.size() == 1);
  assert(rows[0].size() == contract.columns.size());
  assert(rows[0][3].text == "0xabc");
  assert(std::abs(rows[0][14].real - 27.0) < 0.000001);
  assert(rows[0][25].text == nft.collectionJson);

  const auto emptyRows =
      rabby::openapi::makeNftCacheRows("0xabc", {}, 1234);
  assert(emptyRows.size() == 1);
  assert(emptyRows[0][5].text == "rabby-empty-nft-item-id");
}

void testTokenCacheContractAndRows() {
  const auto contract = rabby::openapi::tokenCacheContract();
  assert(contract.tableName == "rabby_cache_tokenitem_20260816");
  assert(contract.columns.size() == 38);

  rabby::openapi::NativeTokenRecord token;
  token.dbId = "0xabc-token-eth";
  token.ownerAddress = "0xabc";
  token.projectionResourceId = "0xabc:eth:token";
  token.id = "token";
  token.chain = "eth";
  token.amount = 2;
  token.price = 3;
  token.isCore = true;
  token.isVerified = std::nullopt;
  token.price24hChange = 0.25;

  const auto rows = rabby::openapi::makeTokenCacheRows({token}, 1234);
  assert(rows.size() == 1);
  assert(rows[0].size() == contract.columns.size());
  assert(rows[0][0].integer == 1234);
  assert(rows[0][3].text == "0xabc");
  assert(std::abs(rows[0][8].real - 36.0) < 0.000001);
  assert(rows[0][13].integer == 1);
  assert(rows[0][14].kind ==
      rabby::openapi::AddressCacheValueKind::Null);
  assert(std::abs(rows[0][22].real - 54.0) < 0.000001);
  assert(std::abs(rows[0][33].real - 0.25) < 0.000001);

  const auto encoded = rabby::openapi::encodeAddressSnapshot(
      rows, contract.columns.size());
  const auto decoded = rabby::openapi::decodeAddressSnapshot(
      encoded, contract.columns.size());
  assert(decoded.isSuccess());
  assert(decoded.rows.size() == 1);
  assert(decoded.rows[0][2].text == token.dbId);
}

} // namespace

int main() {
  testAddressSnapshotRoundTrip();
  testAddressSnapshotRejectsInvalidRows();
  testProtocolCacheContractAndRows();
  testNftCacheContractAndRows();
  testTokenCacheContractAndRows();
  return 0;
}
