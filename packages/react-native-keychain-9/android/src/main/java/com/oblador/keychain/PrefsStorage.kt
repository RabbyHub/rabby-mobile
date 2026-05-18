package com.rabbywallet.keychain9

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.rabbywallet.keychain9.KeychainModule.KnownCiphers
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.CipherResult
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.EncryptionResult
import java.util.Collections

@Suppress("unused")
class PrefsStorage(reactContext: ReactApplicationContext) {
  class ResultSet(
      @JvmField @field:KnownCiphers @param:KnownCiphers val cipherStorageName: String,
      usernameBytes: ByteArray?,
      passwordBytes: ByteArray?
  ) : CipherResult<ByteArray?>(usernameBytes, passwordBytes)

  class DebugEntry(
      val service: String,
      val hasEntry: Boolean,
      val hasUsername: Boolean,
      val hasPassword: Boolean,
      val hasCipherStorageMarker: Boolean,
      val storedUsernameBase64: String?,
      val storedPasswordBase64: String?,
      val storedCipherStorageMarkerValue: String?,
      val storedCipherStorageName: String?,
      val resolvedCipherStorageName: String?,
      val candidateCipherStorageNames: List<String>,
      val cipherStorageResolutionStrategy: String?,
      val usernameByteSize: Int?,
      val passwordByteSize: Int?
  )

  private val prefs: SharedPreferences

  init {
    prefs = reactContext.getSharedPreferences(KEYCHAIN_DATA, Context.MODE_PRIVATE)
  }

  fun getEncryptedEntry(service: String): ResultSet? {
    val bytesForUsername = getBytesForUsername(service)
    val bytesForPassword = getBytesForPassword(service)
    var cipherStorageName = getCipherStorageName(service)

    // in case of wrong password or username
    if (bytesForUsername == null || bytesForPassword == null) {
      return null
    }
    if (cipherStorageName == null) {
      // If the CipherStorage name is not found, we assume it is because the entry was written by an
      // older
      // version of this library. The older version used Facebook Conceal, so we default to that.
      cipherStorageName = KnownCiphers.RSA
    }
    return ResultSet(cipherStorageName, bytesForUsername, bytesForPassword)
  }

  fun removeEntry(service: String) {
    val keyForUsername = getKeyForUsername(service)
    val keyForPassword = getKeyForPassword(service)
    val keyForCipherStorage = getKeyForCipherStorage(service)
    prefs.edit().remove(keyForUsername).remove(keyForPassword).remove(keyForCipherStorage).apply()
  }

  fun storeEncryptedEntry(service: String, encryptionResult: EncryptionResult) {
    val keyForUsername = getKeyForUsername(service)
    val keyForPassword = getKeyForPassword(service)
    val keyForCipherStorage = getKeyForCipherStorage(service)
    prefs
        .edit()
        .putString(keyForUsername, Base64.encodeToString(encryptionResult.username, Base64.DEFAULT))
        .putString(keyForPassword, Base64.encodeToString(encryptionResult.password, Base64.DEFAULT))
        .putString(keyForCipherStorage, encryptionResult.cipherName)
        .apply()
  }

  fun getDebugEntry(service: String): DebugEntry {
    val storedUsernameBase64 = getString(getKeyForUsername(service))
    val storedPasswordBase64 = getString(getKeyForPassword(service))
    val usernameBytes = getBytesForUsername(service)
    val passwordBytes = getBytesForPassword(service)
    val storedCipherStorageName = getCipherStorageName(service)
    val hasUsername = usernameBytes != null
    val hasPassword = passwordBytes != null
    val hasCipherStorageMarker = storedCipherStorageName != null
    val hasEntry = hasUsername || hasPassword || hasCipherStorageMarker
    val candidateCipherStorageNames =
        if (hasUsername && hasPassword) {
          getCandidateCipherStorageNamesForDebug(storedCipherStorageName)
        } else {
          emptyList()
        }
    val resolvedCipherStorageName =
        candidateCipherStorageNames.firstOrNull()
    val cipherStorageResolutionStrategy =
        if (hasUsername && hasPassword) {
          getCipherStorageResolutionStrategyForDebug(storedCipherStorageName)
        } else {
          null
        }

    return DebugEntry(
        service = service,
        hasEntry = hasEntry,
        hasUsername = hasUsername,
        hasPassword = hasPassword,
        hasCipherStorageMarker = hasCipherStorageMarker,
        storedUsernameBase64 = storedUsernameBase64,
        storedPasswordBase64 = storedPasswordBase64,
        storedCipherStorageMarkerValue = storedCipherStorageName,
        storedCipherStorageName = storedCipherStorageName,
        resolvedCipherStorageName = resolvedCipherStorageName,
        candidateCipherStorageNames = candidateCipherStorageNames,
        cipherStorageResolutionStrategy = cipherStorageResolutionStrategy,
        usernameByteSize = usernameBytes?.size,
        passwordByteSize = passwordBytes?.size)
  }

  fun removeCipherStorageMarker(service: String): Boolean {
    val keyForCipherStorage = getKeyForCipherStorage(service)
    if (!prefs.contains(keyForCipherStorage)) {
      return false
    }

    prefs.edit().remove(keyForCipherStorage).apply()
    return true
  }

  val usedCipherNames: Set<String?>
    /**
     * List all types of cipher which are involved in en/decryption of the data stored herein.
     *
     * A cipher type is stored together with the datum upon encryption so the datum can later be
     * decrypted using correct cipher. This way, a [PrefsStorage] can involve different ciphers for
     * different data. This method returns all ciphers involved with this storage.
     *
     * @return set of cipher names
     */
    get() {
      val result: MutableSet<String?> = HashSet()
      val keys: Set<String> = prefs.all.keys
      for (key in keys) {
        if (isKeyForCipherStorage(key)) {
          val cipher = prefs.getString(key, null)
          result.add(cipher)
        }
      }
      return result
    }

  private fun getBytesForUsername(service: String): ByteArray? {
    val key = getKeyForUsername(service)
    return getBytes(key)
  }

  private fun getBytesForPassword(service: String): ByteArray? {
    val key = getKeyForPassword(service)
    return getBytes(key)
  }

  private fun getCipherStorageName(service: String): String? {
    val key = getKeyForCipherStorage(service)
    return prefs.getString(key, null)
  }

  private fun getBytes(key: String): ByteArray? {
    val value = getString(key)
    return if (value != null) {
      Base64.decode(value, Base64.DEFAULT)
    } else null
  }

  private fun getString(key: String): String? = prefs.getString(key, null)

  companion object {
    const val KEYCHAIN_DATA = "RN_KEYCHAIN"

    fun getKeyForUsername(service: String): String {
      return "$service:u"
    }

    fun getKeyForPassword(service: String): String {
      return "$service:p"
    }

    fun getKeyForCipherStorage(service: String): String {
      return "$service:c"
    }

    fun isKeyForCipherStorage(key: String): Boolean {
      return key.endsWith(":c")
    }

    private fun getCandidateCipherStorageNamesForDebug(
        cipherStorageName: String?
    ): List<String> {
      if (cipherStorageName != null) {
        return Collections.singletonList(cipherStorageName)
      }

      return Collections.singletonList(KnownCiphers.RSA)
    }

    private fun getCipherStorageResolutionStrategyForDebug(
        cipherStorageName: String?
    ): String {
      if (cipherStorageName != null) {
        return "stored-marker"
      }

      return "missing-marker/default-rsa"
    }
  }
}
