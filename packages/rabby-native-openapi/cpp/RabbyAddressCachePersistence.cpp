#include <rabby/openapi/RabbyAddressCachePersistence.h>

#include <cmath>
#include <cstring>
#include <limits>
#include <sstream>
#include <utility>

namespace rabby::openapi {
namespace {

constexpr std::uint8_t kMagic[] = {'R', 'A', 'S', '1'};
constexpr std::uint32_t kMaximumRows = 1000000;
constexpr std::uint32_t kMaximumColumns = 256;

std::string quoteIdentifier(const std::string& value) {
  return '"' + value + '"';
}

bool isValidContract(const AddressCacheContract& contract) {
  return !contract.tableName.empty() && contract.columns.size() >= 4 &&
      contract.columns[0] == "_local_created_at" &&
      contract.columns[1] == "_local_updated_at" &&
      contract.columns[2] == "_db_id" &&
      contract.columns[3] == "owner_addr" &&
      contract.columns.size() <= kMaximumColumns;
}

class Encoder {
 public:
  void byte(std::uint8_t value) {
    output_.push_back(value);
  }

  void uint32(std::uint32_t value) {
    for (int shift = 0; shift < 32; shift += 8) {
      byte(static_cast<std::uint8_t>((value >> shift) & 0xffU));
    }
  }

  void uint64(std::uint64_t value) {
    for (int shift = 0; shift < 64; shift += 8) {
      byte(static_cast<std::uint8_t>((value >> shift) & 0xffU));
    }
  }

  void integer(std::int64_t value) {
    std::uint64_t bits = 0;
    std::memcpy(&bits, &value, sizeof(value));
    uint64(bits);
  }

  void number(double value) {
    std::uint64_t bits = 0;
    static_assert(sizeof(bits) == sizeof(value));
    std::memcpy(&bits, &value, sizeof(value));
    uint64(bits);
  }

  void string(const std::string& value) {
    if (value.size() > std::numeric_limits<std::uint32_t>::max()) {
      uint32(0);
      return;
    }
    uint32(static_cast<std::uint32_t>(value.size()));
    output_.insert(output_.end(), value.begin(), value.end());
  }

  std::vector<std::uint8_t> take() {
    return std::move(output_);
  }

 private:
  std::vector<std::uint8_t> output_;
};

class Decoder {
 public:
  explicit Decoder(const std::vector<std::uint8_t>& input) : input_(input) {}

  bool byte(std::uint8_t& value) {
    if (position_ >= input_.size()) {
      return false;
    }
    value = input_[position_++];
    return true;
  }

  bool uint32(std::uint32_t& value) {
    value = 0;
    for (int shift = 0; shift < 32; shift += 8) {
      std::uint8_t part = 0;
      if (!byte(part)) {
        return false;
      }
      value |= static_cast<std::uint32_t>(part) << shift;
    }
    return true;
  }

  bool uint64(std::uint64_t& value) {
    value = 0;
    for (int shift = 0; shift < 64; shift += 8) {
      std::uint8_t part = 0;
      if (!byte(part)) {
        return false;
      }
      value |= static_cast<std::uint64_t>(part) << shift;
    }
    return true;
  }

  bool integer(std::int64_t& value) {
    std::uint64_t bits = 0;
    if (!uint64(bits)) {
      return false;
    }
    std::memcpy(&value, &bits, sizeof(value));
    return true;
  }

  bool number(double& value) {
    std::uint64_t bits = 0;
    if (!uint64(bits)) {
      return false;
    }
    std::memcpy(&value, &bits, sizeof(value));
    return std::isfinite(value);
  }

  bool string(std::string& value) {
    std::uint32_t size = 0;
    if (!uint32(size) || size > input_.size() - position_) {
      return false;
    }
    value.assign(
        reinterpret_cast<const char*>(input_.data() + position_), size);
    position_ += size;
    return true;
  }

  bool finished() const {
    return position_ == input_.size();
  }

 private:
  const std::vector<std::uint8_t>& input_;
  std::size_t position_{0};
};

} // namespace

AddressCacheValue AddressCacheValue::null() {
  return {};
}

AddressCacheValue AddressCacheValue::textValue(std::string value) {
  AddressCacheValue result;
  result.kind = AddressCacheValueKind::Text;
  result.text = std::move(value);
  return result;
}

AddressCacheValue AddressCacheValue::realValue(double value) {
  AddressCacheValue result;
  result.kind = AddressCacheValueKind::Real;
  result.real = value;
  return result;
}

AddressCacheValue AddressCacheValue::integerValue(std::int64_t value) {
  AddressCacheValue result;
  result.kind = AddressCacheValueKind::Integer;
  result.integer = value;
  return result;
}

AddressCacheValue AddressCacheValue::booleanValue(bool value) {
  return integerValue(value ? 1 : 0);
}

std::string addressCacheUpsertSql(const AddressCacheContract& contract) {
  if (!isValidContract(contract)) {
    return {};
  }
  std::ostringstream sql;
  sql << "INSERT INTO " << quoteIdentifier(contract.tableName) << " (";
  for (std::size_t index = 0; index < contract.columns.size(); ++index) {
    if (index != 0) {
      sql << ',';
    }
    sql << quoteIdentifier(contract.columns[index]);
  }
  sql << ") VALUES (";
  for (std::size_t index = 0; index < contract.columns.size(); ++index) {
    if (index != 0) {
      sql << ',';
    }
    sql << '?';
  }
  sql << ") ON CONFLICT (\"_db_id\") DO UPDATE SET ";
  bool hasUpdate = false;
  for (const auto& column : contract.columns) {
    if (column == "_local_created_at" || column == "_db_id") {
      continue;
    }
    if (hasUpdate) {
      sql << ',';
    }
    sql << quoteIdentifier(column) << "=excluded." << quoteIdentifier(column);
    hasUpdate = true;
  }
  return sql.str();
}

std::string addressCacheDeleteStaleSql(const AddressCacheContract& contract) {
  if (!isValidContract(contract)) {
    return {};
  }
  return "DELETE FROM " + quoteIdentifier(contract.tableName) +
      " WHERE \"owner_addr\"=? AND \"_local_updated_at\"<?";
}

std::vector<std::uint8_t> encodeAddressSnapshot(
    const std::vector<AddressCacheRow>& rows,
    std::size_t columnCount) {
  if (rows.size() > kMaximumRows || columnCount == 0 ||
      columnCount > kMaximumColumns) {
    return {};
  }
  Encoder output;
  for (const auto value : kMagic) {
    output.byte(value);
  }
  output.uint32(static_cast<std::uint32_t>(columnCount));
  output.uint32(static_cast<std::uint32_t>(rows.size()));
  for (const auto& row : rows) {
    if (row.size() != columnCount) {
      return {};
    }
    for (const auto& value : row) {
      output.byte(static_cast<std::uint8_t>(value.kind));
      switch (value.kind) {
        case AddressCacheValueKind::Null:
          break;
        case AddressCacheValueKind::Text:
          output.string(value.text);
          break;
        case AddressCacheValueKind::Real:
          if (!std::isfinite(value.real)) {
            return {};
          }
          output.number(value.real);
          break;
        case AddressCacheValueKind::Integer:
          output.integer(value.integer);
          break;
      }
    }
  }
  return output.take();
}

AddressSnapshotDecodeResult decodeAddressSnapshot(
    const std::vector<std::uint8_t>& payload,
    std::size_t expectedColumnCount) {
  AddressSnapshotDecodeResult result;
  Decoder input(payload);
  for (const auto expected : kMagic) {
    std::uint8_t actual = 0;
    if (!input.byte(actual) || actual != expected) {
      result.error = "invalid address snapshot magic";
      return result;
    }
  }

  std::uint32_t columnCount = 0;
  std::uint32_t rowCount = 0;
  if (!input.uint32(columnCount) || columnCount != expectedColumnCount ||
      columnCount == 0 || columnCount > kMaximumColumns) {
    result.error = "invalid address snapshot column count";
    return result;
  }
  if (!input.uint32(rowCount) || rowCount > kMaximumRows) {
    result.error = "invalid address snapshot row count";
    return result;
  }

  result.rows.reserve(rowCount);
  for (std::uint32_t rowIndex = 0; rowIndex < rowCount; ++rowIndex) {
    AddressCacheRow row;
    row.reserve(columnCount);
    for (std::uint32_t columnIndex = 0;
         columnIndex < columnCount;
         ++columnIndex) {
      std::uint8_t encodedKind = 0;
      if (!input.byte(encodedKind) ||
          encodedKind > static_cast<std::uint8_t>(
              AddressCacheValueKind::Integer)) {
        result.error = "invalid address snapshot value kind";
        result.rows.clear();
        return result;
      }
      AddressCacheValue value;
      value.kind = static_cast<AddressCacheValueKind>(encodedKind);
      bool decoded = true;
      switch (value.kind) {
        case AddressCacheValueKind::Null:
          break;
        case AddressCacheValueKind::Text:
          decoded = input.string(value.text);
          break;
        case AddressCacheValueKind::Real:
          decoded = input.number(value.real);
          break;
        case AddressCacheValueKind::Integer:
          decoded = input.integer(value.integer);
          break;
      }
      if (!decoded) {
        result.error = "invalid address snapshot value";
        result.rows.clear();
        return result;
      }
      row.push_back(std::move(value));
    }
    result.rows.push_back(std::move(row));
  }
  if (!input.finished()) {
    result.error = "address snapshot has trailing bytes";
    result.rows.clear();
  }
  return result;
}

AddressCacheContract protocolCacheContract() {
  return {
      kProtocolCacheTableName,
      {
          "_local_created_at",
          "_local_updated_at",
          "_db_id",
          "owner_addr",
          "projection_resource_id",
          "id",
          "chain",
          "name",
          "site_url",
          "logo_url",
          "has_supported_portfolio",
          "tvl",
          "portfolio_item_list",
          "net_worth",
          "positive_real_usd_value",
          "source_order",
      },
  };
}

NativeProtocolRecord makeEmptyProtocolRecord(
    const std::string& ownerAddress) {
  NativeProtocolRecord protocol;
  protocol.ownerAddress = ownerAddress;
  protocol.id = kEmptyProtocolItemId;
  protocol.chain = kEmptyProtocolItemId;
  protocol.name = kEmptyProtocolItemId;
  protocol.siteUrl = kEmptyProtocolItemId;
  protocol.logoUrl = kEmptyProtocolItemId;
  protocol.dbId =
      buildProtocolDbId(protocol.ownerAddress, protocol.chain, protocol.id);
  protocol.projectionResourceId = buildProtocolProjectionResourceId(
      protocol.ownerAddress, protocol.chain, protocol.id);
  return protocol;
}

AddressCacheRow makeProtocolCacheRow(
    const NativeProtocolRecord& protocol,
    std::int64_t syncTimestampMs) {
  return {
      AddressCacheValue::integerValue(syncTimestampMs),
      AddressCacheValue::integerValue(syncTimestampMs),
      AddressCacheValue::textValue(protocol.dbId),
      AddressCacheValue::textValue(protocol.ownerAddress),
      AddressCacheValue::textValue(protocol.projectionResourceId),
      AddressCacheValue::textValue(protocol.id),
      AddressCacheValue::textValue(protocol.chain),
      AddressCacheValue::textValue(protocol.name),
      AddressCacheValue::textValue(protocol.siteUrl),
      AddressCacheValue::textValue(protocol.logoUrl),
      AddressCacheValue::booleanValue(protocol.hasSupportedPortfolio),
      AddressCacheValue::realValue(protocol.tvl),
      AddressCacheValue::textValue(protocol.portfolioItemListJson),
      AddressCacheValue::realValue(protocol.netWorth),
      AddressCacheValue::realValue(protocol.positiveRealUsdValue),
      AddressCacheValue::integerValue(
          static_cast<std::int64_t>(protocol.sourceIndex)),
  };
}

std::vector<AddressCacheRow> makeProtocolCacheRows(
    const std::string& ownerAddress,
    const std::vector<NativeProtocolRecord>& protocols,
    std::int64_t syncTimestampMs) {
  std::vector<AddressCacheRow> rows;
  if (protocols.empty()) {
    rows.push_back(makeProtocolCacheRow(
        makeEmptyProtocolRecord(ownerAddress), syncTimestampMs));
    return rows;
  }
  rows.reserve(protocols.size());
  for (const auto& protocol : protocols) {
    rows.push_back(makeProtocolCacheRow(protocol, syncTimestampMs));
  }
  return rows;
}

} // namespace rabby::openapi
