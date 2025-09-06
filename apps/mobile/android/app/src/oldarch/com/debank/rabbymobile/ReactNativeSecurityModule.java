package com.debank.rabbymobile;

import android.app.Activity;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;
import android.view.WindowManager;

@ReactModule(name = ReactNativeSecurityImpl.NAME)
public class ReactNativeSecurityModule extends SimplePackageSpec {
  ReactNativeSecurityModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  @NonNull
  public String getName() {
    return ReactNativeSecurityImpl.NAME;
  }

  @ReactMethod
  public void blockScreen() {
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      ReactNativeSecurityImpl.blockScreen(activity);
    }
  }

  @ReactMethod
  public void unblockScreen() {
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      ReactNativeSecurityImpl.unblockScreen(activity);
    }
  }
}
