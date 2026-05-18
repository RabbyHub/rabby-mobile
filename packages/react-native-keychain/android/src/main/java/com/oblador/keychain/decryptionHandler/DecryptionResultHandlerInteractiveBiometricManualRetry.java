package com.rabbywallet.keychain.decryptionHandler;

import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;

import com.facebook.react.bridge.ReactApplicationContext;
import com.rabbywallet.keychain.cipherStorage.CipherStorage;

public class DecryptionResultHandlerInteractiveBiometricManualRetry extends DecryptionResultHandlerInteractiveBiometric implements DecryptionResultHandler {
  private static final int MAX_MANUAL_RETRY_COUNT = 1;

  private BiometricPrompt presentedPrompt;
  private Boolean didFailBiometric = false;
  private int manualRetryCount = 0;

  public DecryptionResultHandlerInteractiveBiometricManualRetry(@NonNull ReactApplicationContext reactContext,
                                                                @NonNull CipherStorage storage,
                                                                @NonNull BiometricPrompt.PromptInfo promptInfo) {
    super(reactContext, storage, promptInfo);
  }

  /** Manually cancel current (invisible) authentication to clear the fragment. */
  private void cancelPresentedAuthentication() {
    trace("manual_retry_cancel_presented_authentication");
    if (presentedPrompt == null) {
      return;
    }

    try {
      presentedPrompt.cancelAuthentication();
    } catch (Exception e) {
      e.printStackTrace();
    } finally {
      this.presentedPrompt = null;
    }
  }

  /** Called when an unrecoverable error has been encountered and the operation is complete. */
  @Override
  public void onAuthenticationError(final int errorCode, @NonNull final CharSequence errString) {
    if (didFailBiometric) {
      trace("manual_retry_swallow_cancel_error_and_retry code=" + errorCode + " msg=" + errString);
      this.presentedPrompt = null;
      this.didFailBiometric = false;
      retryAuthentication();
      return;
    }

    super.onAuthenticationError(errorCode, errString);
  }

  /** Called when a biometric (e.g. fingerprint, face, etc.) is presented but not recognized as belonging to the user. */
  @Override
  public void onAuthenticationFailed() {
    trace("manual_retry_on_authentication_failed count=" + manualRetryCount);
    if (presentedPrompt != null && manualRetryCount < MAX_MANUAL_RETRY_COUNT) {
      manualRetryCount += 1;
      this.didFailBiometric = true;
      cancelPresentedAuthentication();
      return;
    }

    super.onAuthenticationFailed();
  }

  /** Called when a biometric is recognized. */
  @Override
  public void onAuthenticationSucceeded(@NonNull final BiometricPrompt.AuthenticationResult result) {
    this.presentedPrompt = null;
    this.didFailBiometric = false;
    trace("manual_retry_on_authentication_succeeded count=" + manualRetryCount);

    super.onAuthenticationSucceeded(result);
  }

  /** trigger interactive authentication. */
  @Override
  public void startAuthentication() {
    FragmentActivity activity = getCurrentActivity();

    // code can be executed only from MAIN thread
    if (Thread.currentThread() != Looper.getMainLooper().getThread()) {
      trace("manual_retry_start_authentication_post_to_main");
      activity.runOnUiThread(this::startAuthentication);
      waitResult();
      return;
    }

    trace("manual_retry_start_authentication_on_main");
    this.presentedPrompt = authenticateWithPrompt(activity);
  }

  /** trigger interactive authentication without invoking another waitResult() */
  protected void retryAuthentication() {
    trace("manual_retry_retry_authentication count=" + manualRetryCount);

    FragmentActivity activity = getCurrentActivity();

    if (Thread.currentThread() != Looper.getMainLooper().getThread()) {
      try {
        /*
         * NOTE: Applications should not cancel and authenticate in a short succession
         * Waiting 100ms in a non-UI thread to make sure previous BiometricPrompt is cleared by OS
         */
        Thread.sleep(100);
      } catch (InterruptedException ignored) {
        /* shutdown sequence */
      }

      activity.runOnUiThread(this::retryAuthentication);
      return;
    }

    trace("manual_retry_retry_authentication_on_main");
    this.presentedPrompt = authenticateWithPrompt(activity);
  }
}
