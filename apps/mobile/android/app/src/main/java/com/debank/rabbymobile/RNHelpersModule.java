package com.debank.rabbymobile;

import android.os.Build;
import android.app.Activity;
import androidx.annotation.NonNull;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.LifecycleEventListener;
import android.view.WindowManager;

public class RNHelpersModule extends EventEmitterPackageSpec /* implements LifecycleEventListener */ {
  public static final String NAME = "RNHelpers";
  private final ReactApplicationContext reactContext;

  public RNHelpersModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    // reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void forceExitApp() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }
}
