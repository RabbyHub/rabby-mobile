package com.rabbywallet.keychain9.cipherStorage

import com.rabbywallet.keychain9.SecurityLevel
import com.rabbywallet.keychain9.resultHandler.ResultHandler
import com.rabbywallet.keychain9.exceptions.CryptoFailedException
import com.rabbywallet.keychain9.exceptions.KeyStoreAccessException

@Suppress("unused", "MemberVisibilityCanBePrivate")
interface CipherStorage {

  // region Helper classes

  /** Basis for storing credentials in different data type formats. */
  abstract class CipherResult<T>(val username: T, val password: T)

  /** Credentials in bytes array, often a result of encryption. */
  class EncryptionResult(
    username: ByteArray,
    password: ByteArray,
    /** Name of cipher storage used for encryption. */
    val cipherName: String
  ) : CipherResult<ByteArray>(username, password) {
    /** Helper constructor. Simplifies cipher name extraction. */
    constructor(
      username: ByteArray,
      password: ByteArray,
      cipherStorage: CipherStorage
    ) : this(username, password, cipherStorage.getCipherStorageName())
  }

  /** Credentials in strings, often a result of decryption. */
  class DecryptionResult(
    username: String,
    password: String,
    private val securityLevel: SecurityLevel = SecurityLevel.ANY
  ) : CipherResult<String>(username, password) {
    fun getSecurityLevel(): SecurityLevel = securityLevel
  }

  // endregion

  // region API

  /**
   * Encrypt credentials with provided key (by alias) and required security level.
   *
   * @throws CryptoFailedException If encryption fails.
   */

  @Throws(CryptoFailedException::class)
  fun encrypt(
    handler: ResultHandler,
    alias: String,
    username: String,
    password: String,
    level: SecurityLevel
  )


  /**
   * Decrypt the credentials but redirect results of operation to handler.
   *
   * @throws CryptoFailedException If decryption fails.
   */
  @Throws(CryptoFailedException::class)
  fun decrypt(
    handler: ResultHandler,
    alias: String,
    username: ByteArray,
    password: ByteArray,
    level: SecurityLevel
  )

  /**
   * Decrypt credentials with an explicit Android prompt policy when the storage supports it.
   *
   * Storages that do not need an interactive prompt can keep the default implementation.
   */
  @Throws(CryptoFailedException::class)
  fun decryptWithPromptPolicy(
    handler: ResultHandler,
    alias: String,
    username: ByteArray,
    password: ByteArray,
    level: SecurityLevel,
    allowAuthenticatedSessionReuse: Boolean,
    allowKeyStoreRecovery: Boolean = true
  ) {
    decrypt(handler, alias, username, password, level)
  }

  /** Remove key (by alias) from storage. */
  @Throws(KeyStoreAccessException::class)
  fun removeKey(alias: String)

  /**
   * Return all keys present in this storage.
   *
   * @return Set of key aliases.
   */
  @Throws(KeyStoreAccessException::class)
  fun getAllKeys(): Set<String>

  // endregion

  // region Configuration

  /** Storage name. */
  fun getCipherStorageName(): String

  /** Minimal API level needed for using the storage. */
  fun getMinSupportedApiLevel(): Int

  /** Provided security level. */
  fun securityLevel(): SecurityLevel

  /** True if based on secured hardware capabilities, otherwise False. */
  fun supportsSecureHardware(): Boolean

  /** True if based on biometric capabilities, otherwise False. */
  fun isBiometrySupported(): Boolean

  /**
   * The higher value means better capabilities. Formula: = 1000 * isBiometrySupported() + 100 *
   * supportsSecureHardware() + minSupportedApiLevel
   */
  fun getCapabilityLevel(): Int

  /** Get default name for alias/service. */
  fun getDefaultAliasServiceName(): String

  // endregion
}
