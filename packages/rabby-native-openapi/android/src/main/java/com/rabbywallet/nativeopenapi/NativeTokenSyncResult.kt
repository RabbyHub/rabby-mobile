package com.rabbywallet.nativeopenapi

data class NativeTokenSyncResult(
  val success: Boolean,
  val address: String,
  val generation: Long,
  val stage: String,
  val chainCount: Long,
  val sourceTokenCount: Long,
  val filteredTokenCount: Long,
  val committedRowCount: Long,
  val committedAtMs: Long,
  val durationMs: Long,
  val error: String,
)
