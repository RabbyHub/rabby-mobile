package com.debank.rabbymobile;

import androidx.annotation.NonNull;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.RelativeLayout;
import android.widget.ImageView;

import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.uimanager.events.EventDispatcherListener;

import java.io.IOException;
import java.net.URL;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@ReactModule(name = RNScreenshotPreventImpl.NAME)
public class RNScreenshotPreventModule extends NativeRNScreenshotPreventSpec {
//  private static final String NAME = RNScreenshotPreventImpl.NAME;
  private final ReactApplicationContext reactContext;

  public RNScreenshotPreventModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    // reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return RNScreenshotPreventImpl.NAME;
  }

  @Override
  public void addListener(String eventType) {};

  @Override
  public void removeListeners(double count) {};

  @Override
  public void togglePreventScreenshot(boolean isPrevent) {
    if (this.reactContext.hasCurrentActivity()) {
      final Activity activity = this.reactContext.getCurrentActivity();
      RNScreenshotPreventImpl.togglePreventScreenshot(activity, isPrevent, this.reactContext);
    }
  }

  @Override
  public void iosProtectFromScreenRecording(final Promise promise) {
    if (BuildConfig.DEBUG) {
      promise.reject("Not implemented for Android");
    } else {
      promise.resolve(null);
    }

    this.togglePreventScreenshot(true);
  }

  @Override
  public void iosUnprotectFromScreenRecording(final Promise promise) {
    if (BuildConfig.DEBUG) {
      promise.reject("Not implemented for Android");
    } else {
      promise.resolve(null);
    }

    this.togglePreventScreenshot(false);
  }

  @Override
  public boolean iosIsBeingCaptured() {
    if (BuildConfig.DEBUG) {
      // promise.reject("Not implemented for Android");
      System.out.println("Not implemented for Android");
    }
    return false;
  }
}
