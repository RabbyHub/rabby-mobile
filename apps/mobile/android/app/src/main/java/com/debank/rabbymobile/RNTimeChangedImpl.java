package com.debank.rabbymobile;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.debank.rabbymobile.RabbyUtils;

public class RNTimeChangedImpl {
  public static final String NAME = "RNTimeChanged";

  public static class TimeChangeBroadcastReceiver extends BroadcastReceiver {
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

  public static void exitAppForSecurity() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }
}