package com.rabbywallet.nativeopenapi

fun interface NativeTokenCacheWriteDiagnosticCallback {
  fun onComplete(result: NativeTokenCacheWriteDiagnosticResult)
}
