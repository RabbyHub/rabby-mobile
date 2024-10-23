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

public class RNTimeChangedModule extends EventEmitterPackageSpec implements LifecycleEventListener {
  public static final String NAME = "RNTimeChanged";
  private final ReactApplicationContext reactContext;

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

  private class TimeChangeBroadcastReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
      WritableMap params = Arguments.createMap();
      String action = intent.getAction();
      params.putString("androidAction", action);

      ReactApplication rnApp = (ReactApplication) context.getApplicationContext();
      ReactContext reactContext = rnApp.getReactNativeHost().getReactInstanceManager()
                                .getCurrentReactContext();

      if (Intent.ACTION_TIME_CHANGED.equals(action)) {
        params.putString("reason", "timeSet");
        RabbyUtils.rnCtxSendEvent(reactContext, "onTimeChanged", params);
      } else if (Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
        params.putString("reason", "timeZoneChanged");
        RabbyUtils.rnCtxSendEvent(reactContext, "onTimeChanged", params);
      }/*  else {
        params.putString("reason", "unknown");
        RabbyUtils.rnCtxSendEvent(reactContext, "onTimeChanged", params);
      } */
    }
  }

  @ReactMethod
  public void exitAppForSecurity() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }

  @Override
  public void onHostResume() {
		IntentFilter filter = new IntentFilter();
    filter.addAction(Intent.ACTION_TIME_CHANGED);
    filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);

    TimeChangeBroadcastReceiver tcreceiver = new TimeChangeBroadcastReceiver();
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
