package com.rabbywallet.nativeopenapi

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteStatement
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.min

internal object NativeAddressCachePersistence {
  private const val DATABASE_NAME = "rabby-app.db"
  private const val MAXIMUM_ROWS = 1_000_000
  private const val MAXIMUM_COLUMNS = 256
  private const val MAXIMUM_STRING_BYTES = 64 * 1024 * 1024

  fun commit(
    context: Context,
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? {
    val databaseFile = context.getDatabasePath(DATABASE_NAME)
    if (!databaseFile.isFile) {
      return "address cache database is unavailable"
    }

    var database: SQLiteDatabase? = null
    var upsert: SQLiteStatement? = null
    var deleteStale: SQLiteStatement? = null
    return try {
      database = SQLiteDatabase.openDatabase(
        databaseFile.path,
        null,
        SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.NO_LOCALIZED_COLLATORS,
      )
      database.rawQuery("PRAGMA busy_timeout=5000", null).use { cursor ->
        cursor.moveToFirst()
      }

      val expectedColumns = expectedColumnsCsv.split(',')
      if (expectedColumns.size !in 4..MAXIMUM_COLUMNS ||
        expectedColumns.any { it.isEmpty() } ||
        expectedColumns.toSet().size != expectedColumns.size
      ) {
        return "address cache writer contract is invalid"
      }
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
      if (actualColumns != expectedColumns.toSet()) {
        return "address cache schema does not match the native writer contract"
      }

      val reader = SnapshotReader(payload)
      reader.requireMagic()
      val columnCount = reader.readUnsignedInt()
      val rowCount = reader.readUnsignedInt()
      if (columnCount != expectedColumns.size) {
        return "address snapshot column count does not match the writer contract"
      }
      if (rowCount > MAXIMUM_ROWS) {
        return "address snapshot row count exceeds the native limit"
      }

      upsert = database.compileStatement(upsertSql)
      deleteStale = database.compileStatement(deleteStaleSql)
      database.beginTransactionNonExclusive()
      try {
        repeat(rowCount) {
          bindRow(
            statement = upsert,
            reader = reader,
            columnCount = columnCount,
            expectedOwnerAddress = ownerAddress,
            syncTimestampMs = syncTimestampMs,
          )
          upsert.executeInsert()
        }
        if (reader.hasRemaining()) {
          error("address snapshot has trailing bytes")
        }
        deleteStale.apply {
          bindString(1, ownerAddress)
          bindLong(2, syncTimestampMs)
          executeUpdateDelete()
        }
        database.setTransactionSuccessful()
      } finally {
        database.endTransaction()
      }
      null
    } catch (_: Throwable) {
      "address cache transaction failed"
    } finally {
      upsert?.close()
      deleteStale?.close()
      database?.close()
    }
  }

  private fun bindRow(
    statement: SQLiteStatement,
    reader: SnapshotReader,
    columnCount: Int,
    expectedOwnerAddress: String,
    syncTimestampMs: Long,
  ) {
    statement.clearBindings()
    repeat(columnCount) { columnIndex ->
      val value = reader.readValue()
      if ((columnIndex == 0 || columnIndex == 1) &&
        (value !is SnapshotValue.Integer || value.value != syncTimestampMs)
      ) {
        error("address snapshot timestamp does not match the request")
      }
      if (columnIndex == 2 &&
        (value !is SnapshotValue.Text || value.value.isEmpty())
      ) {
        error("address snapshot row id is invalid")
      }
      if (columnIndex == 3 &&
        (value !is SnapshotValue.Text || value.value != expectedOwnerAddress)
      ) {
        error("address snapshot owner does not match the requested address")
      }
      value.bind(statement, columnIndex + 1)
    }
  }

  private sealed interface SnapshotValue {
    fun bind(statement: SQLiteStatement, index: Int)

    data object Null : SnapshotValue {
      override fun bind(statement: SQLiteStatement, index: Int) {
        statement.bindNull(index)
      }
    }

    data class Text(val value: String) : SnapshotValue {
      override fun bind(statement: SQLiteStatement, index: Int) {
        statement.bindString(index, value)
      }
    }

    data class Real(val value: Double) : SnapshotValue {
      override fun bind(statement: SQLiteStatement, index: Int) {
        statement.bindDouble(index, value)
      }
    }

    data class Integer(val value: Long) : SnapshotValue {
      override fun bind(statement: SQLiteStatement, index: Int) {
        statement.bindLong(index, value)
      }
    }
  }

  private class SnapshotReader(source: ByteBuffer) {
    private val buffer = source.duplicate().order(ByteOrder.LITTLE_ENDIAN)

    fun requireMagic() {
      byteArrayOf(
        'R'.code.toByte(),
        'A'.code.toByte(),
        'S'.code.toByte(),
        '1'.code.toByte(),
      ).forEach { expected ->
        if (!buffer.hasRemaining() || buffer.get() != expected) {
          error("invalid address snapshot magic")
        }
      }
    }

    fun readUnsignedInt(): Int {
      requireRemaining(Int.SIZE_BYTES)
      val value = buffer.int.toLong() and 0xffffffffL
      if (value > Int.MAX_VALUE) {
        error("address snapshot integer is out of range")
      }
      return value.toInt()
    }

    fun readValue(): SnapshotValue {
      requireRemaining(1)
      return when (buffer.get().toInt()) {
        0 -> SnapshotValue.Null
        1 -> SnapshotValue.Text(readString())
        2 -> {
          requireRemaining(Double.SIZE_BYTES)
          val value = buffer.double
          if (!value.isFinite()) {
            error("address snapshot number is not finite")
          }
          SnapshotValue.Real(value)
        }
        3 -> {
          requireRemaining(Long.SIZE_BYTES)
          SnapshotValue.Integer(buffer.long)
        }
        else -> error("invalid address snapshot value kind")
      }
    }

    fun hasRemaining(): Boolean = buffer.hasRemaining()

    private fun readString(): String {
      val size = readUnsignedInt()
      if (size > min(MAXIMUM_STRING_BYTES, buffer.remaining())) {
        error("address snapshot string is out of bounds")
      }
      val bytes = ByteArray(size)
      buffer.get(bytes)
      return bytes.toString(Charsets.UTF_8)
    }

    private fun requireRemaining(count: Int) {
      if (buffer.remaining() < count) {
        error("address snapshot ended unexpectedly")
      }
    }
  }
}
