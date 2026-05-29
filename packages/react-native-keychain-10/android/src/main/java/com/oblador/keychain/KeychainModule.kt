package com.rabbywallet.keychain10

import android.os.Build
import android.security.keystore.KeyProperties
import android.text.TextUtils
import android.util.Log
import androidx.annotation.StringDef
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt.PromptInfo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.rabbywallet.keychain10.cipherStorage.CipherCache
import com.rabbywallet.keychain10.cipherStorage.CipherStorage
import com.rabbywallet.keychain10.cipherStorage.CipherStorage.DecryptionResult
import com.rabbywallet.keychain10.cipherStorage.CipherStorageBase
import com.rabbywallet.keychain10.cipherStorage.CipherStorageKeystoreAesCbc
import com.rabbywallet.keychain10.cipherStorage.CipherStorageKeystoreAesGcm
import com.rabbywallet.keychain10.cipherStorage.CipherStorageKeystoreRsaEcb
import com.rabbywallet.keychain10.resultHandler.ResultHandler
import com.rabbywallet.keychain10.resultHandler.ResultHandlerProvider
import com.rabbywallet.keychain10.exceptions.CryptoFailedException
import com.rabbywallet.keychain10.exceptions.EmptyParameterException
import com.rabbywallet.keychain10.exceptions.KeyStoreAccessException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@ReactModule(name = KeychainModule.KEYCHAIN_MODULE)
@Suppress("unused")
class KeychainModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  @StringDef(
    AccessControl.NONE,
    AccessControl.USER_PRESENCE,
    AccessControl.BIOMETRY_ANY,
    AccessControl.BIOMETRY_CURRENT_SET,
    AccessControl.DEVICE_PASSCODE,
    AccessControl.APPLICATION_PASSWORD,
    AccessControl.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    AccessControl.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE
  )
  internal annotation class AccessControl {
    companion object {
      const val NONE = "None"
      const val USER_PRESENCE = "UserPresence"
      const val BIOMETRY_ANY = "BiometryAny"
      const val BIOMETRY_CURRENT_SET = "BiometryCurrentSet"
      const val DEVICE_PASSCODE = "DevicePasscode"
      const val APPLICATION_PASSWORD = "ApplicationPassword"
      const val BIOMETRY_ANY_OR_DEVICE_PASSCODE = "BiometryAnyOrDevicePasscode"
      const val BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE = "BiometryCurrentSetOrDevicePasscode"
    }
  }

  internal annotation class AuthPromptOptions {
    companion object {
      const val TITLE = "title"
      const val SUBTITLE = "subtitle"
      const val DESCRIPTION = "description"
      const val CANCEL = "cancel"
    }
  }

  /** Options mapping keys. */
  internal annotation class Maps {
    companion object {
      const val ACCESS_CONTROL = "accessControl"
      const val ACCESS_GROUP = "accessGroup"
      const val ACCESSIBLE = "accessible"
      const val ANDROID_ALLOW_AUTHENTICATED_SESSION_REUSE =
        "androidAllowAuthenticatedSessionReuse"
      const val ANDROID_KEYCHAIN_AUTH_PROFILE = "androidKeychainAuthProfile"
      const val AUTH_PROMPT = "authenticationPrompt"
      const val AUTH_TYPE = "authenticationType"
      const val SERVICE = "service"
      const val SERVER = "server"
      const val SECURITY_LEVEL = "securityLevel"
      const val RULES = "rules"
      const val USERNAME = "username"
      const val PASSWORD = "password"
      const val STORAGE = "storage"
    }
  }

  /** Known error codes. */
  internal annotation class Errors {
    companion object {
      const val E_EMPTY_PARAMETERS = "E_EMPTY_PARAMETERS"
      const val E_CRYPTO_FAILED = "E_CRYPTO_FAILED"
      const val E_KEYSTORE_ACCESS_ERROR = "E_KEYSTORE_ACCESS_ERROR"
      const val E_SUPPORTED_BIOMETRY_ERROR = "E_SUPPORTED_BIOMETRY_ERROR"

      /** Raised for unexpected errors. */
      const val E_UNKNOWN_ERROR = "E_UNKNOWN_ERROR"
    }
  }

  /** Supported ciphers. */
  @StringDef(KnownCiphers.AES_CBC, KnownCiphers.AES_GCM, KnownCiphers.RSA)
  annotation class KnownCiphers {
    companion object {
      /** AES CBC encryption. */
      const val AES_CBC = "KeystoreAESCBC"

      /** Auth + AES GCM encryption. */
      const val AES_GCM = "KeystoreAESGCM"

      /** AES GCM encryption. */
      const val AES_GCM_NO_AUTH = "KeystoreAESGCM_NoAuth"

      /** Biometric Auth + RSA ECB encryption */
      const val RSA = "KeystoreRSAECB"
    }
  }

  // endregion
  // region Members
  /** Name-to-instance lookup map. */
  private val cipherStorageMap: MutableMap<String, CipherStorage> = HashMap()

  /** Shared preferences storage. */
  private val prefsStorage: PrefsStorageBase

  /** Launches a coroutine to perform non-blocking UI operations */
  private val coroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

  /** Mutex to prevent concurrent calls to Cipher, which doesn't support multi-threading */
  private val mutex = Mutex()

  // endregion
  // region Initialization
  /** Default constructor. */
  init {
    prefsStorage = DataStorePrefsStorage(reactContext, coroutineScope)
    addCipherStorageToMap(CipherStorageKeystoreAesCbc(reactContext))
    addCipherStorageToMap(CipherStorageKeystoreAesGcm(reactContext, false))
    addCipherStorageToMap(CipherStorageKeystoreAesGcm(reactContext, true))
    addCipherStorageToMap(CipherStorageKeystoreRsaEcb(reactContext))
  }

  // endregion
  // region Overrides
  /** {@inheritDoc} */
  override fun getName(): String {
    return KEYCHAIN_MODULE
  }

  override fun invalidate() {
    super.invalidate()
    if (coroutineScope.isActive) {
      coroutineScope.cancel("$KEYCHAIN_MODULE has been destroyed.")
    }
    // Clean up cipher cache
    CipherCache.clearCache()
  }

  /** {@inheritDoc} */
  override fun getConstants(): Map<String, Any> {
    val constants: MutableMap<String, Any> = HashMap()
    constants[SecurityLevel.ANY.jsName()] = SecurityLevel.ANY.name
    constants[SecurityLevel.SECURE_SOFTWARE.jsName()] = SecurityLevel.SECURE_SOFTWARE.name
    constants[SecurityLevel.SECURE_HARDWARE.jsName()] = SecurityLevel.SECURE_HARDWARE.name
    return constants
  }
  // endregion

  // region React Methods
  private fun setGenericPassword(
    alias: String,
    username: String,
    password: String,
    options: ReadableMap?,
    promise: Promise
  ) {
    coroutineScope.launch {
      mutex.withLock {
        try {
          throwIfEmptyLoginPassword(username, password)
          val level = getSecurityLevelOrDefault(options)
          val storage = getSelectedStorage(options)
          throwIfInsufficientLevel(storage, level)
          val accessControl = getAccessControlOrDefault(options)
          val usePasscode = getUsePasscode(accessControl) && isPasscodeAvailable
          val useBiometry =
            getUseBiometry(accessControl) && (isFingerprintAuthAvailable || isFaceAuthAvailable || isIrisAuthAvailable)
          val androidKeychainAuthConfig =
            getAndroidKeychainAuthConfig(options, usePasscode, useBiometry)
          storage.setAndroidKeychainAuthConfig(androidKeychainAuthConfig)
          val promptInfo = getPromptInfo(options, androidKeychainAuthConfig)
          val deviceCredentialFallbackPromptInfo =
            getDeviceCredentialFallbackPromptInfo(options, androidKeychainAuthConfig)
          val result =
            encryptToResult(
              alias,
              storage,
              username,
              password,
              level,
              promptInfo,
              deviceCredentialFallbackPromptInfo
            )
          prefsStorage.storeEncryptedEntry(alias, result)
          val results = Arguments.createMap()
          results.putString(Maps.SERVICE, alias)
          results.putString(Maps.STORAGE, storage.getCipherStorageName())
          promise.resolve(results)
        } catch (e: EmptyParameterException) {
          Log.e(KEYCHAIN_MODULE, e.message, e)
          promise.reject(Errors.E_EMPTY_PARAMETERS, e)
        } catch (e: CryptoFailedException) {
          Log.e(KEYCHAIN_MODULE, e.message, e)
          promise.reject(Errors.E_CRYPTO_FAILED, e)
        } catch (fail: Throwable) {
          Log.e(KEYCHAIN_MODULE, fail.message, fail)
          promise.reject(Errors.E_UNKNOWN_ERROR, fail)
        }
      }
    }
  }

  @ReactMethod
  fun setGenericPasswordForOptions(
    options: ReadableMap?,
    username: String,
    password: String,
    promise: Promise
  ) {
    val service = getServiceOrDefault(options)
    setGenericPassword(service, username, password, options, promise)
  }

  /** Get Cipher storage instance based on user provided options. */
  @Throws(CryptoFailedException::class)
  private fun getSelectedStorage(options: ReadableMap?): CipherStorage {
    val accessControl = getAccessControlOrDefault(options)
    val useBiometry = getUseBiometry(accessControl)
    val usePasscode = getUsePasscode(accessControl)
    val cipherName = getSpecificStorageOrDefault(options)
    var result: CipherStorage? = null
    if (null != cipherName) {
      result = getCipherStorageByName(cipherName)
    }

    // attempt to access none existing storage will force fallback logic.
    if (null == result) {
      result = getCipherStorageForCurrentAPILevel(useBiometry, usePasscode)
    }
    return result
  }

  private fun getGenericPassword(alias: String, options: ReadableMap?, promise: Promise) {
    coroutineScope.launch {
      mutex.withLock {
        try {
          val resultSet = prefsStorage.getEncryptedEntry(alias)
          if (resultSet == null) {
            Log.e(KEYCHAIN_MODULE, "No entry found for service: $alias")
            promise.resolve(false)
            return@launch
          }
          val storageName = resultSet.cipherStorageName
          val accessControl = getAccessControlOrDefault(options)
          val usePasscode = getUsePasscode(accessControl) && isPasscodeAvailable
          val useBiometry =
            getUseBiometry(accessControl) && (isFingerprintAuthAvailable || isFaceAuthAvailable || isIrisAuthAvailable)
          val androidKeychainAuthConfig =
            getAndroidKeychainAuthConfig(options, usePasscode, useBiometry)
          val promptInfo = getPromptInfo(options, androidKeychainAuthConfig)
          val deviceCredentialFallbackPromptInfo =
            getDeviceCredentialFallbackPromptInfo(options, androidKeychainAuthConfig)
          val cipher = getCipherStorageByName(storageName)
          val decryptionResult =
            decryptCredentials(
              alias,
              cipher!!,
              resultSet,
              promptInfo,
              deviceCredentialFallbackPromptInfo,
              options
            )
          val credentials = Arguments.createMap()
          credentials.putString(Maps.SERVICE, alias)
          credentials.putString(Maps.USERNAME, decryptionResult.username)
          credentials.putString(Maps.PASSWORD, decryptionResult.password)
          credentials.putString(Maps.STORAGE, cipher?.getCipherStorageName())
          promise.resolve(credentials)
        } catch (e: KeyStoreAccessException) {
          Log.e(KEYCHAIN_MODULE, e.message!!)
          promise.reject(Errors.E_KEYSTORE_ACCESS_ERROR, e)
        } catch (e: CryptoFailedException) {
          Log.e(KEYCHAIN_MODULE, e.message!!)
          promise.reject(Errors.E_CRYPTO_FAILED, e)
        } catch (fail: Throwable) {
          Log.e(KEYCHAIN_MODULE, fail.message, fail)
          promise.reject(Errors.E_UNKNOWN_ERROR, fail)
        }
      }
    }
  }

  @ReactMethod
  fun getAllGenericPasswordServices(options: ReadableMap?, promise: Promise) {
    try {
      val services = doGetAllGenericPasswordServices()
      promise.resolve(Arguments.makeNativeArray<Any>(services.toTypedArray()))
    } catch (e: KeyStoreAccessException) {
      promise.reject(Errors.E_KEYSTORE_ACCESS_ERROR, e)
    }
  }

  @Throws(KeyStoreAccessException::class)
  private fun doGetAllGenericPasswordServices(): Collection<String> {
    val cipherNames = prefsStorage.usedCipherNames
    val ciphers: MutableCollection<CipherStorage?> = ArrayList(cipherNames.size)
    for (storageName in cipherNames) {
      val cipherStorage = getCipherStorageByName(storageName!!)
      ciphers.add(cipherStorage)
    }
    val result: MutableSet<String> = HashSet()
    for (cipher in ciphers) {
      val aliases = cipher!!.getAllKeys()
      for (alias in aliases) {
        result.add(alias)
      }
    }
    return result
  }

  @ReactMethod
  fun getGenericPasswordForOptions(options: ReadableMap?, promise: Promise) {
    val service = getServiceOrDefault(options)
    getGenericPassword(service, options, promise)
  }

  private fun resetGenericPassword(alias: String, promise: Promise) {
    try {
      // First we clean up the cipher storage (using the cipher storage that was used to store the
      // entry)
      val resultSet = prefsStorage.getEncryptedEntry(alias)
      if (resultSet != null) {
        val cipherStorage = getCipherStorageByName(resultSet.cipherStorageName)
        cipherStorage?.removeKey(alias)
      }
      // And then we remove the entry in the shared preferences
      prefsStorage.removeEntry(alias)
      promise.resolve(true)
    } catch (e: KeyStoreAccessException) {
      Log.e(KEYCHAIN_MODULE, e.message!!)
      promise.reject(Errors.E_KEYSTORE_ACCESS_ERROR, e)
    } catch (fail: Throwable) {
      Log.e(KEYCHAIN_MODULE, fail.message, fail)
      promise.reject(Errors.E_UNKNOWN_ERROR, fail)
    }
  }

  @ReactMethod
  fun resetGenericPasswordForOptions(options: ReadableMap?, promise: Promise) {
    val service = getServiceOrDefault(options)
    resetGenericPassword(service, promise)
  }

  @ReactMethod
  fun hasInternetCredentialsForOptions(options: ReadableMap, promise: Promise) {
    val server = options.getString(Maps.SERVER)
    val alias = getAliasOrDefault(server)
    val resultSet = prefsStorage.getEncryptedEntry(alias)
    if (resultSet == null) {
      Log.e(KEYCHAIN_MODULE, "No entry found for service: $alias")
      promise.resolve(false)
      return
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun hasGenericPasswordForOptions(options: ReadableMap?, promise: Promise) {
    val service = getServiceOrDefault(options)
    val resultSet = prefsStorage.getEncryptedEntry(service)
    if (resultSet == null) {
      Log.e(KEYCHAIN_MODULE, "No entry found for service: $service")
      promise.resolve(false)
      return
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun setInternetCredentialsForServer(
    server: String,
    username: String,
    password: String,
    options: ReadableMap?,
    promise: Promise
  ) {
    setGenericPassword(server, username, password, options, promise)
  }

  @ReactMethod
  fun getInternetCredentialsForServer(server: String, options: ReadableMap?, promise: Promise) {
    getGenericPassword(server, options, promise)
  }

  @ReactMethod
  fun resetInternetCredentialsForOptions(options: ReadableMap, promise: Promise) {
    val server = options.getString(Maps.SERVER)
    val alias = getAliasOrDefault(server)
    resetGenericPassword(alias, promise)
  }

  @ReactMethod
  fun isPasscodeAuthAvailable(promise: Promise) {
    try {
      val reply: Boolean = DeviceAvailability.isDevicePasscodeAvailable(reactApplicationContext)
      promise.resolve(reply)
    } catch (fail: Throwable) {
      Log.e(KEYCHAIN_MODULE, fail.message, fail)
      promise.reject(Errors.E_UNKNOWN_ERROR, fail)
    }
  }

  @ReactMethod
  fun getSupportedBiometryType(promise: Promise) {
    try {
      var reply: String? = null
      if (!DeviceAvailability.isStrongBiometricAuthAvailable(reactApplicationContext)) {
        reply = null
      } else {
        if (isFingerprintAuthAvailable) {
          reply = FINGERPRINT_SUPPORTED_NAME
        } else if (isFaceAuthAvailable) {
          reply = FACE_SUPPORTED_NAME
        } else if (isIrisAuthAvailable) {
          reply = IRIS_SUPPORTED_NAME
        }
      }
      promise.resolve(reply)
    } catch (e: Exception) {
      Log.e(KEYCHAIN_MODULE, e.message, e)
      promise.reject(Errors.E_SUPPORTED_BIOMETRY_ERROR, e)
    } catch (fail: Throwable) {
      Log.e(KEYCHAIN_MODULE, fail.message, fail)
      promise.reject(Errors.E_UNKNOWN_ERROR, fail)
    }
  }

  @ReactMethod
  fun debugGetGenericPasswordStateForOptions(options: ReadableMap?, promise: Promise) {
    try {
      val service = getServiceOrDefault(options)
      val debugEntry = prefsStorage.getDebugEntry(service)
      val keyDebugInfo =
        debugEntry.resolvedCipherStorageName
          ?.let { getCipherStorageByName(it) as? CipherStorageBase }
          ?.getKeyDebugInfo(service)
      val result = Arguments.createMap()

      result.putString(Maps.SERVICE, debugEntry.service)
      result.putMap("androidAuthenticatorCapabilities", buildAndroidAuthenticatorCapabilities())
      result.putBoolean("hasEntry", debugEntry.hasEntry)
      result.putBoolean("hasUsername", debugEntry.hasUsername)
      result.putBoolean("hasPassword", debugEntry.hasPassword)
      result.putBoolean("hasCipherStorageMarker", debugEntry.hasCipherStorageMarker)
      result.putBoolean(
        "isCipherStorageMarkerMissing",
        debugEntry.hasEntry && !debugEntry.hasCipherStorageMarker
      )
      result.putString("storedUsernameBase64", debugEntry.storedUsernameBase64)
      result.putString("storedPasswordBase64", debugEntry.storedPasswordBase64)
      result.putString("storedCipherStorageMarkerValue", debugEntry.storedCipherStorageMarkerValue)
      result.putString("storedCipherStorageName", debugEntry.storedCipherStorageName)
      result.putString("resolvedCipherStorageName", debugEntry.resolvedCipherStorageName)

      val candidateCipherStorageNames = Arguments.createArray()
      debugEntry.candidateCipherStorageNames.forEach { candidate ->
        candidateCipherStorageNames.pushString(candidate)
      }
      result.putArray("candidateCipherStorageNames", candidateCipherStorageNames)

      result.putString("cipherStorageResolutionStrategy", debugEntry.cipherStorageResolutionStrategy)
      putNullableInt(result, "usernameByteSize", debugEntry.usernameByteSize)
      putNullableInt(result, "passwordByteSize", debugEntry.passwordByteSize)

      if (keyDebugInfo != null) {
        result.putString("keystoreAlias", keyDebugInfo.alias)
        result.putBoolean("hasKeystoreAlias", keyDebugInfo.hasAlias)
        result.putString("keystoreKeyAlgorithm", keyDebugInfo.keyAlgorithm)
        result.putString("keystoreSecurityLevel", keyDebugInfo.securityLevelName)
        putNullableBoolean(
          result,
          "keystoreInsideSecureHardware",
          keyDebugInfo.isInsideSecureHardware
        )
        putNullableBoolean(
          result,
          "keystoreUserAuthenticationRequired",
          keyDebugInfo.isUserAuthenticationRequired
        )
        putNullableInt(
          result,
          "keystoreUserAuthenticationValidityDurationSeconds",
          keyDebugInfo.userAuthenticationValidityDurationSeconds
        )
        putNullableInt(result, "keystoreUserAuthenticationType", keyDebugInfo.userAuthenticationType)
        if (keyDebugInfo.blockModes != null) {
          result.putString("keystoreBlockModes", TextUtils.join(",", keyDebugInfo.blockModes))
        } else {
          result.putNull("keystoreBlockModes")
        }
        putNullableInt(result, "keystorePurposes", keyDebugInfo.purposes)
        putNullableBoolean(
          result,
          "keystoreIsCompatibleWithCurrentCipher",
          keyDebugInfo.isCompatibleWithCurrentCipher
        )
        result.putString("keystorePublicKeySha256", keyDebugInfo.publicKeySha256)
        result.putString("keystoreDebugErrorMessage", keyDebugInfo.errorMessage)
      } else {
        result.putString("keystoreAlias", service)
        result.putBoolean("hasKeystoreAlias", false)
        result.putNull("keystoreKeyAlgorithm")
        result.putNull("keystoreSecurityLevel")
        result.putNull("keystoreInsideSecureHardware")
        result.putNull("keystoreUserAuthenticationRequired")
        result.putNull("keystoreUserAuthenticationValidityDurationSeconds")
        result.putNull("keystoreUserAuthenticationType")
        result.putNull("keystoreBlockModes")
        result.putNull("keystorePurposes")
        result.putNull("keystoreIsCompatibleWithCurrentCipher")
        result.putNull("keystorePublicKeySha256")
        result.putNull("keystoreDebugErrorMessage")
      }

      promise.resolve(result)
    } catch (fail: Throwable) {
      Log.e(KEYCHAIN_MODULE, fail.message, fail)
      promise.reject(Errors.E_UNKNOWN_ERROR, fail)
    }
  }

  private fun buildAndroidAuthenticatorCapabilities(): WritableMap {
    val result = Arguments.createMap()
    result.putInt("apiLevel", Build.VERSION.SDK_INT)
    putAndroidAuthenticatorCapability(
      result,
      "biometricStrong",
      "BIOMETRIC_STRONG",
      BiometricManager.Authenticators.BIOMETRIC_STRONG
    )
    putAndroidAuthenticatorCapability(
      result,
      "deviceCredential",
      "DEVICE_CREDENTIAL",
      BiometricManager.Authenticators.DEVICE_CREDENTIAL
    )
    putAndroidAuthenticatorCapability(
      result,
      "biometricStrongOrDeviceCredential",
      "BIOMETRIC_STRONG | DEVICE_CREDENTIAL",
      BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL
    )
    putAndroidAuthenticatorCapability(
      result,
      "biometricWeak",
      "BIOMETRIC_WEAK",
      BiometricManager.Authenticators.BIOMETRIC_WEAK
    )
    return result
  }

  private fun putAndroidAuthenticatorCapability(
    result: WritableMap,
    key: String,
    name: String,
    authenticators: Int
  ) {
    val capability = Arguments.createMap()
    capability.putString("name", name)
    capability.putInt("authenticators", authenticators)

    try {
      val statusCode =
        BiometricManager.from(reactApplicationContext).canAuthenticate(authenticators)
      capability.putInt("statusCode", statusCode)
      capability.putString("statusLabel", getAndroidAuthenticatorStatusLabel(statusCode))
      capability.putBoolean("available", statusCode == BiometricManager.BIOMETRIC_SUCCESS)
      capability.putNull("errorMessage")
    } catch (fail: Throwable) {
      capability.putNull("statusCode")
      capability.putString("statusLabel", "ERROR")
      capability.putBoolean("available", false)
      capability.putString("errorMessage", fail.message ?: fail.javaClass.simpleName)
    }

    result.putMap(key, capability)
  }

  private fun getAndroidAuthenticatorStatusLabel(statusCode: Int): String {
    return when (statusCode) {
      0 -> "BIOMETRIC_SUCCESS"
      1 -> "BIOMETRIC_ERROR_HW_UNAVAILABLE"
      11 -> "BIOMETRIC_ERROR_NONE_ENROLLED"
      12 -> "BIOMETRIC_ERROR_NO_HARDWARE"
      15 -> "BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED"
      -1 -> "BIOMETRIC_STATUS_UNKNOWN"
      -2 -> "BIOMETRIC_ERROR_UNSUPPORTED"
      else -> "BIOMETRIC_STATUS_$statusCode"
    }
  }

  @ReactMethod
  fun debugRemoveCipherStorageMarkerForOptions(options: ReadableMap?, promise: Promise) {
    try {
      val service = getServiceOrDefault(options)
      promise.resolve(prefsStorage.removeCipherStorageMarker(service))
    } catch (fail: Throwable) {
      Log.e(KEYCHAIN_MODULE, fail.message, fail)
      promise.reject(Errors.E_UNKNOWN_ERROR, fail)
    }
  }

  @ReactMethod
  fun getSecurityLevel(options: ReadableMap?, promise: Promise) {
    val accessControl = getAccessControlOrDefault(options)
    val useBiometry = getUseBiometry(accessControl)
    val usePasscode = getUsePasscode(accessControl)
    promise.resolve(getSecurityLevel(useBiometry, usePasscode).name)
  }

  private fun putNullableBoolean(result: WritableMap, key: String, value: Boolean?) {
    if (value != null) {
      result.putBoolean(key, value)
    } else {
      result.putNull(key)
    }
  }

  private fun putNullableInt(result: WritableMap, key: String, value: Int?) {
    if (value != null) {
      result.putInt(key, value)
    } else {
      result.putNull(key)
    }
  }

  private fun addCipherStorageToMap(cipherStorage: CipherStorage) {
    cipherStorageMap[cipherStorage.getCipherStorageName()] = cipherStorage
  }

  /**
   * Extract credentials from current storage. In case if current storage is not matching results
   * set then executed migration.
   */
  @Throws(CryptoFailedException::class, KeyStoreAccessException::class)
  private suspend fun decryptCredentials(
    alias: String,
    current: CipherStorage,
    resultSet: PrefsStorageBase.ResultSet,
    promptInfo: PromptInfo,
    deviceCredentialFallbackPromptInfo: PromptInfo?,
    options: ReadableMap?
  ): DecryptionResult {
    val storageName = resultSet.cipherStorageName

    // The encrypted data is encrypted using the current CipherStorage, so we just decrypt and
    // return
    if (storageName == current.getCipherStorageName()) {
      return decryptToResult(
        alias,
        current,
        resultSet,
        promptInfo,
        deviceCredentialFallbackPromptInfo,
        options
      )
    }

    // The encrypted data is encrypted using an older CipherStorage, so we need to decrypt the data
    // first,
    // then encrypt it using the current CipherStorage, then store it again and return
    val oldStorage =
      getCipherStorageByName(storageName)
        ?: throw KeyStoreAccessException(
          "Wrong cipher storage name '$storageName' or cipher not available"
        )

    // decrypt using the older cipher storage
    val decryptionResult = decryptToResult(
      alias,
      oldStorage,
      resultSet,
      promptInfo,
      deviceCredentialFallbackPromptInfo,
      options
    )
    return decryptionResult
  }

  /** Try to decrypt with provided storage. */
  @Throws(CryptoFailedException::class)
  private suspend fun decryptToResult(
    alias: String,
    storage: CipherStorage,
    resultSet: PrefsStorageBase.ResultSet,
    promptInfo: PromptInfo,
    deviceCredentialFallbackPromptInfo: PromptInfo?,
    options: ReadableMap?
  ): DecryptionResult {
    val handler = getInteractiveHandler(
      storage,
      promptInfo,
      deviceCredentialFallbackPromptInfo
    )
    storage.decryptWithPromptPolicy(
      handler,
      alias,
      resultSet.username!!,
      resultSet.password!!,
      SecurityLevel.ANY,
      getAndroidAllowAuthenticatedSessionReuseOrDefault(options)
    )
    CryptoFailedException.reThrowOnError(handler.error)
    if (null == handler.decryptionResult) {
      throw CryptoFailedException("No decryption results and no error. Something deeply wrong!")
    }
    return handler.decryptionResult!!
  }

  /** Try to encrypt with provided storage. */
  @Throws(CryptoFailedException::class)
  private suspend fun encryptToResult(
    alias: String,
    storage: CipherStorage,
    username: String,
    password: String,
    securityLevel: SecurityLevel,
    promptInfo: PromptInfo,
    deviceCredentialFallbackPromptInfo: PromptInfo?
  ): CipherStorage.EncryptionResult {
    val handler = getInteractiveHandler(
      storage,
      promptInfo,
      deviceCredentialFallbackPromptInfo
    )
    storage.encrypt(handler, alias, username, password, securityLevel)
    CryptoFailedException.reThrowOnError(handler.error)
    if (null == handler.encryptionResult) {
      throw CryptoFailedException("No decryption results and no error. Something deeply wrong!")
    }
    return handler.encryptionResult!!
  }

  /** Get instance of handler that resolves access to the keystore on system request. */
  private fun getInteractiveHandler(
    current: CipherStorage,
    promptInfo: PromptInfo,
    deviceCredentialFallbackPromptInfo: PromptInfo?
  ): ResultHandler {
    val reactContext = reactApplicationContext
    return ResultHandlerProvider.getHandler(
      reactContext,
      current,
      promptInfo,
      deviceCredentialFallbackPromptInfo
    )
  }

  /** Remove key from old storage and add it to the new storage. */
  /* package */
  @Throws(
    KeyStoreAccessException::class,
    CryptoFailedException::class,
    IllegalArgumentException::class
  )
  private suspend fun migrateCipherStorage(
    service: String,
    newCipherStorage: CipherStorage,
    oldCipherStorage: CipherStorage,
    decryptionResult: DecryptionResult,
    promptInfo: PromptInfo
  ) {

    val username =
      decryptionResult.username ?: throw IllegalArgumentException("Username cannot be null")
    val password =
      decryptionResult.password ?: throw IllegalArgumentException("Password cannot be null")
    // don't allow to degrade security level when transferring, the new
    // storage should be as safe as the old one.
    val encryptionResult = encryptToResult(
      service,
      newCipherStorage,
      username,
      password,
      decryptionResult.getSecurityLevel(),
      promptInfo,
      null
    )

    // store the encryption result
    prefsStorage.storeEncryptedEntry(service, encryptionResult)

    // clean up the old cipher storage
    oldCipherStorage.removeKey(service)
  }

  /**
   * The "Current" CipherStorage is the cipherStorage with the highest API level that is lower than
   * or equal to the current API level. Parameter allow to reduce level.
   */
  @Throws(CryptoFailedException::class)
  fun getCipherStorageForCurrentAPILevel(
    useBiometry: Boolean,
    usePasscode: Boolean
  ): CipherStorage {
    val currentApiLevel = Build.VERSION.SDK_INT
    val isBiometry =
      useBiometry && (isFingerprintAuthAvailable || isFaceAuthAvailable || isIrisAuthAvailable)
    val isPasscode = usePasscode && isPasscodeAvailable
    var foundCipher: CipherStorage? = null
    for (variant in cipherStorageMap.values) {
      Log.d(KEYCHAIN_MODULE, "Probe cipher storage: " + variant.getCipherStorageName())

      // Is the cipherStorage supported on the current API level?
      val minApiLevel = variant.getMinSupportedApiLevel()
      val capabilityLevel = variant.getCapabilityLevel()
      val isSupportedApi = minApiLevel <= currentApiLevel

      // API not supported
      if (!isSupportedApi) continue

      // Is the API level better than the one we previously selected (if any)?
      if (foundCipher != null && capabilityLevel < foundCipher.getCapabilityLevel()) continue

      // if biometric supported but not configured properly than skip
      if (variant.isAuthSupported() && !isBiometry && !isPasscode) continue

      // remember storage with the best capabilities
      foundCipher = variant
    }
    if (foundCipher == null) {
      throw CryptoFailedException("Unsupported Android SDK " + Build.VERSION.SDK_INT)
    }
    Log.d(KEYCHAIN_MODULE, "Selected storage: " + foundCipher.getCipherStorageName())
    return foundCipher
  }

  /** Extract cipher by it unique name. [CipherStorage.getCipherStorageName]. */
  fun getCipherStorageByName(@KnownCiphers knownName: String): CipherStorage? {
    return cipherStorageMap[knownName]
  }

  val isFingerprintAuthAvailable: Boolean
    /** True - if fingerprint hardware available and configured, otherwise false. */
    get() =
      DeviceAvailability.isStrongBiometricAuthAvailable(reactApplicationContext) &&
        DeviceAvailability.isFingerprintAuthAvailable(reactApplicationContext)

  val isFaceAuthAvailable: Boolean
    /** True - if face recognition hardware available and configured, otherwise false. */
    get() =
      DeviceAvailability.isStrongBiometricAuthAvailable(reactApplicationContext) &&
        DeviceAvailability.isFaceAuthAvailable(reactApplicationContext)

  val isIrisAuthAvailable: Boolean
    /** True - if iris recognition hardware available and configured, otherwise false. */
    get() =
      DeviceAvailability.isStrongBiometricAuthAvailable(reactApplicationContext) &&
        DeviceAvailability.isIrisAuthAvailable(reactApplicationContext)

  val isSecureHardwareAvailable: Boolean
    /** Is secured hardware a part of current storage or not. */
    get() = DeviceAvailability.isStrongboxAvailable(reactApplicationContext)

  val isPasscodeAvailable: Boolean
    /** Is secured hardware a part of current storage or not. */
    get() = DeviceAvailability.isDevicePasscodeAvailable(reactApplicationContext)

  /** Resolve storage to security level it provides. */
  private fun getSecurityLevel(useBiometry: Boolean, usePasscode: Boolean): SecurityLevel {
    return try {
      val storage = getCipherStorageForCurrentAPILevel(useBiometry, usePasscode)
      if (!storage.securityLevel().satisfiesSafetyThreshold(SecurityLevel.SECURE_SOFTWARE)) {
        return SecurityLevel.ANY
      }
      if (isSecureHardwareAvailable) {
        SecurityLevel.SECURE_HARDWARE
      } else SecurityLevel.SECURE_SOFTWARE
    } catch (e: CryptoFailedException) {
      Log.w(KEYCHAIN_MODULE, "Security Level Exception: " + e.message, e)
      SecurityLevel.ANY
    }
  }
  // endregion

  companion object {
    // region Constants
    const val KEYCHAIN_MODULE = "RNRabbyKeychainV10Manager"
    const val FINGERPRINT_SUPPORTED_NAME = "Fingerprint"
    const val FACE_SUPPORTED_NAME = "Face"
    const val IRIS_SUPPORTED_NAME = "Iris"
    const val EMPTY_STRING = ""
    private val LOG_TAG = KeychainModule::class.java.simpleName


    // endregion
    // region Helpers
    /** Get service value from options. */
    private fun getServiceOrDefault(options: ReadableMap?): String {
      var service: String? = null
      if (null != options && options.hasKey(Maps.SERVICE)) {
        service = options.getString(Maps.SERVICE)
      }
      return getAliasOrDefault(service)
    }

    /** Extract user specified storage from options. */
    @KnownCiphers
    private fun getSpecificStorageOrDefault(options: ReadableMap?): String? {
      var storageName: String? = null
      if (null != options && options.hasKey(Maps.STORAGE)) {
        storageName = options.getString(Maps.STORAGE)
      }
      return storageName
    }

    private fun getAndroidAllowAuthenticatedSessionReuseOrDefault(options: ReadableMap?): Boolean {
      return options != null &&
        options.hasKey(Maps.ANDROID_ALLOW_AUTHENTICATED_SESSION_REUSE) &&
        options.getBoolean(Maps.ANDROID_ALLOW_AUTHENTICATED_SESSION_REUSE)
    }

    /** Get access control value from options or fallback to [AccessControl.NONE]. */
    @AccessControl
    private fun getAccessControlOrDefault(options: ReadableMap?): String {
      return getAccessControlOrDefault(options, AccessControl.NONE)
    }

    /** Get access control value from options or fallback to default. */
    @AccessControl
    private fun getAccessControlOrDefault(
      options: ReadableMap?,
      @AccessControl fallback: String
    ): String {
      var accessControl: String? = null
      if (null != options && options.hasKey(Maps.ACCESS_CONTROL)) {
        accessControl = options.getString(Maps.ACCESS_CONTROL)
      }
      return accessControl ?: fallback
    }

    /** Get security level from options or fallback [SecurityLevel.ANY] value. */
    private fun getSecurityLevelOrDefault(options: ReadableMap?): SecurityLevel {
      return getSecurityLevelOrDefault(options, SecurityLevel.ANY.name)
    }

    /** Get security level from options or fallback to default value. */
    private fun getSecurityLevelOrDefault(
      options: ReadableMap?,
      fallback: String
    ): SecurityLevel {
      var minimalSecurityLevel: String? = null
      if (null != options && options.hasKey(Maps.SECURITY_LEVEL)) {
        minimalSecurityLevel = options.getString(Maps.SECURITY_LEVEL)
      }
      if (null == minimalSecurityLevel) minimalSecurityLevel = fallback
      return SecurityLevel.valueOf(minimalSecurityLevel)
    }

    // endregion
    // region Implementation

    /** Is provided access control string matching biometry use request? */
    fun getUseBiometry(@AccessControl accessControl: String?): Boolean {
      return accessControl in setOf(
        AccessControl.BIOMETRY_ANY,
        AccessControl.BIOMETRY_CURRENT_SET,
        AccessControl.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        AccessControl.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE
      )
    }

    /** Is provided access control string matching passcode use request? */
    fun getUsePasscode(@AccessControl accessControl: String?): Boolean {
      return accessControl in setOf(
        AccessControl.DEVICE_PASSCODE,
        AccessControl.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        AccessControl.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE
      )
    }

    private fun getAndroidKeychainAuthConfig(
      options: ReadableMap?,
      usePasscode: Boolean,
      useBiometry: Boolean
    ): AndroidKeychainAuthConfig {
      val requestedProfile =
        if (options != null && options.hasKey(Maps.ANDROID_KEYCHAIN_AUTH_PROFILE)) {
          options.getString(Maps.ANDROID_KEYCHAIN_AUTH_PROFILE)
        } else {
          null
        }

      return AndroidKeychainAuthConfig.fromProfile(requestedProfile)
        ?: AndroidKeychainAuthConfig.fromAccessControl(usePasscode, useBiometry)
    }

    /** Extract user specified prompt info from options. */
    private fun getPromptInfo(
      options: ReadableMap?,
      androidKeychainAuthConfig: AndroidKeychainAuthConfig,
      promptAuthenticatorsOverride: Int? = null
    ): PromptInfo {
      val promptInfoOptionsMap =
        if (options != null && options.hasKey(Maps.AUTH_PROMPT)) options.getMap(Maps.AUTH_PROMPT)
        else null

      val promptInfoBuilder = PromptInfo.Builder()
      promptInfoOptionsMap?.getString(AuthPromptOptions.TITLE)?.let {
        promptInfoBuilder.setTitle(it)
      }
      promptInfoOptionsMap?.getString(AuthPromptOptions.SUBTITLE)?.let {
        promptInfoBuilder.setSubtitle(it)
      }
      promptInfoOptionsMap?.getString(AuthPromptOptions.DESCRIPTION)?.let {
        promptInfoBuilder.setDescription(it)
      }

      val allowedAuthenticators =
        promptAuthenticatorsOverride ?: androidKeychainAuthConfig.promptAuthenticators

      if (allowedAuthenticators != null) {
        promptInfoBuilder.setAllowedAuthenticators(allowedAuthenticators)
      }

      if (allowedAuthenticators == null ||
        allowedAuthenticators and BiometricManager.Authenticators.DEVICE_CREDENTIAL == 0
      ) {
        promptInfoOptionsMap?.getString(AuthPromptOptions.CANCEL)?.let {
          promptInfoBuilder.setNegativeButtonText(it)
        }
      }

      /* Bypass confirmation to avoid KeyStore unlock timeout being exceeded when using passive biometrics */
      promptInfoBuilder.setConfirmationRequired(false)
      return promptInfoBuilder.build()
    }

    private fun getDeviceCredentialFallbackPromptInfo(
      options: ReadableMap?,
      androidKeychainAuthConfig: AndroidKeychainAuthConfig
    ): PromptInfo? {
      val promptAuthenticators = androidKeychainAuthConfig.promptAuthenticators ?: return null
      val keyAuthenticators = androidKeychainAuthConfig.keyAuthenticators ?: return null
      val canPromptBiometric =
        promptAuthenticators and BiometricManager.Authenticators.BIOMETRIC_STRONG != 0
      val canPromptDeviceCredential =
        promptAuthenticators and BiometricManager.Authenticators.DEVICE_CREDENTIAL != 0
      val keyAcceptsDeviceCredential =
        keyAuthenticators and KeyProperties.AUTH_DEVICE_CREDENTIAL != 0

      if (!canPromptBiometric || !canPromptDeviceCredential || !keyAcceptsDeviceCredential) {
        return null
      }

      return getPromptInfo(
        options,
        androidKeychainAuthConfig,
        BiometricManager.Authenticators.DEVICE_CREDENTIAL
      )
    }

    /** Throw exception in case of empty credentials providing. */
    @Throws(EmptyParameterException::class)
    fun throwIfEmptyLoginPassword(username: String?, password: String?) {
      if (TextUtils.isEmpty(username) || TextUtils.isEmpty(password)) {
        throw EmptyParameterException("you passed empty or null username/password")
      }
    }

    /**
     * Throw exception if required security level does not match storage provided security level.
     */
    @Throws(CryptoFailedException::class)
    fun throwIfInsufficientLevel(storage: CipherStorage, level: SecurityLevel) {
      if (storage.securityLevel().satisfiesSafetyThreshold(level)) {
        return
      }
      throw CryptoFailedException(
        String.format(
          "Cipher Storage is too weak. Required security level is: %s, but only %s is provided",
          level.name,
          storage.securityLevel().name
        )
      )
    }

    private fun getAliasOrDefault(alias: String?): String {
      return alias ?: EMPTY_STRING
    } // endregion
  }
}
