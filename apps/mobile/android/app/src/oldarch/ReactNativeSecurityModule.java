package com.debank.rabbymobile;

import android.app.Activity;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import android.view.WindowManager;

public class ReactNativeSecurityModule extends SimplePackageSpec {
  public static final String NAME = "ReactNativeSecurity";

  ReactNativeSecurityModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void blockScreen() {
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
            activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
      });
    }
  }

  @ReactMethod
  public void unblockScreen() {
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
      });
    }
  }

  @ReactMethod
  public void openSecurePreferencesKey(boolean stage, Promise promise) {
    try {
      promise.resolve(SecurePreferenceKey.open(stage));
    } catch (Exception error) {
      promise.reject("E_SECURE_PREFERENCES_KEY", "Secure preference key unavailable");
    }
  }

  @ReactMethod
  public void commitSecurePreferencesKey(String storagePath, Promise promise) {
    try {
      SecurePreferenceKey.commit(storagePath);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("E_SECURE_PREFERENCES_KEY", "Secure preference migration could not be committed");
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public String computeSecurePreferenceHmac(String message) {
    try {
      return SecurePreferenceKey.authenticate(message);
    } catch (Exception error) {
      return "";
    }
  }
}
