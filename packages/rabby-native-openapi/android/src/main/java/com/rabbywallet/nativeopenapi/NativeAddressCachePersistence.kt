package com.rabbywallet.nativeopenapi

import com.op.sqlite.OPSQLiteBridge
import java.nio.ByteBuffer
import java.nio.ByteOrder

internal object NativeSnapshotPersistence {
  private const val DATABASE_NAME = "rabby-app.db"
  private val MAGIC = byteArrayOf(
    'R'.code.toByte(),
    'A'.code.toByte(),
    'S'.code.toByte(),
    '1'.code.toByte(),
  )

  fun commit(
    tableName: String,
    expectedColumnsCsv: String,
    upsertSql: String,
    deleteSql: String,
    rowPayload: ByteBuffer,
    deleteRows: List<List<DeleteValue>>,
    rollbackOnly: Boolean = false,
  ): String? = try {
    OPSQLiteBridge.instance.executeNativeSnapshot(
      databaseName = DATABASE_NAME,
      tableName = tableName,
      expectedColumnsCsv = expectedColumnsCsv,
      upsertSql = upsertSql,
      deleteSql = deleteSql,
      rowPayload = rowPayload,
      deletePayload = encodeDeleteRows(deleteRows),
      rollbackOnly = rollbackOnly,
    )
  } catch (_: Throwable) {
    "native snapshot transaction failed"
  }

  fun ownerTimestampDeleteRow(
    ownerAddress: String,
    syncTimestampMs: Long,
  ): List<DeleteValue> = listOf(
    DeleteValue.Text(ownerAddress),
    DeleteValue.Integer(syncTimestampMs),
  )

  fun ownerChainTimestampDeleteRow(
    ownerAddress: String,
    chainId: String,
    syncTimestampMs: Long,
  ): List<DeleteValue> = listOf(
    DeleteValue.Text(ownerAddress),
    DeleteValue.Text(chainId),
    DeleteValue.Integer(syncTimestampMs),
  )

  sealed interface DeleteValue {
    fun encodedSize(): Int
    fun writeTo(buffer: ByteBuffer)

    data class Text(val value: String) : DeleteValue {
      private val bytes = value.toByteArray(Charsets.UTF_8)

      override fun encodedSize(): Int = 1 + Int.SIZE_BYTES + bytes.size

      override fun writeTo(buffer: ByteBuffer) {
        buffer.put(1)
        buffer.putInt(bytes.size)
        buffer.put(bytes)
      }
    }

    data class Integer(val value: Long) : DeleteValue {
      override fun encodedSize(): Int = 1 + Long.SIZE_BYTES

      override fun writeTo(buffer: ByteBuffer) {
        buffer.put(3)
        buffer.putLong(value)
      }
    }
  }

  private fun encodeDeleteRows(rows: List<List<DeleteValue>>): ByteBuffer {
    check(rows.isNotEmpty()) {
      "native snapshot requires a delete scope"
    }
    val columnCount = rows.first().size
    check(columnCount > 0 && rows.all { it.size == columnCount }) {
      "native snapshot delete scope is malformed"
    }
    val size = MAGIC.size + Int.SIZE_BYTES * 2 + rows.sumOf { row ->
      row.sumOf(DeleteValue::encodedSize)
    }
    return ByteBuffer.allocateDirect(size)
      .order(ByteOrder.LITTLE_ENDIAN)
      .apply {
        put(MAGIC)
        putInt(columnCount)
        putInt(rows.size)
        rows.forEach { row -> row.forEach { it.writeTo(this) } }
      }
  }
}

internal object NativeAddressCachePersistence {
  fun commit(
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? = NativeSnapshotPersistence.commit(
    tableName = tableName,
    expectedColumnsCsv = expectedColumnsCsv,
    upsertSql = upsertSql,
    deleteSql = deleteStaleSql,
    rowPayload = payload,
    deleteRows = listOf(
      NativeSnapshotPersistence.ownerTimestampDeleteRow(
        ownerAddress,
        syncTimestampMs,
      ),
    ),
  )
}
