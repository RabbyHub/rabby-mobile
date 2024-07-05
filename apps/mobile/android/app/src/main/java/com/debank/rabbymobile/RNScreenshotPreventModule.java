package com.debank.rabbymobile;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.RelativeLayout;
import android.widget.ImageView;

import com.facebook.react.modules.core.DeviceEventManagerModule;
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
  private boolean secureFlagWasSet;

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

  private static void setSecure(Activity activity) {
    activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
  }

  private static void cancelSecure(Activity activity) {
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
              RNScreenshotPreventModule.setSecure(activity);
            }
          });
        } else {
          activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
              RNScreenshotPreventModule.cancelSecure(activity);
            }
          });
        }
        params.putBoolean("success", true);
      }
    }

    this.rnSendEvent(reactContext, "preventScreenshotChanged", params);
  }

  @ReactMethod
  public void enableSecureView(String imagePath) {
    if (this.reactContext.hasCurrentActivity()) {
      final Activity activity = this.reactContext.getCurrentActivity();
      if (activity != null) {
        if (overlayLayout == null) {
          createOverlay(activity, imagePath);
        }
        activity.runOnUiThread(new Runnable() {
          @Override
          public void run() {
            RNScreenshotPreventModule.setSecure(activity);
          }
        });
      }
    }
  }

  @ReactMethod
  public void disableSecureView() {
    if (this.reactContext.hasCurrentActivity()) {
      final Activity activity = this.reactContext.getCurrentActivity();
      if (activity != null) {
        activity.runOnUiThread(new Runnable() {
          @Override
          public void run() {
            if (overlayLayout != null) {
              ViewGroup rootView = (ViewGroup) activity.getWindow().getDecorView().getRootView();
              rootView.removeView(overlayLayout);
              overlayLayout = null;
            }
            RNScreenshotPreventModule.cancelSecure(activity);
          }
        });
      }
    }
  }

  @ReactMethod
  public void iosProtectFromScreenRecording() {
    // Noop for Android
  }

  @ReactMethod
  public void iosUnprotectFromScreenRecording() {
    // Noop for Android
  }

  private void createOverlay(Activity activity, String imagePath) {
    overlayLayout = new RelativeLayout(activity);
    overlayLayout.setBackgroundColor(Color.parseColor("#FFFFFF"));

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
    Activity currentActivity = this.reactContext.getCurrentActivity();
    if (currentActivity != null && overlayLayout != null) {
      currentActivity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          ViewGroup rootView = (ViewGroup) currentActivity.getWindow().getDecorView().getRootView();
          rootView.removeView(overlayLayout);
          if (secureFlagWasSet) {
            currentActivity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            secureFlagWasSet = false;
          }
        }
      });
    }
  }

  @Override
  public void onHostPause() {
    Activity currentActivity = this.reactContext.getCurrentActivity();
    if (currentActivity != null && overlayLayout != null) {
      currentActivity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          ViewGroup rootView = (ViewGroup) currentActivity.getWindow().getDecorView().getRootView();
          RelativeLayout.LayoutParams layoutParams = new RelativeLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT);
          rootView.addView(overlayLayout, layoutParams);

          int flags = currentActivity.getWindow().getAttributes().flags;
          if ((flags & WindowManager.LayoutParams.FLAG_SECURE) != 0) {
            currentActivity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            secureFlagWasSet = true;
          } else {
            secureFlagWasSet = false;
          }
        }
      });
    }
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
