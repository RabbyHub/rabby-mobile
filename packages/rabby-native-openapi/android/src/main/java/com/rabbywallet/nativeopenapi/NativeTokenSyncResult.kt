package com.rabbywallet.nativeopenapi

data class NativeTokenSyncResult(
  val success: Boolean,
  val outcome: String,
  val address: String,
  val generation: Long,
  val stage: String,
  val chainCount: Long,
  val sourceTokenCount: Long,
  val filteredTokenCount: Long,
  val committedRowCount: Long,
  val successfulChainIds: Array<String>,
  val failedChainIds: Array<String>,
  val committedAtMs: Long,
  val durationMs: Long,
  val error: String,
)
