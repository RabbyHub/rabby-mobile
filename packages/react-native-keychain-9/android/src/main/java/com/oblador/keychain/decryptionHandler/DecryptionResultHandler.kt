package com.rabbywallet.keychain9.decryptionHandler

import androidx.annotation.NonNull
import androidx.annotation.Nullable
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionContext
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionResult

/** Handler that allows injecting some actions during decrypt operations. */
interface DecryptionResultHandler {
  /** Ask user for interaction, often its unlock of keystore by biometric data providing. */
  fun askAccessPermissions(@NonNull context: DecryptionContext)

  /** Handle decryption result or error. */
  fun onDecrypt(@Nullable decryptionResult: DecryptionResult?, @Nullable error: Throwable?)

  /** Property to get reference to results. */
  @get:Nullable val result: DecryptionResult?

  /** Property to get reference to captured error. */
  @get:Nullable val error: Throwable?

  /** Block thread and wait for any result of execution. */
  fun waitResult()
}
