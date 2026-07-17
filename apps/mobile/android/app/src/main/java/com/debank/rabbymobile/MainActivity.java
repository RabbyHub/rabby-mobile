package com.debank.rabbymobile;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.zoontek.rnbootsplash.RNBootSplash;

public class MainActivity extends ReactActivity {
  private static final String FRAME_RATE_TAG = "RabbyFrameRate";
  private static final float MIN_HIGH_REFRESH_RATE = 90.0f;
  private boolean initialWindowInsetsReapplied = false;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    RabbyStartupTrace.beginSection("MainActivity.onCreate");
    try {
      RabbyStartupTrace.beginSection("MainActivity.bootSplash.init");
      try {
        RNBootSplash.init(this, R.style.BootTheme);
        applyInitialEdgeToEdgeWindowPolicy();
      } finally {
        RabbyStartupTrace.endSection();
      }

      // super.onCreate(savedInstanceState);
      // fix: https://sentry.io/organizations/debank/issues/?groupStatsPeriod=24h&page=0&project=6312337&query=is%3Aunresolved&referrer=issue-list&statsPeriod=14d
      // https://github.com/software-mansion/react-native-screens#android
      RabbyStartupTrace.beginSection("MainActivity.super.onCreate");
      try {
        super.onCreate(null);
      } finally {
        RabbyStartupTrace.endSection();
      }
      requestHighRefreshRate("onCreate");
    } finally {
      RabbyStartupTrace.endSection();
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    requestHighRefreshRate("onResume");
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      if (!initialWindowInsetsReapplied) {
        applyInitialEdgeToEdgeWindowPolicy();
        initialWindowInsetsReapplied = true;
      }
      requestHighRefreshRate("onWindowFocusChanged");
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  @Override
  protected String getMainComponentName() {
    return "RabbyMobile";
  }

  /**
   * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
   * DefaultReactActivityDelegate} which allows you to easily enable New Architecture with a single
   * boolean flag {@link fabricEnabled}.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    RabbyStartupTrace.instant("MainActivity.createReactActivityDelegate");
    return new DefaultReactActivityDelegate(this, getMainComponentName(), DefaultNewArchitectureEntryPoint.getFabricEnabled()) {
      @Override
      protected Bundle getLaunchOptions() {
        RabbyStartupTrace.instant("MainActivity.getLaunchOptions");
        Bundle initialProperties = new Bundle();
        if (BuildConfig.rabbitCode != null) {
          initialProperties.putString("rabbitCode", BuildConfig.rabbitCode);
        } else {
          initialProperties.putString("rabbitCode", "RABBY_MOBILE_CODE_DEV");
        }
        return initialProperties;
      }
    };
  }

  @SuppressWarnings("deprecation")
  private void applyInitialEdgeToEdgeWindowPolicy() {
    Window window = getWindow();
    View decorView = window.getDecorView();

    // Keep the launch and app themes on the same inset policy before native screens lay out.
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(Color.TRANSPARENT);

    boolean lightSystemBars = getResources().getBoolean(R.bool.windowLightStatusBar);
    WindowInsetsControllerCompat insetsController =
      WindowCompat.getInsetsController(window, decorView);
    insetsController.setAppearanceLightStatusBars(lightSystemBars);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      window.setNavigationBarColor(Color.TRANSPARENT);
      insetsController.setAppearanceLightNavigationBars(lightSystemBars);
    } else {
      window.setNavigationBarColor(Color.argb(0x80, 0x1b, 0x1b, 0x1b));
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      WindowManager.LayoutParams attributes = window.getAttributes();
      attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
        ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      window.setAttributes(attributes);
    }

    ViewCompat.requestApplyInsets(decorView);
  }

  private void requestHighRefreshRate(String reason) {
    Window window = getWindow();
    if (window == null) {
      return;
    }

    View decorView = window.getDecorView();
    Display display = decorView != null ? decorView.getDisplay() : null;
    if (display == null) {
      display = getWindowManager().getDefaultDisplay();
    }

    float targetRefreshRate = pickBestRefreshRate(display);
    if (targetRefreshRate < MIN_HIGH_REFRESH_RATE) {
      logFrameRate("skip high refresh request: reason=" + reason
        + ", target=" + targetRefreshRate);
      return;
    }

    WindowManager.LayoutParams attributes = window.getAttributes();
    if (attributes != null && attributes.preferredRefreshRate != targetRefreshRate) {
      attributes.preferredRefreshRate = targetRefreshRate;
      window.setAttributes(attributes);
    }

    if (Build.VERSION.SDK_INT >= 35 && decorView != null) {
      decorView.setRequestedFrameRate(targetRefreshRate);
      window.setFrameRateBoostOnTouchEnabled(true);
    }

    float currentRefreshRate = display != null ? display.getRefreshRate() : 0.0f;
    float requestedRefreshRate = Build.VERSION.SDK_INT >= 35 && decorView != null
      ? decorView.getRequestedFrameRate()
      : 0.0f;
    logFrameRate("request high refresh: reason=" + reason
      + ", target=" + targetRefreshRate
      + ", current=" + currentRefreshRate
      + ", requested=" + requestedRefreshRate);
  }

  private float pickBestRefreshRate(Display display) {
    if (display == null) {
      return 0.0f;
    }

    float bestRefreshRate = display.getRefreshRate();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Display.Mode[] modes = display.getSupportedModes();
      if (modes != null) {
        for (Display.Mode mode : modes) {
          if (mode != null && mode.getRefreshRate() > bestRefreshRate) {
            bestRefreshRate = mode.getRefreshRate();
          }
        }
      }
    }

    return bestRefreshRate;
  }

  private void logFrameRate(String message) {
    if (BuildConfig.DEBUG || !"com.debank.rabbymobile".equals(BuildConfig.APPLICATION_ID)) {
      Log.i(FRAME_RATE_TAG, message);
    }
  }
}
