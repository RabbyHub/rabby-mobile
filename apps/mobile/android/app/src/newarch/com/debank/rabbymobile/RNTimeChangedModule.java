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

import com.facebook.react.module.annotations.ReactModule;

import android.view.WindowManager;

@ReactModule(name = RNTimeChangedImpl.NAME)
public class RNTimeChangedModule extends NativeRNTimeChangedSpec implements LifecycleEventListener {
  private final ReactApplicationContext reactContext;

  public RNTimeChangedModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return RNTimeChangedImpl.NAME;
  }


  @ReactMethod
  public void exitAppForSecurity() {
    RNTimeChangedImpl.exitAppForSecurity();
  }

  @Override
  public void onHostResume() {
		IntentFilter filter = new IntentFilter();
    filter.addAction(Intent.ACTION_TIME_CHANGED);
    filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);

    RNTimeChangedImpl.TimeChangeBroadcastReceiver tcreceiver = new RNTimeChangedImpl.TimeChangeBroadcastReceiver();
    reactContext.registerReceiver(tcreceiver , filter);

    if (Build.VERSION.SDK_INT >= 34) {
      reactContext.registerReceiver(tcreceiver, filter, Context.RECEIVER_EXPORTED);
    } else {
      reactContext.registerReceiver(tcreceiver, filter);
    }
  }
  @Override
  public void onHostPause() {}
  @Override
  public void onHostDestroy() {
//    reactContext.unregisterReceiver(midnightBroadcastReceiver);
  }
}
