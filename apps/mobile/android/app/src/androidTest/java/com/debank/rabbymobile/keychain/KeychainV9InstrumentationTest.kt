@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")

package com.debank.rabbymobile.keychain

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.rabbywallet.keychain9.KeychainModule
import com.rabbywallet.keychain9.SecurityLevel
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeychainV9InstrumentationTest {
  private lateinit var keychain: KeychainModule
  private val servicesToCleanUp = mutableSetOf<String>()

  @Before
  fun setUp() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    SoLoader.init(context, false)
    keychain = KeychainModule(BridgeReactContext(context))
  }

  @After
  fun tearDown() {
    servicesToCleanUp.forEach { service ->
      runCatching {
        call { promise ->
          keychain.resetGenericPasswordForOptions(options(service), promise)
        }
      }
    }
    keychain.invalidate()
  }

  @Test
  fun aesStorageRoundTripsWithoutBiometricPrompt() {
    val service = serviceName("aes")
    val options = options(service, storage = KeychainModule.KnownCiphers.AES)

    val setResult =
        call { promise ->
          keychain.setGenericPasswordForOptions(
              options,
              "instrumentation-user",
              "secret-value",
              promise)
        } as WritableMap
    assertEquals(service, setResult.getString("service"))
    assertEquals(KeychainModule.KnownCiphers.AES, setResult.getString("storage"))

    val debugState =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertTrue(debugState.getBoolean("hasEntry"))
    assertTrue(debugState.getBoolean("hasUsername"))
    assertTrue(debugState.getBoolean("hasPassword"))
    assertTrue(debugState.getBoolean("hasCipherStorageMarker"))
    assertFalse(debugState.getBoolean("isCipherStorageMarkerMissing"))
    assertEquals(
        KeychainModule.KnownCiphers.AES,
        debugState.getString("storedCipherStorageName"))
    assertTrue(debugState.getInt("usernameByteSize") > 0)
    assertTrue(debugState.getInt("passwordByteSize") > 0)

    val credentials =
        call { promise -> keychain.getGenericPasswordForOptions(options, promise) } as WritableMap
    assertEquals(service, credentials.getString("service"))
    assertEquals("instrumentation-user", credentials.getString("username"))
    assertEquals("secret-value", credentials.getString("password"))
    assertEquals(KeychainModule.KnownCiphers.AES, credentials.getString("storage"))

    assertEquals(
        true,
        call { promise -> keychain.hasGenericPasswordForOptions(options, promise) })
    assertEquals(
        true,
        call { promise -> keychain.resetGenericPasswordForOptions(options, promise) })

    val afterReset =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertFalse(afterReset.getBoolean("hasEntry"))
  }

  @Test
  fun missingServiceDebugApisReturnFalseAndEmptyState() {
    val service = serviceName("missing")
    val options = options(service)

    assertEquals(
        false,
        call { promise -> keychain.getGenericPasswordForOptions(options, promise) })
    assertEquals(
        false,
        call { promise -> keychain.hasGenericPasswordForOptions(options, promise) })
    assertEquals(
        false,
        call { promise -> keychain.debugDecryptGenericPasswordForOptions(options, promise) })
    assertEquals(
        false,
        call { promise ->
          keychain.debugRemoveCipherStorageMarkerForOptions(options, promise)
        })

    val debugState =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertEquals(service, debugState.getString("service"))
    assertFalse(debugState.getBoolean("hasEntry"))
    assertFalse(debugState.getBoolean("hasUsername"))
    assertFalse(debugState.getBoolean("hasPassword"))
    assertFalse(debugState.getBoolean("hasCipherStorageMarker"))
    assertFalse(debugState.getBoolean("isCipherStorageMarkerMissing"))
    assertEquals(
        0,
        debugState.getArray("candidateCipherStorageNames")?.size() ?: -1)
    assertFalse(debugState.getBoolean("hasKeystoreAlias"))

    assertEquals(
        true,
        call { promise -> keychain.resetGenericPasswordForOptions(options, promise) })
  }

  @Test
  fun missingCipherStorageMarkerFallsBackToRsaForDebugMigrationCoverage() {
    val service = serviceName("rsa-missing-marker")
    val options = options(service, storage = KeychainModule.KnownCiphers.RSA)

    call { promise ->
      keychain.setGenericPasswordForOptions(
          options,
          "instrumentation-user",
          "secret-value",
          promise)
    }

    assertEquals(
        true,
        call { promise -> keychain.debugRemoveCipherStorageMarkerForOptions(options, promise) })

    val markerlessState =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertTrue(markerlessState.getBoolean("hasEntry"))
    assertFalse(markerlessState.getBoolean("hasCipherStorageMarker"))
    assertTrue(markerlessState.getBoolean("isCipherStorageMarkerMissing"))
    assertEquals(
        KeychainModule.KnownCiphers.RSA,
        markerlessState.getString("resolvedCipherStorageName"))
    assertEquals(
        "missing-marker/default-rsa",
        markerlessState.getString("cipherStorageResolutionStrategy"))
    assertNotNull(markerlessState.getString("keystorePublicKeySha256"))

    val decryptOptions =
        options(
            service,
            androidAllowAuthenticatedSessionReuse = true,
        )
    val decrypted =
        call { promise -> keychain.debugDecryptGenericPasswordForOptions(decryptOptions, promise) }
            as WritableMap
    assertEquals("instrumentation-user", decrypted.getString("username"))
    assertEquals("secret-value", decrypted.getString("password"))
    assertEquals(KeychainModule.KnownCiphers.RSA, decrypted.getString("storage"))

    assertEquals(
        true,
        call { promise ->
          keychain.resetGenericPasswordForOptions(options(service), promise)
        })
  }

  @Test
  fun getAllGenericPasswordServicesReflectsStoredAndResetEntries() {
    val aesService = serviceName("services-aes")
    val rsaService = serviceName("services-rsa")
    val aesOptions = options(aesService, storage = KeychainModule.KnownCiphers.AES)
    val rsaOptions = options(rsaService, storage = KeychainModule.KnownCiphers.RSA)

    call { promise ->
      keychain.setGenericPasswordForOptions(
          aesOptions,
          "instrumentation-user-aes",
          "secret-value-aes",
          promise)
    }
    call { promise ->
      keychain.setGenericPasswordForOptions(
          rsaOptions,
          "instrumentation-user-rsa",
          "secret-value-rsa",
          promise)
    }

    val services =
        readableArrayStrings(call { promise -> keychain.getAllGenericPasswordServices(promise) }
            as ReadableArray)
    assertTrue(services.contains(aesService))
    assertTrue(services.contains(rsaService))

    assertEquals(
        true,
        call { promise -> keychain.resetGenericPasswordForOptions(aesOptions, promise) })

    val afterReset =
        readableArrayStrings(call { promise -> keychain.getAllGenericPasswordServices(promise) }
            as ReadableArray)
    assertFalse(afterReset.contains(aesService))
    assertTrue(afterReset.contains(rsaService))

    assertEquals(
        true,
        call { promise -> keychain.resetGenericPasswordForOptions(rsaOptions, promise) })
  }

  @Test
  fun unknownStorageFallsBackToCurrentNonBiometricCipherAndStoresMarker() {
    val service = serviceName("unknown-storage")
    val unknownStorage = "UnknownCipherStorage"
    val options = options(service, storage = unknownStorage)

    val setResult =
        call { promise ->
          keychain.setGenericPasswordForOptions(
              options,
              "fallback-user",
              "fallback-secret",
              promise)
        } as WritableMap
    assertEquals(service, setResult.getString("service"))
    assertEquals(KeychainModule.KnownCiphers.AES, setResult.getString("storage"))

    val debugState =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertTrue(debugState.getBoolean("hasEntry"))
    assertTrue(debugState.getBoolean("hasCipherStorageMarker"))
    assertFalse(debugState.getBoolean("isCipherStorageMarkerMissing"))
    assertEquals(
        KeychainModule.KnownCiphers.AES,
        debugState.getString("storedCipherStorageName"))
    assertEquals(
        "stored-marker",
        debugState.getString("cipherStorageResolutionStrategy"))

    val credentials =
        call { promise -> keychain.getGenericPasswordForOptions(options(service), promise) }
            as WritableMap
    assertEquals("fallback-user", credentials.getString("username"))
    assertEquals("fallback-secret", credentials.getString("password"))
    assertEquals(KeychainModule.KnownCiphers.AES, credentials.getString("storage"))
  }

  @Test
  fun explicitSecureHardwareLevelRoundTripsWithAesStorage() {
    val service = serviceName("secure-hardware")
    val options =
        options(
            service,
            storage = KeychainModule.KnownCiphers.AES,
            securityLevel = SecurityLevel.SECURE_HARDWARE.name)

    val setResult =
        call { promise ->
          keychain.setGenericPasswordForOptions(
              options,
              "hardware-user",
              "hardware-secret",
              promise)
        } as WritableMap
    assertEquals(KeychainModule.KnownCiphers.AES, setResult.getString("storage"))

    val credentials =
        call { promise -> keychain.getGenericPasswordForOptions(options, promise) } as WritableMap
    assertEquals("hardware-user", credentials.getString("username"))
    assertEquals("hardware-secret", credentials.getString("password"))
    assertEquals(KeychainModule.KnownCiphers.AES, credentials.getString("storage"))
  }

  @Test
  fun internetCredentialsUseServerAliasAndResetCleanly() {
    val server = serviceName("internet")
    val options = options(server, storage = KeychainModule.KnownCiphers.AES)

    val setResult =
        call { promise ->
          keychain.setInternetCredentialsForServer(
              server,
              "server-user",
              "server-secret",
              options,
              promise)
        } as WritableMap
    assertEquals(server, setResult.getString("service"))
    assertEquals(KeychainModule.KnownCiphers.AES, setResult.getString("storage"))

    val hasResult =
        call { promise -> keychain.hasInternetCredentialsForServer(server, promise) }
            as WritableMap
    assertEquals(server, hasResult.getString("service"))
    assertEquals(KeychainModule.KnownCiphers.AES, hasResult.getString("storage"))

    val credentials =
        call { promise ->
          keychain.getInternetCredentialsForServer(server, options(server), promise)
        } as WritableMap
    assertEquals(server, credentials.getString("service"))
    assertEquals("server-user", credentials.getString("username"))
    assertEquals("server-secret", credentials.getString("password"))

    assertEquals(
        true,
        call { promise -> keychain.resetInternetCredentialsForServer(server, promise) })
    assertEquals(
        false,
        call { promise -> keychain.getInternetCredentialsForServer(server, options(server), promise) })
  }

  @Test
  fun missingInternetCredentialsReturnFalseForHasAndGet() {
    val server = serviceName("missing-internet")

    assertEquals(
        false,
        call { promise -> keychain.hasInternetCredentialsForServer(server, promise) })
    assertEquals(
        false,
        call { promise ->
          keychain.getInternetCredentialsForServer(server, options(server), promise)
        })
    assertEquals(
        true,
        call { promise -> keychain.resetInternetCredentialsForServer(server, promise) })
  }

  @Test
  fun emptyCredentialsRejectAndDoNotCreateEntries() {
    val service = serviceName("empty")
    val options = options(service, storage = KeychainModule.KnownCiphers.AES)

    val emptyUsername =
        callRejected { promise ->
          keychain.setGenericPasswordForOptions(options, "", "secret", promise)
        }
    assertTrue(emptyUsername.message?.contains("E_EMPTY_PARAMETERS") == true)

    val emptyPassword =
        callRejected { promise ->
          keychain.setGenericPasswordForOptions(options, "user", "", promise)
        }
    assertTrue(emptyPassword.message?.contains("E_EMPTY_PARAMETERS") == true)

    val debugState =
        call { promise -> keychain.debugGetGenericPasswordStateForOptions(options, promise) }
            as WritableMap
    assertFalse(debugState.getBoolean("hasEntry"))
  }

  @Test
  fun securityLevelAndBiometryQueriesResolveOnDevice() {
    val service = serviceName("security")
    val securityLevel = call { promise -> keychain.getSecurityLevel(options(service), promise) }
    assertTrue(
        listOf(
            SecurityLevel.ANY.name,
            SecurityLevel.SECURE_SOFTWARE.name,
            SecurityLevel.SECURE_HARDWARE.name)
            .contains(securityLevel))

    val supportedBiometry = call { promise -> keychain.getSupportedBiometryType(promise) }
    assertTrue(
        supportedBiometry == null ||
            supportedBiometry == KeychainModule.FINGERPRINT_SUPPORTED_NAME ||
            supportedBiometry == KeychainModule.FACE_SUPPORTED_NAME ||
            supportedBiometry == KeychainModule.IRIS_SUPPORTED_NAME)
  }

  private fun serviceName(label: String): String {
    val service = "instrumentation.rabby.keychain9.$label.${System.nanoTime()}"
    servicesToCleanUp.add(service)
    return service
  }

  private fun options(
      service: String,
      storage: String? = null,
      androidAllowAuthenticatedSessionReuse: Boolean? = null,
      securityLevel: String? = null
  ): WritableMap {
    val authenticationPrompt =
        Arguments.createMap().apply {
          putString("title", "Rabby keychain instrumentation")
          putString("cancel", "Cancel")
        }

    return Arguments.createMap().apply {
      putString("service", service)
      putMap("authenticationPrompt", authenticationPrompt)
      if (storage != null) {
        putString("storage", storage)
      }
      if (androidAllowAuthenticatedSessionReuse != null) {
        putBoolean(
            "androidAllowAuthenticatedSessionReuse",
            androidAllowAuthenticatedSessionReuse)
      }
      if (securityLevel != null) {
        putString("securityLevel", securityLevel)
      }
    }
  }

  private fun call(action: (Promise) -> Unit): Any? {
    val promise = AwaitablePromise()
    action(promise)
    return promise.await()
  }

  private fun callRejected(action: (Promise) -> Unit): Throwable {
    val promise = AwaitablePromise()
    action(promise)
    return promise.awaitRejected()
  }

  private fun readableArrayStrings(array: ReadableArray): List<String> {
    return (0 until array.size()).mapNotNull { index -> array.getString(index) }
  }

  private class AwaitablePromise : Promise {
    private val latch = CountDownLatch(1)
    private var resolvedValue: Any? = null
    private var rejected: Throwable? = null

    fun await(): Any? {
      assertTrue(
          "Timed out waiting for keychain promise",
          latch.await(10, TimeUnit.SECONDS))
      rejected?.let { throw AssertionError("Keychain promise rejected", it) }
      return resolvedValue
    }

    fun awaitRejected(): Throwable {
      assertTrue(
          "Timed out waiting for keychain promise rejection",
          latch.await(10, TimeUnit.SECONDS))
      return rejected ?: throw AssertionError("Expected keychain promise to reject")
    }

    override fun resolve(value: Any?) {
      resolvedValue = value
      latch.countDown()
    }

    override fun reject(code: String, message: String?) {
      reject(AssertionError("$code: $message"))
    }

    override fun reject(code: String, throwable: Throwable?) {
      reject(AssertionError(code, throwable))
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      reject(AssertionError("$code: $message", throwable))
    }

    override fun reject(throwable: Throwable) {
      rejected = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      reject(throwable)
    }

    override fun reject(code: String, userInfo: WritableMap) {
      reject(code, "Rejected with userInfo")
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      reject(code, throwable)
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      reject(code, message)
    }

    override fun reject(
        code: String?,
        message: String?,
        throwable: Throwable?,
        userInfo: WritableMap?
    ) {
      reject(AssertionError("${code ?: "E_UNKNOWN"}: $message", throwable))
    }

    override fun reject(message: String) {
      reject(AssertionError(message))
    }
  }
}
