package com.rabbywallet.nativeopenapi

data class NativeTokenCacheWriteDiagnosticResult(
  val success: Boolean,
  val stage: String,
  val attemptedRowCount: Long,
  val durationMs: Long,
  val error: String,
)
