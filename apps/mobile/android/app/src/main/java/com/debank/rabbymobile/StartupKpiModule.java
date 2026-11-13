package com.debank.rabbymobile;

import android.app.Activity;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cold-start KPI: time from native process start to the first user-visible
 * content frame (whichever of the unlock screen and Home renders first).
 *
 * Deliberately not gated behind any diagnostics switch: release and regression
 * packages must both emit it, otherwise a regression package cannot measure
 * its own startup.
 */
public class StartupKpiModule extends ReactContextBaseJavaModule {
  public static final String NAME = "StartupKpi";
  private static final String TAG = "RabbyStartupKpi";
  private final AtomicBoolean reported = new AtomicBoolean(false);

  public StartupKpiModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void markFirstContentFrame(String route) {
    if (!reported.compareAndSet(false, true)) {
      return;
    }
    long now = SystemClock.elapsedRealtime();
    long processStart = Process.getStartElapsedRealtime();
    long nativeMs = now - processStart;
    Log.i(TAG, "first_content_frame native_ms=" + nativeMs + " route=" + route);

    try {
      Activity activity = getCurrentActivity();
      if (activity != null) {
        activity.runOnUiThread(activity::reportFullyDrawn);
      }
    } catch (Throwable ignored) {
      // reportFullyDrawn is best-effort cross-check only.
    }
  }
}
