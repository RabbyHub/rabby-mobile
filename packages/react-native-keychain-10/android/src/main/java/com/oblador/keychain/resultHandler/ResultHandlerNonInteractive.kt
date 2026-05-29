package com.rabbywallet.keychain10.resultHandler

import com.rabbywallet.keychain10.cipherStorage.CipherStorage.DecryptionResult
import com.rabbywallet.keychain10.cipherStorage.CipherStorage.EncryptionResult
import com.rabbywallet.keychain10.exceptions.CryptoFailedException

class ResultHandlerNonInteractive : ResultHandler {
  override var decryptionResult: DecryptionResult? = null
  override var encryptionResult: EncryptionResult? = null
  override var error: Throwable? = null

  override fun askAccessPermissions(context: CryptoContext) {
    val failure = CryptoFailedException("Non-interactive decryption mode.")
    onDecrypt(null, failure)
  }

  override fun onDecrypt(
    decryptionResult: DecryptionResult?,
    error: Throwable?
  ) {
    this.decryptionResult = decryptionResult
    this.error = error
  }

  override fun onEncrypt(
    encryptionResult: EncryptionResult?,
    error: Throwable?
  ) {
    this.encryptionResult = encryptionResult
    this.error = error
  }

  override fun waitResult() {
    // Do nothing, expected synchronized call in one thread
  }
}
