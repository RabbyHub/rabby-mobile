package com.rabbywallet.keychain9.decryptionHandler

import androidx.annotation.NonNull
import androidx.annotation.Nullable
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionContext
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionResult
import com.rabbywallet.keychain9.exceptions.CryptoFailedException

class DecryptionResultHandlerNonInteractive : DecryptionResultHandler {

  // Use 'override' and explicitly declare visibility
  override var result: DecryptionResult? = null
  override var error: Throwable? = null

  override fun askAccessPermissions(@NonNull context: DecryptionContext) {
    val failure = CryptoFailedException("Non-interactive decryption mode.")
    onDecrypt(null, failure)
  }

  override fun onDecrypt(
      @Nullable decryptionResult: DecryptionResult?,
      @Nullable error: Throwable?
  ) {
    this.result = decryptionResult
    this.error = error
  }

  override fun waitResult() {
    // Do nothing, expected synchronized call in one thread
  }
}
