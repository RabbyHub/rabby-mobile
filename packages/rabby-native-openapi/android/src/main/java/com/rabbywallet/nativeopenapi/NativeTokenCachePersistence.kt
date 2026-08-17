package com.rabbywallet.nativeopenapi

import android.content.Context
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteStatement
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.min

internal object NativeTokenCachePersistence {
  private const val DATABASE_NAME = "rabby-app.db"
  private const val MAXIMUM_ROWS = 1_000_000
  private const val MAXIMUM_STRING_BYTES = 64 * 1024 * 1024
  private const val LEGACY_REAL_STORAGE_RATIO = 18.0
  private const val REPLACEMENT_ADDRESS = 0
  private const val REPLACEMENT_CHAINS = 1

  fun commit(
    context: Context,
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    deleteStaleForChainSql: String,
    replacementKind: Int,
    replacementChainIds: Array<String>,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? = writeSnapshot(
    context = context,
    ownerAddress = ownerAddress,
    syncTimestampMs = syncTimestampMs,
    tableName = tableName,
    upsertSql = upsertSql,
    deleteStaleSql = deleteStaleSql,
    deleteStaleForChainSql = deleteStaleForChainSql,
    replacementKind = replacementKind,
    replacementChainIds = replacementChainIds,
    expectedColumnsCsv = expectedColumnsCsv,
    payload = payload,
    rollbackOnly = false,
  )

  fun verifyWriteContract(
    context: Context,
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    deleteStaleForChainSql: String,
    replacementKind: Int,
    replacementChainIds: Array<String>,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? = writeSnapshot(
    context = context,
    ownerAddress = ownerAddress,
    syncTimestampMs = syncTimestampMs,
    tableName = tableName,
    upsertSql = upsertSql,
    deleteStaleSql = deleteStaleSql,
    deleteStaleForChainSql = deleteStaleForChainSql,
    replacementKind = replacementKind,
    replacementChainIds = replacementChainIds,
    expectedColumnsCsv = expectedColumnsCsv,
    payload = payload,
    rollbackOnly = true,
  )

  private fun writeSnapshot(
    context: Context,
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    deleteStaleForChainSql: String,
    replacementKind: Int,
    replacementChainIds: Array<String>,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
    rollbackOnly: Boolean,
  ): String? {
    val databaseFile = context.getDatabasePath(DATABASE_NAME)
    if (!databaseFile.isFile) {
      return "token cache database is unavailable"
    }

    var database: SQLiteDatabase? = null
    var upsert: SQLiteStatement? = null
    var deleteStale: SQLiteStatement? = null
    var deleteStaleForChain: SQLiteStatement? = null
    var diagnosticStage = "open_database"
    return try {
      database = SQLiteDatabase.openDatabase(
        databaseFile.path,
        null,
        SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.NO_LOCALIZED_COLLATORS,
      )
      diagnosticStage = "configure_busy_timeout"
      database.rawQuery("PRAGMA busy_timeout=5000", null).use { cursor ->
        cursor.moveToFirst()
      }
      diagnosticStage = "verify_schema"
      val expectedColumns = expectedColumnsCsv.split(',').toSet()
      val actualColumns = mutableSetOf<String>()
      val quotedTableName = tableName.replace("\"", "\"\"")
      database.rawQuery(
        "PRAGMA table_info(\"$quotedTableName\")",
        null,
      ).use { cursor ->
        val nameIndex = cursor.getColumnIndexOrThrow("name")
        while (cursor.moveToNext()) {
          actualColumns += cursor.getString(nameIndex)
        }
      }
      if (actualColumns != expectedColumns) {
        return "token cache schema does not match the native writer contract"
      }
      val replacementChains = replacementChainIds.toSet()
      if (replacementKind != REPLACEMENT_ADDRESS &&
        replacementKind != REPLACEMENT_CHAINS
      ) {
        return "token cache replacement kind is invalid"
      }
      if (replacementKind == REPLACEMENT_CHAINS && replacementChains.isEmpty()) {
        return "selected-chain replacement requires a chain"
      }

      diagnosticStage = "decode_snapshot"
      val reader = SnapshotReader(payload)
      reader.requireMagic()
      val rowCount = reader.readUnsignedInt()
      if (rowCount > MAXIMUM_ROWS) {
        return "token snapshot row count exceeds the native limit"
      }

      diagnosticStage = "compile_upsert"
      upsert = database.compileStatement(upsertSql)
      if (replacementKind == REPLACEMENT_ADDRESS) {
        diagnosticStage = "compile_delete_stale"
        deleteStale = database.compileStatement(deleteStaleSql)
      } else {
        diagnosticStage = "compile_delete_stale_for_chain"
        deleteStaleForChain = database.compileStatement(deleteStaleForChainSql)
      }
      diagnosticStage = "begin_transaction"
      database.beginTransactionNonExclusive()
      try {
        diagnosticStage = "upsert_rows"
        repeat(rowCount) {
          bindRow(
            statement = upsert,
            reader = reader,
            expectedOwnerAddress = ownerAddress,
            replacementKind = replacementKind,
            replacementChains = replacementChains,
            syncTimestampMs = syncTimestampMs,
          )
          upsert.executeInsert()
        }
        if (reader.hasRemaining()) {
          error("token snapshot has trailing bytes")
        }
        diagnosticStage = "delete_stale_rows"
        if (replacementKind == REPLACEMENT_ADDRESS) {
          requireNotNull(deleteStale).apply {
            bindString(1, ownerAddress)
            bindLong(2, syncTimestampMs)
            executeUpdateDelete()
          }
        } else {
          replacementChains.forEach { chainId ->
            requireNotNull(deleteStaleForChain).apply {
              clearBindings()
              bindString(1, ownerAddress)
              bindString(2, chainId)
              bindLong(3, syncTimestampMs)
              executeUpdateDelete()
            }
          }
        }
        if (!rollbackOnly) {
          database.setTransactionSuccessful()
        }
      } finally {
        diagnosticStage = if (rollbackOnly) "rollback" else "commit"
        database.endTransaction()
      }
      if (rollbackOnly) {
        diagnosticStage = "verify_rollback"
        val persistedProbeRows = DatabaseUtils.longForQuery(
          database,
          "SELECT COUNT(*) FROM \"$quotedTableName\" WHERE \"owner_addr\"=?",
          arrayOf(ownerAddress),
        )
        if (persistedProbeRows != 0L) {
          error("token cache write probe escaped its rollback")
        }
      }
      null
    } catch (error: Throwable) {
      if (rollbackOnly) {
        "token cache write diagnostic failed at $diagnosticStage " +
          "(${error.javaClass.simpleName})"
      } else {
        "token cache transaction failed"
      }
    } finally {
      upsert?.close()
      deleteStale?.close()
      deleteStaleForChain?.close()
      database?.close()
    }
  }

  private fun bindRow(
    statement: SQLiteStatement,
    reader: SnapshotReader,
    expectedOwnerAddress: String,
    replacementKind: Int,
    replacementChains: Set<String>,
    syncTimestampMs: Long,
  ) {
    statement.clearBindings()
    statement.bindLong(1, syncTimestampMs)
    statement.bindLong(2, syncTimestampMs)
    statement.bindString(3, reader.readString())
    val rowOwnerAddress = reader.readString()
    if (rowOwnerAddress != expectedOwnerAddress) {
      error("token snapshot owner does not match the requested address")
    }
    statement.bindString(4, rowOwnerAddress)
    statement.bindString(5, reader.readString())
    statement.bindString(6, reader.readString())
    statement.bindString(7, reader.readString())
    statement.bindString(8, reader.readString())
    statement.bindDouble(9, reader.readDouble() * LEGACY_REAL_STORAGE_RATIO)
    val rowChain = reader.readString()
    if (replacementKind == REPLACEMENT_CHAINS &&
      rowChain !in replacementChains
    ) {
      error("token snapshot chain exceeds the replacement scope")
    }
    statement.bindString(10, rowChain)
    statement.bindDouble(11, reader.readDouble())
    statement.bindString(12, reader.readString())
    statement.bindString(13, reader.readString())
    statement.bindNullableBoolean(14, reader.readNullableBoolean())
    statement.bindNullableBoolean(15, reader.readNullableBoolean())
    statement.bindBoolean(16, reader.readBoolean())
    statement.bindBoolean(17, reader.readBoolean())
    statement.bindBoolean(18, reader.readBoolean())
    statement.bindBoolean(19, reader.readBoolean())
    statement.bindString(20, reader.readString())
    statement.bindString(21, reader.readString())
    statement.bindString(22, reader.readString())
    statement.bindDouble(23, reader.readDouble() * LEGACY_REAL_STORAGE_RATIO)
    statement.bindString(24, reader.readString())
    statement.bindDouble(25, reader.readDouble())
    statement.bindDouble(26, reader.readDouble())
    statement.bindDouble(27, reader.readDouble())
    statement.bindString(28, reader.readString())
    statement.bindNullableString(29, reader.readNullableString())
    statement.bindNullableString(30, reader.readNullableString())
    statement.bindString(31, reader.readString())
    statement.bindString(32, reader.readString())
    statement.bindString(33, reader.readString())
    statement.bindNullableDouble(34, reader.readNullableDouble())
    statement.bindBoolean(35, reader.readBoolean())
    statement.bindDouble(36, reader.readDouble())
    statement.bindString(37, reader.readString())
    statement.bindString(38, reader.readString())
  }

  private fun SQLiteStatement.bindBoolean(index: Int, value: Boolean) {
    bindLong(index, if (value) 1 else 0)
  }

  private fun SQLiteStatement.bindNullableBoolean(index: Int, value: Boolean?) {
    if (value == null) bindNull(index) else bindBoolean(index, value)
  }

  private fun SQLiteStatement.bindNullableDouble(index: Int, value: Double?) {
    if (value == null) bindNull(index) else bindDouble(index, value)
  }

  private fun SQLiteStatement.bindNullableString(index: Int, value: String?) {
    if (value == null) bindNull(index) else bindString(index, value)
  }

  private class SnapshotReader(source: ByteBuffer) {
    private val buffer = source.duplicate().order(ByteOrder.LITTLE_ENDIAN)

    fun requireMagic() {
      val expected = byteArrayOf(
        'R'.code.toByte(),
        'T'.code.toByte(),
        'S'.code.toByte(),
        '1'.code.toByte(),
      )
      expected.forEach { byte ->
        if (!buffer.hasRemaining() || buffer.get() != byte) {
          error("invalid token snapshot magic")
        }
      }
    }

    fun readUnsignedInt(): Int {
      requireRemaining(Int.SIZE_BYTES)
      val value = buffer.int.toLong() and 0xffffffffL
      if (value > Int.MAX_VALUE) {
        error("token snapshot integer is out of range")
      }
      return value.toInt()
    }

    fun readDouble(): Double {
      requireRemaining(Double.SIZE_BYTES)
      val value = buffer.double
      if (!value.isFinite()) {
        error("token snapshot number is not finite")
      }
      return value
    }

    fun readBoolean(): Boolean {
      requireRemaining(1)
      return when (buffer.get().toInt()) {
        0 -> false
        1 -> true
        else -> error("invalid token snapshot boolean")
      }
    }

    fun readNullableBoolean(): Boolean? {
      requireRemaining(1)
      return when (buffer.get().toInt()) {
        0 -> false
        1 -> true
        2 -> null
        else -> error("invalid token snapshot nullable boolean")
      }
    }

    fun readNullableDouble(): Double? =
      if (readBoolean()) readDouble() else null

    fun readString(): String {
      val size = readUnsignedInt()
      if (size > min(MAXIMUM_STRING_BYTES, buffer.remaining())) {
        error("token snapshot string is out of bounds")
      }
      val bytes = ByteArray(size)
      buffer.get(bytes)
      return bytes.toString(Charsets.UTF_8)
    }

    fun readNullableString(): String? =
      if (readBoolean()) readString() else null

    fun hasRemaining(): Boolean = buffer.hasRemaining()

    private fun requireRemaining(count: Int) {
      if (buffer.remaining() < count) {
        error("token snapshot ended unexpectedly")
      }
    }
  }
}
