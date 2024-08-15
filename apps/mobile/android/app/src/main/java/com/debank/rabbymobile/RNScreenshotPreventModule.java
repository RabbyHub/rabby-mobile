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

public class RNScreenshotPreventModule extends EventEmitterPackageSpec implements LifecycleEventListener {
  public static final String NAME = "RNScreenshotPrevent";
  private final ReactApplicationContext reactContext;
  private RelativeLayout overlayLayout;

  public RNScreenshotPreventModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    reactContext.addLifecycleEventListener(this);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  private static ViewGroup activityGetRootView(Activity activity) {
    ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
    return rootView;
  }

  private static boolean activityIsSecure(Activity activity) {
    int flags = activity.getWindow().getAttributes().flags;
    return (flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
  }

  private static void activitySetSecure(Activity activity) {
    activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
  }

  private static void activityCancelSecure(Activity activity) {
    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
  }

  @ReactMethod
  public void togglePreventScreenshot(boolean isPrevent) {
    WritableMap params = Arguments.createMap();
    params.putBoolean("isPrevent", isPrevent);
    params.putBoolean("success", false);

    if (this.reactContext.hasCurrentActivity()) {
      final Activity activity = this.reactContext.getCurrentActivity();
      if (activity != null) {
        if (isPrevent) {
          activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
              activitySetSecure(activity);
            }
          });
        } else {
          activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
              activityCancelSecure(activity);
            }
          });
        }
        params.putBoolean("success", true);
      }
    }

    RabbyUtils.rnCtxSendEvent(reactContext, "preventScreenshotChanged", params);
  }

  @ReactMethod
  public void iosProtectFromScreenRecording(final Promise promise) {
    if (BuildConfig.DEBUG) {
      promise.reject("Not implemented for Android");
    }

    this.togglePreventScreenshot(true);
  }

  @ReactMethod
  public void iosUnprotectFromScreenRecording(final Promise promise) {
    if (BuildConfig.DEBUG) {
      promise.reject("Not implemented for Android");
    }

    this.togglePreventScreenshot(false);
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public boolean iosIsBeingCaptured() {
    if (BuildConfig.DEBUG) {
      // promise.reject("Not implemented for Android");
      System.out.println("Not implemented for Android");
    }
    return false;
  }

  private void createOverlay(Activity activity, String imagePath) {
    overlayLayout = new RelativeLayout(activity);
    overlayLayout.setBackgroundColor(Color.parseColor("#7084FF"));

    // Create an ImageView
    ImageView imageView = new ImageView(activity);
    RelativeLayout.LayoutParams imageParams = new RelativeLayout.LayoutParams(
      RelativeLayout.LayoutParams.MATCH_PARENT,
      RelativeLayout.LayoutParams.WRAP_CONTENT);
    imageParams.addRule(RelativeLayout.CENTER_IN_PARENT, RelativeLayout.TRUE);

    imageView.setLayoutParams(imageParams);

    // Set image resource
    Bitmap bitmap = decodeImageUrl(imagePath);

    if (bitmap != null) {
      int imageHeight = (int)(bitmap.getHeight() * ((float) activity.getResources().getDisplayMetrics().widthPixels / bitmap.getWidth()));
      Bitmap scaledBitmap = Bitmap.createScaledBitmap(bitmap, activity.getResources().getDisplayMetrics().widthPixels, imageHeight, true);
      imageView.setImageBitmap(scaledBitmap);
    }

    overlayLayout.addView(imageView);
  }

  @Override
  public void onHostResume() {
    // Activity currentActivity = this.reactContext.getCurrentActivity();
    // WritableMap params = Arguments.createMap();
    // params.putString("state", "resume");
    // RabbyUtils.rnCtxSendEvent(reactContext, "androidOnLifeCycleChanged", params);
    // if (currentActivity != null && overlayLayout != null) {
    //   currentActivity.runOnUiThread(new Runnable() {
    //     @Override
    //     public void run() {
    //       if (overlayLayout != null) {
    //         activityGetRootView(currentActivity).removeView(overlayLayout);
    //         overlayLayout = null;
    //       }
    //     }
    //   });
    // }
  }

  @Override
  public void onHostPause() {
    // Activity currentActivity = this.reactContext.getCurrentActivity();
    // WritableMap params = Arguments.createMap();
    // params.putString("state", "pause");
    // RabbyUtils.rnCtxSendEvent(reactContext, "androidOnLifeCycleChanged", params);

    // if (currentActivity != null && overlayLayout == null) {
    //  currentActivity.runOnUiThread(new Runnable() {
    //     @Override
    //     public void run() {
    //       ViewGroup rootView = activityGetRootView(currentActivity);
    //       createOverlay(currentActivity, "");

    //       RelativeLayout.LayoutParams layoutParams = new RelativeLayout.LayoutParams(
    //       ViewGroup.LayoutParams.MATCH_PARENT,
    //       ViewGroup.LayoutParams.MATCH_PARENT);
    //       rootView.addView(overlayLayout, layoutParams);
    //     }
    //  });
    // }
  }

  @Override
  public void onHostDestroy() {
    // Cleanup if needed
  }

  private Bitmap decodeImageUrl(String imagePath) {
    try {
      URL imageUrl = new URL(imagePath);
      Bitmap bitmap = BitmapFactory.decodeStream(imageUrl.openConnection().getInputStream());
      return bitmap;
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
  }
}
