package com.rabbywallet.nativeopenapi

import java.nio.ByteBuffer

internal object NativeTokenCachePersistence {
  private const val REPLACEMENT_ADDRESS = 0
  private const val REPLACEMENT_CHAINS = 1

  fun commit(
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
    val replacementChains = replacementChainIds.distinct()
    val deleteSql: String
    val deleteRows: List<List<NativeSnapshotPersistence.DeleteValue>>
    when (replacementKind) {
      REPLACEMENT_ADDRESS -> {
        deleteSql = deleteStaleSql
        deleteRows = listOf(
          NativeSnapshotPersistence.ownerTimestampDeleteRow(
            ownerAddress,
            syncTimestampMs,
          ),
        )
      }
      REPLACEMENT_CHAINS -> {
        if (replacementChains.isEmpty()) {
          return "selected-chain replacement requires a chain"
        }
        deleteSql = deleteStaleForChainSql
        deleteRows = replacementChains.map { chainId ->
          NativeSnapshotPersistence.ownerChainTimestampDeleteRow(
            ownerAddress,
            chainId,
            syncTimestampMs,
          )
        }
      }
      else -> return "token cache replacement kind is invalid"
    }

    return NativeSnapshotPersistence.commit(
      tableName = tableName,
      expectedColumnsCsv = expectedColumnsCsv,
      upsertSql = upsertSql,
      deleteSql = deleteSql,
      rowPayload = payload,
      deleteRows = deleteRows,
      rollbackOnly = rollbackOnly,
    )
  }
}
