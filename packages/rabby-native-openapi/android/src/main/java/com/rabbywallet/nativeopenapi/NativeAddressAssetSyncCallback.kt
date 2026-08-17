package com.rabbywallet.nativeopenapi

fun interface NativeAddressAssetSyncCallback {
  fun onComplete(result: NativeAddressAssetSyncResult)
}
