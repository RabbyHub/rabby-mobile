#pragma once

#include <rabby/openapi/RabbyOpenApiAssetModels.h>

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace rabby::openapi {

enum class AddressCacheValueKind : std::uint8_t {
  Null = 0,
  Text = 1,
  Real = 2,
  Integer = 3,
};

struct AddressCacheValue {
  AddressCacheValueKind kind{AddressCacheValueKind::Null};
  std::string text;
  double real{0};
  std::int64_t integer{0};

  static AddressCacheValue null();
  static AddressCacheValue textValue(std::string value);
  static AddressCacheValue realValue(double value);
  static AddressCacheValue integerValue(std::int64_t value);
  static AddressCacheValue booleanValue(bool value);
};

using AddressCacheRow = std::vector<AddressCacheValue>;

struct AddressCacheContract {
  std::string tableName;
  std::vector<std::string> columns;
};

struct AddressCacheCommitResult {
  bool success{false};
  std::size_t rowCount{0};
  std::string error;
};

struct AddressSnapshotDecodeResult {
  std::vector<AddressCacheRow> rows;
  std::string error;

  bool isSuccess() const {
    return error.empty();
  }
};

class AddressCachePersistence {
 public:
  virtual ~AddressCachePersistence() = default;

  virtual AddressCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const AddressCacheContract& contract,
      const std::vector<AddressCacheRow>& rows,
      std::int64_t syncTimestampMs) = 0;
};

std::string addressCacheUpsertSql(const AddressCacheContract& contract);
std::string addressCacheDeleteStaleSql(const AddressCacheContract& contract);

std::vector<std::uint8_t> encodeAddressSnapshot(
    const std::vector<AddressCacheRow>& rows,
    std::size_t columnCount);
AddressSnapshotDecodeResult decodeAddressSnapshot(
    const std::vector<std::uint8_t>& payload,
    std::size_t expectedColumnCount);

inline constexpr const char* kProtocolCacheTableName =
    "rabby_cache_portocolitem_20260817";
inline constexpr const char* kEmptyProtocolItemId =
    "rabby-empty-protocol-item-id";

AddressCacheContract protocolCacheContract();
NativeProtocolRecord makeEmptyProtocolRecord(
    const std::string& ownerAddress);
AddressCacheRow makeProtocolCacheRow(
    const NativeProtocolRecord& protocol,
    std::int64_t syncTimestampMs);
std::vector<AddressCacheRow> makeProtocolCacheRows(
    const std::string& ownerAddress,
    const std::vector<NativeProtocolRecord>& protocols,
    std::int64_t syncTimestampMs);

// Implemented by exactly one platform adapter in each native target.
std::shared_ptr<AddressCachePersistence>
makePlatformAddressCachePersistence();

} // namespace rabby::openapi
