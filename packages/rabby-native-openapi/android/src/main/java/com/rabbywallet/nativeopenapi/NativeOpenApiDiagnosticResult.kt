package com.rabbywallet.nativeopenapi

data class NativeOpenApiDiagnosticResult(
  val success: Boolean,
  val error: String,
  val firstStatusCode: Int,
  val secondStatusCode: Int,
  val firstDurationMs: Long,
  val secondDurationMs: Long,
  val firstBodyBytes: Long,
  val secondBodyBytes: Long,
  val firstCredentialDisposition: String,
  val secondCredentialDisposition: String,
  val firstRequestCredentialRevision: Long,
  val firstCurrentCredentialRevision: Long,
  val secondRequestCredentialRevision: Long,
  val secondCurrentCredentialRevision: Long,
  val secondUsedLatestAvailableCredential: Boolean,
)
