package com.rabbywallet.nativehttp

/** Loads the transport only when the native synchronization pipeline starts. */
object RabbyNativeHttpRuntime {
  init {
    System.loadLibrary("rabbynativehttp")
  }

  @JvmStatic
  fun ensureInitialized() = Unit

  @JvmStatic
  external fun onPlatformResponse(
    requestId: Long,
    statusCode: Int,
    finalUrl: String,
    headerNames: Array<String>,
    headerValues: Array<String>,
    body: ByteArray,
    durationMs: Long,
  )

  @JvmStatic
  external fun onPlatformFailure(
    requestId: Long,
    code: String,
    message: String,
    durationMs: Long,
  )
}
