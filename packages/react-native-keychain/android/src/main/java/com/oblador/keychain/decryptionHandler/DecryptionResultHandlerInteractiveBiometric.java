package com.rabbywallet.keychain.decryptionHandler;

import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;

import com.facebook.react.bridge.AssertionException;
import com.facebook.react.bridge.ReactApplicationContext;
import com.rabbywallet.keychain.DeviceAvailability;
import com.rabbywallet.keychain.cipherStorage.CipherStorage;
import com.rabbywallet.keychain.cipherStorage.CipherStorage.DecryptionResult;
import com.rabbywallet.keychain.cipherStorage.CipherStorage.DecryptionContext;
import com.rabbywallet.keychain.cipherStorage.CipherStorageBase;
import com.rabbywallet.keychain.exceptions.CryptoFailedException;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

public class DecryptionResultHandlerInteractiveBiometric extends BiometricPrompt.AuthenticationCallback implements DecryptionResultHandler {
  protected static final String PERF_TAG = "RabbyKeychainPerf";
  private static final AtomicLong TRACE_SEQUENCE = new AtomicLong();

  protected CipherStorage.DecryptionResult result;
  protected Throwable error;
  protected final ReactApplicationContext reactContext;
  protected final CipherStorageBase storage;
  protected final Executor executor = Executors.newSingleThreadExecutor();
  protected CipherStorage.DecryptionContext context;
  protected BiometricPrompt.PromptInfo promptInfo;
  protected final long traceId = TRACE_SEQUENCE.incrementAndGet();
  protected final long traceStartedAtMs = SystemClock.elapsedRealtime();

  /** Logging tag. */
  protected static final String LOG_TAG = DecryptionResultHandlerInteractiveBiometric.class.getSimpleName();

  public DecryptionResultHandlerInteractiveBiometric(
                                                     @NonNull ReactApplicationContext reactContext,
                                                     @NonNull final CipherStorage storage,
                                                     @NonNull final BiometricPrompt.PromptInfo promptInfo) {
    this.reactContext = reactContext;
    this.storage = (CipherStorageBase) storage;
    this.promptInfo = promptInfo;
    trace("handler_created");
  }

  protected void trace(@NonNull final String event) {
    Log.i(
      PERF_TAG,
      "bio#" + traceId +
        " +" + (SystemClock.elapsedRealtime() - traceStartedAtMs) + "ms " +
        event +
        " storage=" + storage.getCipherStorageName()
    );
  }

  @Override
  public void askAccessPermissions(@NonNull final DecryptionContext context) {
    this.context = context;
    trace("ask_access_permissions");

    if (!DeviceAvailability.isPermissionsGranted(reactContext)) {
      final CryptoFailedException failure = new CryptoFailedException(
        "Could not start fingerprint Authentication. No permissions granted.");

      trace("permissions_denied");
      onDecrypt(null, failure);
    } else {
      startAuthentication();
    }
  }

  @Override
  public void onDecrypt(@Nullable final DecryptionResult decryptionResult, @Nullable final Throwable error) {
    this.result = decryptionResult;
    this.error = error;
    trace("on_decrypt result=" + (decryptionResult != null) +
      " error=" + (error == null ? "none" : error.getClass().getSimpleName()));

    synchronized (this) {
      notifyAll();
    }
  }

  @Nullable
  @Override
  public CipherStorage.DecryptionResult getResult() {
    return result;
  }

  @Nullable
  @Override
  public Throwable getError() {
    return error;
  }

  /** Called when an unrecoverable error has been encountered and the operation is complete. */
  @Override
  public void onAuthenticationError(final int errorCode, @NonNull final CharSequence errString) {
    trace("on_authentication_error code=" + errorCode + " msg=" + errString);
    final CryptoFailedException error = new CryptoFailedException("code: " + errorCode + ", msg: " + errString);

    onDecrypt(null, error);
  }

  /** Called when a biometric is presented but not recognized. */
  @Override
  public void onAuthenticationFailed() {
    trace("on_authentication_failed");
  }

  /** Called when a biometric is recognized. */
  @Override
  public void onAuthenticationSucceeded(@NonNull final BiometricPrompt.AuthenticationResult result) {
    trace("on_authentication_succeeded");
    try {
      if (null == context) throw new NullPointerException("Decrypt context is not assigned yet.");

      final CipherStorage.DecryptionResult decrypted = new CipherStorage.DecryptionResult(
        storage.decryptBytes(context.key, context.username),
        storage.decryptBytes(context.key, context.password)
      );

      onDecrypt(decrypted, null);
    } catch (Throwable fail) {
      trace("on_authentication_succeeded_decrypt_failed error=" + fail.getClass().getSimpleName());
      onDecrypt(null, fail);
    }
  }

  /** trigger interactive authentication. */
  public void startAuthentication() {
    FragmentActivity activity = getCurrentActivity();

    // code can be executed only from MAIN thread
    if (Thread.currentThread() != Looper.getMainLooper().getThread()) {
      trace("start_authentication_post_to_main");
      activity.runOnUiThread(this::startAuthentication);
      waitResult();
      return;
    }

    trace("start_authentication_on_main");
    authenticateWithPrompt(activity);
  }

  protected FragmentActivity getCurrentActivity() {
    final FragmentActivity activity = (FragmentActivity) reactContext.getCurrentActivity();
    if (null == activity) throw new NullPointerException("Not assigned current activity");

    return activity;
  }

  protected BiometricPrompt authenticateWithPrompt(@NonNull final FragmentActivity activity) {
    trace("authenticate_with_prompt_start");
    final BiometricPrompt prompt = new BiometricPrompt(activity, executor, this);
    prompt.authenticate(this.promptInfo);
    trace("authenticate_with_prompt_called");

    return prompt;
  }

  /** Block current NON-main thread and wait for user authentication results. */
  @Override
  public void waitResult() {
    if (Thread.currentThread() == Looper.getMainLooper().getThread())
      throw new AssertionException("method should not be executed from MAIN thread");

    trace("wait_result_blocking_thread");

    try {
      synchronized (this) {
        wait();
      }
    } catch (InterruptedException ignored) {
      /* shutdown sequence */
    }

    trace("wait_result_unblocked_thread");
  }
}
