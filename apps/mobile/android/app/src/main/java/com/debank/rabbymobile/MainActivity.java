package com.debank.rabbymobile;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import org.devio.rn.splashscreen.SplashScreen;

public class MainActivity extends ReactActivity {
  private static final String FRAME_RATE_TAG = "RabbyFrameRate";
  private static final float MIN_HIGH_REFRESH_RATE = 90.0f;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    // SplashScreen.show(this);
    // https://github.com/crazycodeboy/react-native-splash-screen/blob/b47197626804a742b8569cad50d5e0ed92fc765c/android/src/main/java/org/devio/rn/splashscreen/SplashScreen.java#L25
    SplashScreen.show(this, R.style.SplashScreenTheme, true);

    // super.onCreate(savedInstanceState);
    // fix: https://sentry.io/organizations/debank/issues/?groupStatsPeriod=24h&page=0&project=6312337&query=is%3Aunresolved&referrer=issue-list&statsPeriod=14d
    // https://github.com/software-mansion/react-native-screens#android
    super.onCreate(null);
    requestHighRefreshRate("onCreate");
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
    return new DefaultReactActivityDelegate(this, getMainComponentName(), DefaultNewArchitectureEntryPoint.getFabricEnabled()) {
      @Override
      protected Bundle getLaunchOptions() {
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
