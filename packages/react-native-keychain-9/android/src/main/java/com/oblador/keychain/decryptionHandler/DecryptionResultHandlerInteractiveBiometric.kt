package com.rabbywallet.keychain9.decryptionHandler

import android.os.Looper
import android.os.SystemClock
import android.security.keystore.UserNotAuthenticatedException
import android.util.Log
import androidx.annotation.NonNull
import androidx.annotation.Nullable
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.AssertionException
import com.facebook.react.bridge.ReactApplicationContext
import com.rabbywallet.keychain9.DeviceAvailability
import com.rabbywallet.keychain9.KeychainModule
import com.rabbywallet.keychain9.RabbyNativeLogger
import com.rabbywallet.keychain9.cipherStorage.CipherStorage
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionContext
import com.rabbywallet.keychain9.cipherStorage.CipherStorage.DecryptionResult
import com.rabbywallet.keychain9.cipherStorage.CipherStorageBase
import com.rabbywallet.keychain9.exceptions.CryptoFailedException
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

open class DecryptionResultHandlerInteractiveBiometric(
    @NonNull protected val reactContext: ReactApplicationContext,
    @NonNull storage: CipherStorage,
    @NonNull protected var promptInfo: BiometricPrompt.PromptInfo
) : BiometricPrompt.AuthenticationCallback(), DecryptionResultHandler {

  // Explicitly declare the visibility and use 'override' to match the interface
  override var result: DecryptionResult? = null
  override var error: Throwable? = null
  protected val storage: CipherStorageBase = storage as CipherStorageBase
  protected val executor: Executor = Executors.newSingleThreadExecutor()
  protected var context: DecryptionContext? = null

  // Synchronization primitives
  private val lock = ReentrantLock()
  private val condition = lock.newCondition()

  /** Logging tag. */
  protected val LOG_TAG = DecryptionResultHandlerInteractiveBiometric::class.java.simpleName
  private val UNLOCK_PERF_TAG = "RabbyUnlockPerf:keychain-native"
  private val AUTH_SUCCESS_DECRYPT_RETRY_DELAY_MS = 120L

  fun traceNativeInfo(event: String, data: Map<String, Any?> = emptyMap()) {
    RabbyNativeLogger.info(
        reactContext, KeychainModule.KEYCHAIN_MODULE, UNLOCK_PERF_TAG, event, data)
  }

  fun traceNativeWarn(
      event: String,
      data: Map<String, Any?> = emptyMap(),
      error: Throwable? = null
  ) {
    RabbyNativeLogger.warn(
        reactContext, KeychainModule.KEYCHAIN_MODULE, UNLOCK_PERF_TAG, event, data, error)
  }

  override fun askAccessPermissions(@NonNull context: DecryptionContext) {
    this.context = context
    traceNativeInfo(
        "ask_access_permissions",
        mapOf("alias" to context.keyAlias, "thread" to Thread.currentThread().name))

    if (!DeviceAvailability.isPermissionsGranted(reactContext)) {
      val failure =
          CryptoFailedException(
              "Could not start fingerprint Authentication. No permissions granted.")
      onDecrypt(null, failure)
    } else {
      startAuthentication()
    }
  }

  override fun onDecrypt(
      @Nullable decryptionResult: DecryptionResult?,
      @Nullable error: Throwable?
  ) {
    lock.withLock {
      this.result = decryptionResult
      this.error = error
      condition.signalAll() // Notify waiting thread
    }
  }

  /** Called when an unrecoverable error has been encountered and the operation is complete. */
  override fun onAuthenticationError(errorCode: Int, @NonNull errString: CharSequence) {
    traceNativeWarn(
        "authentication_error",
        mapOf("code" to errorCode, "message" to errString.toString()))
    val error = CryptoFailedException("code: $errorCode, msg: $errString")
    onDecrypt(null, error)
  }

  override fun onAuthenticationFailed() {
    traceNativeWarn(
        "authentication_failed",
        mapOf("alias" to context?.keyAlias, "thread" to Thread.currentThread().name))
  }

  /** Called when a biometric is recognized. */
  override fun onAuthenticationSucceeded(@NonNull result: BiometricPrompt.AuthenticationResult) {
    try {
      context ?: throw NullPointerException("Decrypt context is not assigned yet.")
      traceNativeInfo(
          "authentication_succeeded",
          mapOf("alias" to context!!.keyAlias, "thread" to Thread.currentThread().name))

      val decrypted = decryptContextWithAuthWindowRetry()

      onDecrypt(decrypted, null)
    } catch (fail: Throwable) {
      traceNativeWarn(
          "authentication_succeeded_decrypt_failed",
          mapOf("error" to fail.javaClass.simpleName, "message" to fail.message),
          fail)
      onDecrypt(null, fail)
    }
  }

  private fun decryptContext(): DecryptionResult {
    context ?: throw NullPointerException("Decrypt context is not assigned yet.")

    return DecryptionResult(
        storage.decryptBytes(context!!.key, context!!.username),
        storage.decryptBytes(context!!.key, context!!.password))
  }

  private fun decryptContextWithAuthWindowRetry(): DecryptionResult {
    try {
      return decryptContext()
    } catch (fail: Throwable) {
      if (!isUserNotAuthenticated(fail)) {
        throw fail
      }

      traceNativeWarn(
          "authentication_succeeded_decrypt_user_not_authenticated_retry",
          mapOf(
              "delayMs" to AUTH_SUCCESS_DECRYPT_RETRY_DELAY_MS,
              "alias" to context?.keyAlias,
              "error" to fail.javaClass.simpleName,
              "message" to fail.message),
          fail)
      SystemClock.sleep(AUTH_SUCCESS_DECRYPT_RETRY_DELAY_MS)

      return try {
        val retryResult = decryptContext()
        traceNativeInfo(
            "authentication_succeeded_decrypt_retry_success",
            mapOf("alias" to context?.keyAlias))
        retryResult
      } catch (retryFail: Throwable) {
        traceNativeWarn(
            "authentication_succeeded_decrypt_retry_failed",
            mapOf(
                "error" to retryFail.javaClass.simpleName,
                "message" to retryFail.message,
                "alias" to context?.keyAlias),
            retryFail)
        throw retryFail
      }
    }
  }

  private fun isUserNotAuthenticated(error: Throwable): Boolean {
    var cursor: Throwable? = error
    while (cursor != null) {
      if (cursor is UserNotAuthenticatedException) {
        return true
      }

      val message = cursor.message
      if (
          message?.contains("User not authenticated", ignoreCase = true) == true ||
              message?.contains("Key user not authenticated", ignoreCase = true) == true) {
        return true
      }
      cursor = cursor.cause
    }

    return false
  }

  /** Trigger interactive authentication. */
  open fun startAuthentication() {
    val activity = getCurrentActivity()

    // Code can be executed only from MAIN thread
    if (Thread.currentThread() != Looper.getMainLooper().thread) {
      traceNativeInfo(
          "start_authentication_post_to_main",
          mapOf("thread" to Thread.currentThread().name))
      activity.runOnUiThread { startAuthentication() }
      waitResult()
      return
    }

    traceNativeInfo(
        "start_authentication_on_main", mapOf("thread" to Thread.currentThread().name))
    authenticateWithPrompt(activity)
  }

  protected fun getCurrentActivity(): FragmentActivity {
    val activity = reactContext.currentActivity as? FragmentActivity
    return activity ?: throw NullPointerException("Not assigned current activity")
  }

  protected fun authenticateWithPrompt(@NonNull activity: FragmentActivity): BiometricPrompt {
    traceNativeInfo(
        "authenticate_with_prompt", mapOf("activity" to activity.javaClass.simpleName))
    val prompt = BiometricPrompt(activity, executor, this)
    prompt.authenticate(this.promptInfo)
    return prompt
  }

  /** Block current NON-main thread and wait for user authentication results. */
  override fun waitResult() {
    if (Thread.currentThread() == Looper.getMainLooper().thread) {
      throw AssertionException("method should not be executed from MAIN thread")
    }

    Log.i(LOG_TAG, "blocking thread. waiting for done UI operation.")

    try {
      lock.withLock {
        condition.await() // Wait for signal
      }
    } catch (ignored: InterruptedException) {
      // Shutdown sequence
    }

    Log.i(LOG_TAG, "unblocking thread.")
  }
}
