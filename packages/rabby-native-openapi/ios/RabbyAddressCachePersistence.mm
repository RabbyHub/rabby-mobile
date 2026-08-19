#include <rabby/openapi/RabbyAddressCachePersistence.h>

#include <op-sqlite/OPSqlite.hpp>

#include <memory>
#include <utility>
#include <vector>

namespace rabby::openapi::apple {
namespace {

constexpr const char* kDatabaseName = "rabby-app.db";

class AppleAddressCachePersistence final : public AddressCachePersistence {
 public:
  AddressCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const AddressCacheContract& contract,
      const std::vector<AddressCacheRow>& rows,
      std::int64_t syncTimestampMs) override {
    const auto rowPayload = encodeAddressSnapshot(rows, contract.columns.size());
    const std::vector<AddressCacheRow> deleteRows = {{
        AddressCacheValue::textValue(ownerAddress),
        AddressCacheValue::integerValue(syncTimestampMs),
    }};
    const auto deletePayload = encodeAddressSnapshot(deleteRows, 2);
    if (rowPayload.empty() || deletePayload.empty()) {
      return {false, 0, "Apple address cache snapshot encoding failed"};
    }

    opsqlite::NativeSnapshotRequest request{
        contract.tableName,
        contract.columns,
        addressCacheUpsertSql(contract),
        addressCacheDeleteStaleSql(contract),
        {rowPayload.data(), rowPayload.size()},
        {deletePayload.data(), deletePayload.size()},
        false,
    };
    const auto result = opsqlite::executeNativeSnapshotForDatabase(
        kDatabaseName, request);
    return result.success
        ? AddressCacheCommitResult{true, result.rowCount, {}}
        : AddressCacheCommitResult{
              false,
              0,
              result.error.empty()
                  ? "Apple address cache transaction failed"
                  : result.error,
          };
  }
};

} // namespace
} // namespace rabby::openapi::apple

namespace rabby::openapi {

std::shared_ptr<AddressCachePersistence>
makePlatformAddressCachePersistence() {
  static auto persistence =
      std::make_shared<apple::AppleAddressCachePersistence>();
  return persistence;
}

} // namespace rabby::openapi
