package com.debank.rabbymobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.modules.i18nmanager.I18nUtil

import com.facebook.react.modules.network.OkHttpClientProvider;


class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(ReactNativeSecurityPackage())
              add(RNScreenshotPreventPackage())
              add(RNTimeChangedPackage())
              add(RNHelpersPackage())
              add(RNFileHelpersPackage())
              add(RNThreadPackage(WorkerAssetStorePackage()))
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    RabbyStartupTrace.beginSection("Application.onCreate")
    try {
      super.onCreate()
      RabbyStartupTrace.instant("Application.super.onCreate")
      KeyringStorageStartupDiagnostics.capture(this)
      // Rabby currently ships LTR locales only. Set this before React resolves layout direction.
      I18nUtil.instance.allowRTL(this, false)
      I18nUtil.instance.forceRTL(this, false)
      RabbyStartupTrace.beginSection("Application.loadReactNative")
      try {
        loadReactNative(this)
      } finally {
        RabbyStartupTrace.endSection()
      }
      OkHttpClientProvider.setOkHttpClientFactory(UserAgentClientFactory())
      RabbyStartupTrace.instant("Application.okhttpFactoryReady")
    } finally {
      RabbyStartupTrace.endSection()
    }
  }
}
