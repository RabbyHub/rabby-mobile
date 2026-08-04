package com.rabbywallet.keychain9.resultHandler

import android.os.Build
import android.util.Log
import androidx.biometric.BiometricPrompt
import com.facebook.react.bridge.ReactApplicationContext
import com.rabbywallet.keychain9.cipherStorage.CipherStorage

// NOTE: the logic for handling OnePlus bug is taken from the following forum post:
// https://forums.oneplus.com/threads/oneplus-7-pro-fingerprint-biometricprompt-does-not-show.1035821/#post-21710422
object ResultHandlerProvider {
  private const val LOG_TAG = "RNKeychainV9PromptHandler"
  private const val ONE_PLUS_BRAND = "oneplus"
  private const val XIAOMI_MANUFACTURER = "xiaomi"
  private const val XIAOMI_14_ULTRA_CN_MODEL = "24031PN0DC"
  private const val XIAOMI_14_ULTRA_DEVICE = "aurora"
  private const val GOOGLE_MANUFACTURER = "google"
  private val GOOGLE_PIXEL_MODELS_WITH_BIOMETRIC_BUG =
    setOf(
      "Pixel 9",
      "Pixel 10 Pro"
    )
  private val ONE_PLUS_MODELS_WITHOUT_BIOMETRIC_BUG =
    arrayOf(
      "A0001", // OnePlus One
      "ONE A2001",
      "ONE A2003",
      "ONE A2005", // OnePlus 2
      "ONE E1001",
      "ONE E1003",
      "ONE E1005", // OnePlus X
      "ONEPLUS A3000",
      "ONEPLUS SM-A3000",
      "ONEPLUS A3003", // OnePlus 3
      "ONEPLUS A3010", // OnePlus 3T
      "ONEPLUS A5000", // OnePlus 5
      "ONEPLUS A5010", // OnePlus 5T
      "ONEPLUS A6000",
      "ONEPLUS A6003" // OnePlus 6
    )

  private fun hasOnePlusBiometricBug(): Boolean {
    return Build.BRAND.equals(ONE_PLUS_BRAND, ignoreCase = true) &&
      !ONE_PLUS_MODELS_WITHOUT_BIOMETRIC_BUG.contains(Build.MODEL)
  }

  private fun hasXiaomi14UltraBiometricPromptBug(): Boolean {
    return Build.MANUFACTURER.equals(XIAOMI_MANUFACTURER, ignoreCase = true) &&
      Build.MODEL == XIAOMI_14_ULTRA_CN_MODEL &&
      Build.DEVICE.equals(XIAOMI_14_ULTRA_DEVICE, ignoreCase = true)
  }

  private fun hasGooglePixelBiometricPromptBug(): Boolean {
    return Build.MANUFACTURER.equals(GOOGLE_MANUFACTURER, ignoreCase = true) &&
      GOOGLE_PIXEL_MODELS_WITH_BIOMETRIC_BUG.contains(Build.MODEL)
  }

  private fun getManualRetryReason(): String? {
    return when {
      hasOnePlusBiometricBug() -> "oneplus"
      hasXiaomi14UltraBiometricPromptBug() -> "xiaomi_14_ultra_aurora"
      hasGooglePixelBiometricPromptBug() -> "google_pixel"
      else -> null
    }
  }

  fun getHandler(
    reactContext: ReactApplicationContext,
    storage: CipherStorage,
    promptInfo: BiometricPrompt.PromptInfo
  ): ResultHandler {
    if (!storage.isBiometrySupported()) {
      Log.i(LOG_TAG, "selected=nonInteractive storage=${storage.javaClass.simpleName}")
      return ResultHandlerNonInteractive()
    }

    val manualRetryReason = getManualRetryReason()
    val shouldUseManualRetry = manualRetryReason != null
    Log.i(
      LOG_TAG,
      "selected=${if (shouldUseManualRetry) "manualRetry" else "interactive"} " +
        "reason=$manualRetryReason brand=${Build.BRAND} " +
        "manufacturer=${Build.MANUFACTURER} model=${Build.MODEL} " +
        "device=${Build.DEVICE} product=${Build.PRODUCT} " +
        "sdk=${Build.VERSION.SDK_INT} storage=${storage.javaClass.simpleName}"
    )

    return if (shouldUseManualRetry) {
      ResultHandlerInteractiveBiometricManualRetry(reactContext, storage, promptInfo)
    } else {
      ResultHandlerInteractiveBiometric(reactContext, storage, promptInfo)
    }
  }
}
