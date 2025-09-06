package com.debank.rabbymobile;

import android.app.Activity;
import android.view.WindowManager;
import android.view.ViewGroup;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RelativeLayout;
import android.widget.ImageView;
import android.graphics.Color;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.debank.rabbymobile.RabbyUtils;

import java.io.IOException;
import java.net.URL;

public class RNScreenshotPreventImpl {
  public static final String NAME = "RNScreenshotPrevent";

  private static RelativeLayout overlayLayout;

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

  public static void togglePreventScreenshot(Activity activity, boolean isPrevent, ReactContext reactContext) {
    WritableMap params = Arguments.createMap();
    params.putBoolean("isPrevent", isPrevent);
    params.putBoolean("success", false);

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

    RabbyUtils.rnCtxSendEvent(reactContext, "preventScreenshotChanged", params);
  }

  private static void createOverlay(Activity activity, String imagePath) {
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

  private static Bitmap decodeImageUrl(String imagePath) {
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
