package com.rabbywallet.nativehttp

internal object NativeHttpTestHarness {
  init {
    RabbyNativeHttpRuntime.ensureInitialized()
  }

  @JvmStatic
  external fun runProbe(
    url: String,
    method: String,
    body: ByteArray,
    timeoutMs: Long,
    maxResponseBytes: Long,
    cancelImmediately: Boolean,
  ): String
}
