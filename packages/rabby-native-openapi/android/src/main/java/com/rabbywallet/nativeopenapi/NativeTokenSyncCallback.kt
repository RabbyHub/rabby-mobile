package com.rabbywallet.nativeopenapi

fun interface NativeTokenSyncCallback {
  fun onComplete(result: NativeTokenSyncResult)
}
