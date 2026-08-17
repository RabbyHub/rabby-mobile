#import <Foundation/Foundation.h>

#include <rabby/openapi/RabbyAddressCachePersistence.h>

#include <sqlite3.h>

#include <memory>
#include <set>
#include <string>

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

bool bindValue(
    sqlite3_stmt* statement,
    int index,
    const AddressCacheValue& value) {
  switch (value.kind) {
    case AddressCacheValueKind::Null:
      return sqlite3_bind_null(statement, index) == SQLITE_OK;
    case AddressCacheValueKind::Text:
      return bindText(statement, index, value.text);
    case AddressCacheValueKind::Real:
      return sqlite3_bind_double(statement, index, value.real) == SQLITE_OK;
    case AddressCacheValueKind::Integer:
      return sqlite3_bind_int64(statement, index, value.integer) == SQLITE_OK;
  }
  return false;
}

bool hasExpectedSchema(
    sqlite3* database,
    const AddressCacheContract& contract) {
  const std::string sql =
      "PRAGMA table_info(\"" + contract.tableName + "\")";
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
  return stepResult == SQLITE_DONE &&
      actualColumns ==
      std::set<std::string>(contract.columns.begin(), contract.columns.end());
}

NSString* databasePath() {
  auto* libraryPaths = NSSearchPathForDirectoriesInDomains(
      NSLibraryDirectory, NSUserDomainMask, YES);
  if (libraryPaths.count == 0) {
    return nil;
  }
  auto* directory = [libraryPaths.firstObject stringByAppendingPathComponent:
      [NSString stringWithUTF8String:kDatabaseDirectory]];
  return [directory stringByAppendingPathComponent:
      [NSString stringWithUTF8String:kDatabaseName]];
}

class AppleAddressCachePersistence final : public AddressCachePersistence {
 public:
  AddressCacheCommitResult commitSnapshot(
      const std::string& ownerAddress,
      const AddressCacheContract& contract,
      const std::vector<AddressCacheRow>& rows,
      std::int64_t syncTimestampMs) override {
    if (contract.columns.size() < 4) {
      return {false, 0, "Apple address cache contract is unavailable"};
    }
    auto* path = databasePath();
    if (path == nil ||
        ![[NSFileManager defaultManager] fileExistsAtPath:path]) {
      return {false, 0, "Apple address cache database is unavailable"};
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
      return {false, 0, "Apple address cache database is unavailable"};
    }
    sqlite3_busy_timeout(database, 5000);
    if (!hasExpectedSchema(database, contract) ||
        !executeSql(database, "BEGIN IMMEDIATE")) {
      sqlite3_close(database);
      return {false, 0, "Apple address cache contract is unavailable"};
    }

    bool success = true;
    sqlite3_stmt* upsert = nullptr;
    const auto upsertSql = addressCacheUpsertSql(contract);
    if (upsertSql.empty() ||
        sqlite3_prepare_v2(
            database, upsertSql.c_str(), -1, &upsert, nullptr) != SQLITE_OK) {
      success = false;
    }
    for (const auto& row : rows) {
      if (!success || row.size() != contract.columns.size() ||
          row[0].kind != AddressCacheValueKind::Integer ||
          row[0].integer != syncTimestampMs ||
          row[1].kind != AddressCacheValueKind::Integer ||
          row[1].integer != syncTimestampMs ||
          row[2].kind != AddressCacheValueKind::Text || row[2].text.empty() ||
          row[3].kind != AddressCacheValueKind::Text ||
          row[3].text != ownerAddress) {
        success = false;
        break;
      }
      for (std::size_t index = 0; index < row.size(); ++index) {
        if (!bindValue(upsert, static_cast<int>(index + 1), row[index])) {
          success = false;
          break;
        }
      }
      if (!success || sqlite3_step(upsert) != SQLITE_DONE ||
          sqlite3_reset(upsert) != SQLITE_OK ||
          sqlite3_clear_bindings(upsert) != SQLITE_OK) {
        success = false;
        break;
      }
    }
    if (upsert != nullptr) {
      sqlite3_finalize(upsert);
    }

    sqlite3_stmt* deleteStale = nullptr;
    const auto deleteStaleSql = addressCacheDeleteStaleSql(contract);
    if (!success || deleteStaleSql.empty() ||
        sqlite3_prepare_v2(
            database,
            deleteStaleSql.c_str(),
            -1,
            &deleteStale,
            nullptr) != SQLITE_OK ||
        !bindText(deleteStale, 1, ownerAddress) ||
        sqlite3_bind_int64(deleteStale, 2, syncTimestampMs) != SQLITE_OK ||
        sqlite3_step(deleteStale) != SQLITE_DONE) {
      success = false;
    }
    if (deleteStale != nullptr) {
      sqlite3_finalize(deleteStale);
    }

    if (success) {
      success = executeSql(database, "COMMIT");
    }
    if (!success) {
      executeSql(database, "ROLLBACK");
    }
    sqlite3_close(database);
    return success
        ? AddressCacheCommitResult{true, rows.size(), {}}
        : AddressCacheCommitResult{
              false, 0, "Apple address cache transaction failed"};
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
