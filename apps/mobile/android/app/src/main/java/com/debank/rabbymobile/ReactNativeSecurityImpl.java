package com.debank.rabbymobile;

import android.app.Activity;
import android.view.WindowManager;

public class ReactNativeSecurityImpl {
  public static final String NAME = "ReactNativeSecurity";

  public static void blockScreen(Activity activity) {
    if (activity != null) {
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          activity.getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        }
      });
    }
  }

  public static void unblockScreen(Activity activity) {
    if (activity != null) {
      activity.runOnUiThread(new Runnable() {
        @Override
        public void run() {
          activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
      });
    }
  }
}