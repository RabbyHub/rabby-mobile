package com.debank.rabbymobile;
import com.debank.rabbymobile.BuildConfig;

import android.os.Build;
import okhttp3.Interceptor;
import okhttp3.OkHttp;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.util.Locale;
import android.util.Log;

// https://stackoverflow.com/questions/35119761/react-native-okhttp-on-android-set-user-agent/66163168#66163168
public class UserAgentInterceptor implements Interceptor {
  public String userAgent;
  public String vmString;

  public UserAgentInterceptor() {
    String versionName = BuildConfig.VERSION_NAME;
    int versionCode = BuildConfig.VERSION_CODE;

    String osVersion = Build.VERSION.RELEASE;
    String deviceName = Build.MODEL;

    this.userAgent = String.format(
        "RabbyMobile/%s okhttp/%s %s (Android %s; %s; %s %s; %s)",
        versionName, /* versionName */
        // versionCode, /* versionCode */
        OkHttp.VERSION,
        this.getVmString(),
        Build.VERSION.RELEASE, /* osVersion */
        Build.MODEL, /* deviceName */
        Build.BRAND /* deviceBrand */,
        Build.DEVICE /* deviceType */,
        Locale.getDefault().getLanguage()
      );

    Log.d("UserAgentInterceptor", this.userAgent);
  }

  private String getVmString() {
    if (this.vmString == null || this.vmString.trim().isEmpty()) {
      try {
        this.vmString = String.format("%s/%s", System.getProperty("java.vm.name"), System.getProperty("java.vm.version"));
      } catch (Exception e) {
        Log.e("UserAgentInterceptor", "Error getting vmString", e);
        this.vmString = "";
      }
    }

    return this.vmString;
  }

  private boolean getIsArtInUse() {
    final String vmVersion = System.getProperty("java.vm.version");
    return vmVersion != null && vmVersion.startsWith("2");
  }

  @Override
  public Response intercept(Interceptor.Chain chain) throws IOException {
    Request originalRequest = chain.request();

    Request requestWithUserAgent = originalRequest.newBuilder()
      .removeHeader("User-Agent")
      .addHeader("User-Agent", userAgent)
      .build();

    return chain.proceed(requestWithUserAgent);
  }
}
