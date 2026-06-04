package com.rabbywallet.keychain9

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.facebook.react.bridge.ReactApplicationContext
import com.rabbywallet.keychain9.KeychainModule.KnownCiphers
import com.rabbywallet.keychain9.PrefsStorageBase.Companion.KEYCHAIN_DATA
import com.rabbywallet.keychain9.PrefsStorageBase.Companion.getKeyForCipherStorage
import com.rabbywallet.keychain9.PrefsStorageBase.Companion.getKeyForPassword
import com.rabbywallet.keychain9.PrefsStorageBase.Companion.getKeyForUsername
import com.rabbywallet.keychain9.PrefsStorageBase.Companion.isKeyForCipherStorage
import com.rabbywallet.keychain9.PrefsStorageBase.DebugEntry
import com.rabbywallet.keychain9.PrefsStorageBase.ResultSet
import com.rabbywallet.keychain9.cipherStorage.CipherStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

class DataStorePrefsStorage(
  reactContext: ReactApplicationContext,
  private val coroutineScope: CoroutineScope,
) : PrefsStorageBase {

  private val Context.prefs: DataStore<Preferences> by preferencesDataStore(
    name = KEYCHAIN_DATA,
    scope = coroutineScope,
  )
  private val prefs: DataStore<Preferences> = reactContext.prefs
  private val legacyPrefs: SharedPreferences =
    reactContext.getSharedPreferences(KEYCHAIN_DATA, Context.MODE_PRIVATE)
  private val prefsData: Preferences get() = callSuspendable { prefs.data.first() }

  override fun getEncryptedEntry(service: String): ResultSet? {
    val bytesForUsername = getBytesForUsername(service)
    val bytesForPassword = getBytesForPassword(service)
    var cipherStorageName = getCipherStorageName(service)

    // in case of wrong password or username
    if (bytesForUsername == null || bytesForPassword == null) return null
    if (cipherStorageName == null) {
      // Rabby v9 did not ship Facebook Conceal. Missing markers are treated as RSA entries for
      // compatibility with earlier Rabby keychain migrations.
      cipherStorageName = KnownCiphers.RSA
    }
    return ResultSet(cipherStorageName, bytesForUsername, bytesForPassword)
  }

  override fun removeEntry(service: String) {
    val keyForUsername = stringPreferencesKey(getKeyForUsername(service))
    val keyForPassword = stringPreferencesKey(getKeyForPassword(service))
    val keyForCipherStorage = stringPreferencesKey(getKeyForCipherStorage(service))
    val legacyKeyForUsername = getKeyForUsername(service)
    val legacyKeyForPassword = getKeyForPassword(service)
    val legacyKeyForCipherStorage = getKeyForCipherStorage(service)
    callSuspendable {
      prefs.edit {
        it.remove(keyForUsername)
        it.remove(keyForPassword)
        it.remove(keyForCipherStorage)
      }
    }
    legacyPrefs.edit()
      .remove(legacyKeyForUsername)
      .remove(legacyKeyForPassword)
      .remove(legacyKeyForCipherStorage)
      .apply()
  }

  override fun storeEncryptedEntry(
    service: String,
    encryptionResult: CipherStorage.EncryptionResult,
  ) {
    val keyForUsername = stringPreferencesKey(getKeyForUsername(service))
    val keyForPassword = stringPreferencesKey(getKeyForPassword(service))
    val keyForCipherStorage = stringPreferencesKey(getKeyForCipherStorage(service))
    callSuspendable {
      prefs.edit {
        it[keyForUsername] = Base64.encodeToString(encryptionResult.username, Base64.DEFAULT)
        it[keyForPassword] = Base64.encodeToString(encryptionResult.password, Base64.DEFAULT)
        it[keyForCipherStorage] = encryptionResult.cipherName
      }
    }
  }

  override fun getDebugEntry(service: String): DebugEntry {
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
    val resolvedCipherStorageName = candidateCipherStorageNames.firstOrNull()
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
      passwordByteSize = passwordBytes?.size,
    )
  }

  override fun removeCipherStorageMarker(service: String): Boolean {
    val legacyKeyForCipherStorage = getKeyForCipherStorage(service)
    val keyForCipherStorage = stringPreferencesKey(legacyKeyForCipherStorage)
    val hasDataStoreMarker = prefsData.contains(keyForCipherStorage)
    val hasLegacyMarker = legacyPrefs.contains(legacyKeyForCipherStorage)
    if (!hasDataStoreMarker && !hasLegacyMarker) {
      return false
    }

    callSuspendable {
      prefs.edit {
        it.remove(keyForCipherStorage)
      }
    }
    legacyPrefs.edit().remove(legacyKeyForCipherStorage).apply()
    return true
  }

  override val usedCipherNames: Set<String?>
    get() {
      val result: MutableSet<String?> = HashSet()
      val keys = prefsData.asMap().keys.map { it.name }
      for (key in keys) {
        if (isKeyForCipherStorage(key)) {
          val cipher = prefsData[stringPreferencesKey(key)]
          result.add(cipher)
        }
      }
      for (key in legacyPrefs.all.keys) {
        if (isKeyForCipherStorage(key)) {
          result.add(legacyPrefs.getString(key, null))
        }
      }
      return result
    }

  private fun <T> callSuspendable(block: suspend () -> T): T {
    return runBlocking(coroutineScope.coroutineContext) {
      block()
    }
  }

  private fun getBytesForUsername(service: String): ByteArray? {
    val key = stringPreferencesKey(getKeyForUsername(service))
    return getBytes(key)
  }

  private fun getBytesForPassword(service: String): ByteArray? {
    val key = stringPreferencesKey(getKeyForPassword(service))
    return getBytes(key)
  }

  private fun getCipherStorageName(service: String): String? {
    val key = getKeyForCipherStorage(service)
    return getString(key)
  }

  private fun getBytes(prefKey: Preferences.Key<String>): ByteArray? {
    val value = prefsData[prefKey] ?: legacyPrefs.getString(prefKey.name, null)
    return value?.let { Base64.decode(it, Base64.DEFAULT) }
  }

  private fun getString(key: String): String? {
    return prefsData[stringPreferencesKey(key)] ?: legacyPrefs.getString(key, null)
  }

  private fun getCandidateCipherStorageNamesForDebug(storedCipherStorageName: String?): List<String> {
    if (storedCipherStorageName != null) {
      return listOf(storedCipherStorageName)
    }

    return listOf(
      KnownCiphers.RSA,
      KnownCiphers.AES_CBC,
      KnownCiphers.AES_GCM,
      KnownCiphers.AES_GCM_NO_AUTH,
    )
  }

  private fun getCipherStorageResolutionStrategyForDebug(
    storedCipherStorageName: String?,
  ): String {
    return if (storedCipherStorageName != null) {
      "stored-marker"
    } else {
      "missing-marker/default-rsa"
    }
  }
}
