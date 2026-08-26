package com.debank.rabbymobile;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class WorkerAssetStoreModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "WorkerAssetStore";
  private static final String DATABASE_NAME = "rabby-app.db";
  private static final String TOKEN_TABLE = "rabby_cache_tokenitem_20260816";
  private static final Object DATABASE_WRITE_LOCK = new Object();
  private static final Set<String> INTEGER_COLUMNS = new HashSet<>(Arrays.asList(
      "_local_created_at",
      "_local_updated_at",
      "is_core",
      "is_verified",
      "is_wallet",
      "is_scam",
      "is_infinity",
      "is_suspicious",
      "time_at",
      "low_credit_score"));

  private static final String[] TOKEN_COLUMNS = new String[] {
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

  WorkerAssetStoreModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void commitTokenSnapshot(
      String rawAddress,
      double rawSyncTimestamp,
      ReadableArray rows,
      Promise promise) {
    final String address = rawAddress.toLowerCase();
    final long syncTimestamp = (long) rawSyncTimestamp;
    if (address.length() == 0 || syncTimestamp <= 0 || rows.size() == 0) {
      promise.reject(
          "worker_asset_store_invalid_snapshot",
          "Worker token snapshot is invalid");
      return;
    }

    synchronized (DATABASE_WRITE_LOCK) {
      SQLiteDatabase database = null;
      try {
        File databaseFile = getReactApplicationContext().getDatabasePath(
            DATABASE_NAME);
        if (!databaseFile.isFile()) {
          throw new IllegalStateException("app_database_missing");
        }
        database = SQLiteDatabase.openDatabase(
            databaseFile.getAbsolutePath(),
            null,
            SQLiteDatabase.OPEN_READWRITE |
                SQLiteDatabase.NO_LOCALIZED_COLLATORS);
        database.execSQL("PRAGMA busy_timeout=5000");
        validateTokenTable(database);
        database.beginTransactionNonExclusive();

        if (hasNewerTokenSnapshot(database, address, syncTimestamp)) {
          database.setTransactionSuccessful();
          database.endTransaction();
          WritableMap result = Arguments.createMap();
          result.putInt("rowCount", 0);
          result.putBoolean("applied", false);
          promise.resolve(result);
          return;
        }

        SQLiteStatement upsert = database.compileStatement(buildUpsertSql());
        try {
          for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            ReadableMap row = rows.getMap(rowIndex);
            if (row == null ||
                !row.hasKey("owner_addr") ||
                row.isNull("owner_addr") ||
                row.getType("owner_addr") != ReadableType.String ||
                !address.equals(row.getString("owner_addr"))) {
              throw new IllegalArgumentException("snapshot_scope_mismatch");
            }
            upsert.clearBindings();
            for (int columnIndex = 0; columnIndex < TOKEN_COLUMNS.length;
                 columnIndex++) {
              bindValue(
                  upsert,
                  columnIndex + 1,
                  row,
                  TOKEN_COLUMNS[columnIndex]);
            }
            upsert.executeInsert();
          }
        } finally {
          upsert.close();
        }

        SQLiteStatement cleanup = database.compileStatement(
            "DELETE FROM \"" + TOKEN_TABLE +
                "\" WHERE \"owner_addr\"=? AND \"_local_updated_at\"<?");
        try {
          cleanup.bindString(1, address);
          cleanup.bindLong(2, syncTimestamp);
          cleanup.executeUpdateDelete();
        } finally {
          cleanup.close();
        }

        database.setTransactionSuccessful();
        database.endTransaction();
        WritableMap result = Arguments.createMap();
        result.putInt("rowCount", rows.size());
        result.putBoolean("applied", true);
        promise.resolve(result);
      } catch (Exception error) {
        promise.reject(
            "worker_asset_store_commit_failed",
            error.getMessage() == null
                ? "Worker token cache transaction failed"
                : error.getMessage(),
            error);
      } finally {
        if (database != null) {
          if (database.inTransaction()) {
            database.endTransaction();
          }
          database.close();
        }
      }
    }
  }

  private static void validateTokenTable(SQLiteDatabase database) {
    Set<String> actualColumns = new HashSet<>();
    Cursor cursor = database.rawQuery(
        "PRAGMA table_info(\"" + TOKEN_TABLE + "\")", null);
    try {
      int nameIndex = cursor.getColumnIndexOrThrow("name");
      while (cursor.moveToNext()) {
        actualColumns.add(cursor.getString(nameIndex));
      }
    } finally {
      cursor.close();
    }
    for (String column : TOKEN_COLUMNS) {
      if (!actualColumns.contains(column)) {
        throw new IllegalStateException("token_cache_schema_mismatch");
      }
    }
  }

  private static boolean hasNewerTokenSnapshot(
      SQLiteDatabase database,
      String address,
      long syncTimestamp) {
    Cursor cursor = database.rawQuery(
        "SELECT MAX(\"_local_updated_at\") FROM \"" + TOKEN_TABLE +
            "\" WHERE \"owner_addr\"=?",
        new String[] { address });
    try {
      return cursor.moveToFirst() &&
          !cursor.isNull(0) &&
          cursor.getLong(0) > syncTimestamp;
    } finally {
      cursor.close();
    }
  }

  private static String buildUpsertSql() {
    StringBuilder sql = new StringBuilder();
    sql.append("INSERT INTO \"").append(TOKEN_TABLE).append("\" (");
    for (int index = 0; index < TOKEN_COLUMNS.length; index++) {
      if (index > 0) {
        sql.append(',');
      }
      sql.append("\"").append(TOKEN_COLUMNS[index]).append("\"");
    }
    sql.append(") VALUES (");
    for (int index = 0; index < TOKEN_COLUMNS.length; index++) {
      if (index > 0) {
        sql.append(',');
      }
      sql.append('?');
    }
    sql.append(") ON CONFLICT (\"_db_id\") DO UPDATE SET ");
    boolean hasUpdate = false;
    for (String column : TOKEN_COLUMNS) {
      if ("_local_created_at".equals(column) || "_db_id".equals(column)) {
        continue;
      }
      if (hasUpdate) {
        sql.append(',');
      }
      sql.append("\"").append(column).append("\"=excluded.\"")
          .append(column).append("\"");
      hasUpdate = true;
    }
    return sql.toString();
  }

  private static void bindValue(
      SQLiteStatement statement,
      int parameterIndex,
      ReadableMap row,
      String column) {
    if (!row.hasKey(column) || row.isNull(column)) {
      statement.bindNull(parameterIndex);
      return;
    }
    ReadableType type = row.getType(column);
    switch (type) {
      case Boolean:
        statement.bindLong(parameterIndex, row.getBoolean(column) ? 1 : 0);
        break;
      case Number:
        if (INTEGER_COLUMNS.contains(column)) {
          statement.bindLong(parameterIndex, (long) row.getDouble(column));
        } else {
          statement.bindDouble(parameterIndex, row.getDouble(column));
        }
        break;
      case String:
        statement.bindString(parameterIndex, row.getString(column));
        break;
      default:
        throw new IllegalArgumentException("token_cache_binding_invalid");
    }
  }
}
