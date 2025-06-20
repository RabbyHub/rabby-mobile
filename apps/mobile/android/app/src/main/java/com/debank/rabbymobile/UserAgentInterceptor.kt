package com.debank.rabbymobile;
import com.debank.rabbymobile.BuildConfig;

import android.os.Build
import android.util.Log
import okhttp3.Interceptor
import okhttp3.OkHttp
import okhttp3.Request
import okhttp3.Response

import java.io.IOException;
import java.util.Locale;

// https://stackoverflow.com/questions/35119761/react-native-okhttp-on-android-set-user-agent/66163168#66163168
class UserAgentInterceptor : Interceptor {
  val userAgent: String
  private var vmString: String? = null

  init {
    val versionName = BuildConfig.VERSION_NAME
    val versionCode = BuildConfig.VERSION_CODE

    val osVersion = Build.VERSION.RELEASE
    val deviceName = Build.MODEL

    userAgent = String.format(
      "RabbyMobile/%s okhttp/%s %s (Android %s; %s; %s %s; %s)",
      versionName, /* versionName */
      // versionCode, /* versionCode */
      OkHttp.VERSION,
      getVmString(),
      Build.VERSION.RELEASE, /* osVersion */
      Build.MODEL, /* deviceName */
      Build.BRAND, /* deviceBrand */
      Build.DEVICE, /* deviceType */
      Locale.getDefault().language
    )

    Log.d("UserAgentInterceptor", userAgent)
  }

  private fun getVmString(): String {
    if (vmString == null || vmString!!.trim().isEmpty()) {
      try {
        vmString = String.format("%s/%s", System.getProperty("java.vm.name"), System.getProperty("java.vm.version"))
      } catch (e: Exception) {
        Log.e("UserAgentInterceptor", "Error getting vmString", e)
        vmString = ""
      }
    }

    return vmString!!
  }

  private fun getIsArtInUse(): Boolean {
    val vmVersion = System.getProperty("java.vm.version")
    return vmVersion != null && vmVersion.startsWith("2")
  }

  @Throws(IOException::class)
  override fun intercept(chain: Interceptor.Chain): Response {
    val originalRequest = chain.request()

    val requestWithUserAgent = originalRequest.newBuilder()
      .removeHeader("User-Agent")
      .addHeader("User-Agent", userAgent)
      .build()

    return chain.proceed(requestWithUserAgent)
  }
}