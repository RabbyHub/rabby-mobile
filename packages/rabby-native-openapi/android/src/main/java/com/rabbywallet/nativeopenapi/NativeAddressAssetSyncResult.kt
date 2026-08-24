package com.rabbywallet.nativeopenapi

data class NativeAddressAssetSyncResult(
  val kind: String,
  val success: Boolean,
  val address: String,
  val generation: Long,
  val stage: String,
  val sourceItemCount: Long,
  val committedRowCount: Long,
  val committedAtMs: Long,
  val durationMs: Long,
  val error: String,
)
