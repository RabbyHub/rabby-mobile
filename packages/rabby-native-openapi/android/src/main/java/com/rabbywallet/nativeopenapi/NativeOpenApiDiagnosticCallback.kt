package com.rabbywallet.nativeopenapi

fun interface NativeOpenApiDiagnosticCallback {
  fun onComplete(result: NativeOpenApiDiagnosticResult)
}
