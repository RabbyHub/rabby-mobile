package com.debank.rabbymobile;

import android.os.Build;
import android.app.Activity;
import androidx.annotation.NonNull;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.module.annotations.ReactModule;
import android.view.WindowManager;

import com.debank.rabbymobile.NativeRNHelpersSpec;

@ReactModule(name = RNHelpersImpl.NAME)
public class RNHelpersModule extends NativeRNHelpersSpec /* implements LifecycleEventListener */ {
  private final ReactApplicationContext reactContext;

  public RNHelpersModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    // reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return RNHelpersImpl.NAME;
  }

  @ReactMethod
  public void forceExitApp() {
    RNHelpersImpl.forceExitApp();
  }

  @ReactMethod
  public void iosExcludeFileFromBackup(String filePath, Promise promise) {
    promise.resolve(null);
  }
}
