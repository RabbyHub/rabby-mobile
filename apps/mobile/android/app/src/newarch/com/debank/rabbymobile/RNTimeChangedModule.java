package com.debank.rabbymobile;

import android.os.Build;
import androidx.annotation.NonNull;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = RNTimeChangedModule.NAME)
public class RNTimeChangedModule extends NativeRNTimeChangedSpec implements LifecycleEventListener {
  public static final String NAME = "RNTimeChanged";
  private final ReactApplicationContext reactContext;
  private TimeChangeBroadcastReceiver timeChangeReceiver;
  private boolean isTimeChangeReceiverRegistered = false;

  public RNTimeChangedModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @Override
  public void addListener(String eventType) {}

  @Override
  public void removeListeners(double count) {}

  private void emitOnTimeChangedEvent(WritableMap params) {
    if (mEventEmitterCallback != null) {
      emitOnTimeChanged(params);
    }
  }

  private class TimeChangeBroadcastReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
      WritableMap params = Arguments.createMap();
      String action = intent.getAction();
      params.putString("androidAction", action);

      if (Intent.ACTION_TIME_CHANGED.equals(action)) {
        params.putString("reason", "timeSet");
        emitOnTimeChangedEvent(params);
      } else if (Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
        params.putString("reason", "timeZoneChanged");
        emitOnTimeChangedEvent(params);
      }/*  else {
        params.putString("reason", "unknown");
        emitOnTimeChangedEvent(params);
      } */
    }
  }

  @ReactMethod
  @Override
  public void exitAppForSecurity() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }

  @Override
  public void onHostResume() {
    if (isTimeChangeReceiverRegistered) {
      return;
    }

    IntentFilter filter = new IntentFilter();
    filter.addAction(Intent.ACTION_TIME_CHANGED);
    filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);

    timeChangeReceiver = new TimeChangeBroadcastReceiver();

    if (Build.VERSION.SDK_INT >= 34) {
      reactContext.registerReceiver(
        timeChangeReceiver,
        filter,
        Context.RECEIVER_EXPORTED
      );
    } else {
      reactContext.registerReceiver(timeChangeReceiver, filter);
    }
    isTimeChangeReceiverRegistered = true;
  }

  @Override
  public void onHostPause() {
    unregisterTimeChangeReceiver();
  }

  @Override
  public void onHostDestroy() {
    unregisterTimeChangeReceiver();
    reactContext.removeLifecycleEventListener(this);
  }

  private void unregisterTimeChangeReceiver() {
    if (!isTimeChangeReceiverRegistered || timeChangeReceiver == null) {
      return;
    }

    reactContext.unregisterReceiver(timeChangeReceiver);
    isTimeChangeReceiverRegistered = false;
    timeChangeReceiver = null;
  }
}
