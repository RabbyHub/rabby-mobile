package com.rabbymobile;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

import android.os.Bundle; // react-native-splash-screen
import org.devio.rn.splashscreen.SplashScreen;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    // https://github.com/crazycodeboy/react-native-splash-screen/blob/b47197626804a742b8569cad50d5e0ed92fc765c/android/src/main/java/org/devio/rn/splashscreen/SplashScreen.java#L25
    SplashScreen.show(this, R.style.SplashScreenTheme, true);

    // fix: https://sentry.io/organizations/debank/issues/?groupStatsPeriod=24h&page=0&project=6312337&query=is%3Aunresolved&referrer=issue-list&statsPeriod=14d
    // https://github.com/software-mansion/react-native-screens#android
    super.onCreate(null);
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
   * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
   * (aka React 18) with two boolean flags.
   */
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled());
  }
}
