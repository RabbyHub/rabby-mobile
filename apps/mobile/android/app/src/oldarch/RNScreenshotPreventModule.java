package com.debank.rabbymobile;

import android.app.Activity;
import android.content.ContentResolver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.util.Log;

import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.RelativeLayout;
import android.widget.ImageView;

// For Android 14+ screen capture detection
import android.Manifest;
import android.content.pm.PackageManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.BaseActivityEventListener;
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

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

public class RNScreenshotPreventModule extends EventEmitterPackageSpec /* implements LifecycleEventListener */ {
  public static final String NAME = "RNScreenshotPrevent";
  private static final String TAG = "ScreenshotPrevent";
  private final ReactApplicationContext reactContext;
  private RelativeLayout overlayLayout;
  private boolean isListening = false;

  /* Callback for Android 14+, using Object to avoid compilation errors */
  private Activity.ScreenCaptureCallback screenCaptureCallback;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private final java.util.Set<Long> recentScreenshotIds = new java.util.HashSet<>();
  private static final long DEBOUNCE_TIMEOUT_MS = 10000L;

  // For DETECT_SCREEN_CAPTURE permission
  private boolean hasDetectScreenCapturePermission = false;

  public RNScreenshotPreventModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;

    // Check for DETECT_SCREEN_CAPTURE permission
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      hasDetectScreenCapturePermission = reactContext.checkSelfPermission(Manifest.permission.DETECT_SCREEN_CAPTURE)
          == PackageManager.PERMISSION_GRANTED;
    }

    // reactContext.addLifecycleEventListener(this);
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
  public void startScreenCaptureDetection(Promise promise) {
    Activity currentActivity = getCurrentActivity();
    if (currentActivity == null) {
      promise.reject("NO_ACTIVITY", "Activity is not available");
      return;
    }

    // Android 14+ screen capture detection using DETECT_SCREEN_CAPTURE permission
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || !hasDetectScreenCapturePermission) {
      promise.reject("UNSUPPORTED", "Screen capture detection is not supported");
      return ;
    }

    startScreenCaptureGte14(promise);
  }

  @RequiresApi(api = Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  private void startScreenCaptureGte14(Promise promise) {
    Activity currentActivity = getCurrentActivity();
    if (currentActivity == null) {
      promise.reject("NO_ACTIVITY", "Activity is not available");
      return;
    }

    // Send event indicating screen capture detection has started
    WritableMap params = Arguments.createMap();
    params.putBoolean("enabled", true);
    RabbyUtils.rnCtxSendEvent(reactContext, "screenCaptureDetectionChanged", params);

    try {
        screenCaptureCallback = new Activity.ScreenCaptureCallback() {
          @Override
          public void onScreenCaptured() {
            Log.d(TAG, "Screen capture detected via new API!");
            takeViewScreenshotAndNotify();
          }
        };

        // Register callback
        currentActivity.registerScreenCaptureCallback(mainHandler::post, screenCaptureCallback);
        Log.d(TAG, "Registered ScreenCaptureCallback (Android 14+)");

        promise.resolve(null);
    }catch (SecurityException e) {
        Log.e(TAG, "Permission denied for ScreenCaptureCallback", e);
        promise.reject("UNSUPPORTED", "Screen capture detection is not supported");
    } catch (Exception e) {
        Log.e(TAG, "Failed to register ScreenCaptureCallback (Reflection error)", e);
        promise.reject("UNSUPPORTED", "Screen capture detection is not supported");
    }
  }

  private void takeViewScreenshotAndNotify() {
    ContentResolver contentResolver = this.reactContext.getContentResolver();
    WritableMap params = Arguments.createMap();
    params.putBoolean("captured", false);

    Activity activity = getCurrentActivity();
    if (activity != null) {
        ViewGroup contentContainer = activity.findViewById(android.R.id.content);
        String base64 = ScreenshotUtils.captureViewToPngBase64(contentContainer.getRootView());

        params.putBoolean("captured", true);
        params.putString("imageBase64", base64);
        params.putString("imageType", "png");
    }

    RabbyUtils.rnCtxSendEvent(this.reactContext, "userDidTakeScreenshot", params);
  }

  @ReactMethod
  public void stopScreenCaptureDetection(Promise promise) {
    // Clean up Android 14+ screen capture detection
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || !hasDetectScreenCapturePermission) {
      promise.reject("UNSUPPORTED", "Screen capture detection is not supported");
      return;
    }

    stopScreenCaptureGte14(promise);
  }

  @RequiresApi(api = Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  private void stopScreenCaptureGte14(Promise promise) {
    Activity currentActivity = getCurrentActivity();
    if (currentActivity == null) {
      promise.reject("NO_ACTIVITY", "Activity is not available");
      return;
    }

    try {
        currentActivity.unregisterScreenCaptureCallback(screenCaptureCallback);

        WritableMap params = Arguments.createMap();
        params.putBoolean("false", true);
        RabbyUtils.rnCtxSendEvent(reactContext, "screenCaptureDetectionChanged", params);
      } catch (Exception e) {
          Log.i(TAG, "Failed to unregister ScreenCaptureCallback (Reflection)", e);
      }
      screenCaptureCallback = null;
      promise.resolve(null);
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
    } else {
      promise.resolve(null);
    }

    this.togglePreventScreenshot(true);
  }

  @ReactMethod
  public void iosUnprotectFromScreenRecording(final Promise promise) {
    if (BuildConfig.DEBUG) {
      promise.reject("Not implemented for Android");
    } else {
      promise.resolve(null);
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

  // @Override
  // public void onHostResume() {
  //   // Activity currentActivity = this.reactContext.getCurrentActivity();
  //   // WritableMap params = Arguments.createMap();
  //   // params.putString("state", "resume");
  //   // RabbyUtils.rnCtxSendEvent(reactContext, "androidOnLifeCycleChanged", params);
  //   // if (currentActivity != null && overlayLayout != null) {
  //   //   currentActivity.runOnUiThread(new Runnable() {
  //   //     @Override
  //   //     public void run() {
  //   //       if (overlayLayout != null) {
  //   //         activityGetRootView(currentActivity).removeView(overlayLayout);
  //   //         overlayLayout = null;
  //   //       }
  //   //     }
  //   //   });
  //   // }
  // }

  // @Override
  // public void onHostPause() {
  //   // Activity currentActivity = this.reactContext.getCurrentActivity();
  //   // WritableMap params = Arguments.createMap();
  //   // params.putString("state", "pause");
  //   // RabbyUtils.rnCtxSendEvent(reactContext, "androidOnLifeCycleChanged", params);

  //   // if (currentActivity != null && overlayLayout == null) {
  //   //  currentActivity.runOnUiThread(new Runnable() {
  //   //     @Override
  //   //     public void run() {
  //   //       ViewGroup rootView = activityGetRootView(currentActivity);
  //   //       createOverlay(currentActivity, "");

  //   //       RelativeLayout.LayoutParams layoutParams = new RelativeLayout.LayoutParams(
  //   //       ViewGroup.LayoutParams.MATCH_PARENT,
  //   //       ViewGroup.LayoutParams.MATCH_PARENT);
  //   //       rootView.addView(overlayLayout, layoutParams);
  //   //     }
  //   //  });
  //   // }
  // }

  // @Override
  // public void onHostDestroy() {
  //   // Cleanup if needed
  // }

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
