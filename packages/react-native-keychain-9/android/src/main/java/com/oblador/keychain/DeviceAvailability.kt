@file:Suppress("DEPRECATION")

package com.rabbywallet.keychain9

import android.Manifest
import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.core.hardware.fingerprint.FingerprintManagerCompat

/**
 * @see
 *   [Biometric hardware](https://stackoverflow.com/questions/50968732/determine-if-biometric-hardware-is-present-and-the-user-has-enrolled-biometrics)
 */
object DeviceAvailability {
  data class StrongBiometricAvailability(
    val androidXStatusCode: Int,
    val androidXWeakStatusCode: Int,
    val permissionsGranted: Boolean,
    val legacyFingerprintHardwareDetected: Boolean,
    val legacyFingerprintEnrolled: Boolean,
    val api29FingerprintFallbackEligible: Boolean,
    val available: Boolean,
    val source: String
  )

  fun isStrongBiometricAuthAvailable(context: Context): Boolean {
    return getStrongBiometricAuthAvailability(context).available
  }

  fun getStrongBiometricAuthAvailability(context: Context): StrongBiometricAvailability {
    val androidXStatusCode =
      runCatching {
          BiometricManager.from(context)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        }
        .getOrDefault(BiometricManager.BIOMETRIC_STATUS_UNKNOWN)
    val androidXWeakStatusCode =
      if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
        runCatching {
            BiometricManager.from(context)
              .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
          }
          .getOrDefault(BiometricManager.BIOMETRIC_STATUS_UNKNOWN)
      } else {
        BiometricManager.BIOMETRIC_STATUS_UNKNOWN
      }
    val permissionsGranted = runCatching { isPermissionsGranted(context) }.getOrDefault(false)
    val hasFingerprintFeature = isFingerprintAuthAvailable(context)
    val shouldProbeLegacyFingerprint =
      Build.VERSION.SDK_INT == Build.VERSION_CODES.Q &&
        permissionsGranted &&
        hasFingerprintFeature &&
        androidXStatusCode != BiometricManager.BIOMETRIC_SUCCESS
    val fingerprintManager =
      if (shouldProbeLegacyFingerprint) FingerprintManagerCompat.from(context) else null
    val legacyFingerprintHardwareDetected =
      fingerprintManager?.let { runCatching { it.isHardwareDetected }.getOrDefault(false) } ?: false
    val legacyFingerprintEnrolled =
      fingerprintManager?.let { runCatching { it.hasEnrolledFingerprints() }.getOrDefault(false) }
        ?: false
    val api29FingerprintFallbackEligible =
      shouldUseApi29FingerprintFallback(
        apiLevel = Build.VERSION.SDK_INT,
        androidXStrongStatusCode = androidXStatusCode,
        androidXWeakStatusCode = androidXWeakStatusCode,
        permissionsGranted = permissionsGranted,
        hasFingerprintFeature = hasFingerprintFeature,
        legacyFingerprintHardwareDetected = legacyFingerprintHardwareDetected,
        legacyFingerprintEnrolled = legacyFingerprintEnrolled
      )
    val androidXStrongAvailable = androidXStatusCode == BiometricManager.BIOMETRIC_SUCCESS

    return StrongBiometricAvailability(
      androidXStatusCode = androidXStatusCode,
      androidXWeakStatusCode = androidXWeakStatusCode,
      permissionsGranted = permissionsGranted,
      legacyFingerprintHardwareDetected = legacyFingerprintHardwareDetected,
      legacyFingerprintEnrolled = legacyFingerprintEnrolled,
      api29FingerprintFallbackEligible = api29FingerprintFallbackEligible,
      available = androidXStrongAvailable || api29FingerprintFallbackEligible,
      source =
        when {
          androidXStrongAvailable -> STRONG_BIOMETRIC_SOURCE_ANDROIDX
          api29FingerprintFallbackEligible -> STRONG_BIOMETRIC_SOURCE_FINGERPRINT_API_29
          else -> STRONG_BIOMETRIC_SOURCE_UNAVAILABLE
        }
    )
  }

  internal fun shouldUseApi29FingerprintFallback(
    apiLevel: Int,
    androidXStrongStatusCode: Int,
    androidXWeakStatusCode: Int,
    permissionsGranted: Boolean,
    hasFingerprintFeature: Boolean,
    legacyFingerprintHardwareDetected: Boolean,
    legacyFingerprintEnrolled: Boolean
  ): Boolean {
    if (
      apiLevel != Build.VERSION_CODES.Q ||
        androidXStrongStatusCode == BiometricManager.BIOMETRIC_SUCCESS ||
        !permissionsGranted ||
        !hasFingerprintFeature
    ) {
      return false
    }

    val legacyFingerprintConfirmed =
      legacyFingerprintHardwareDetected && legacyFingerprintEnrolled
    val androidXFoundBiometricButCouldNotClassifyStrength =
      androidXStrongStatusCode == BiometricManager.BIOMETRIC_STATUS_UNKNOWN &&
        androidXWeakStatusCode == BiometricManager.BIOMETRIC_SUCCESS

    return when (androidXStrongStatusCode) {
      BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
      BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED,
      BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
      BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
      BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
        legacyFingerprintConfirmed || androidXFoundBiometricButCouldNotClassifyStrength
      else -> false
    }
  }

  fun isBiometricAuthAvailable(context: Context, allowWeakBiometrics: Boolean): Boolean {
    val authenticators =
        if (allowWeakBiometrics) {
          BiometricManager.Authenticators.BIOMETRIC_WEAK
        } else {
          BiometricManager.Authenticators.BIOMETRIC_STRONG
        }
    return BiometricManager.from(context).canAuthenticate(authenticators) ==
        BiometricManager.BIOMETRIC_SUCCESS
  }

  fun isFingerprintAuthAvailable(context: Context): Boolean {
    return context.packageManager.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT)
  }

  fun isFaceAuthAvailable(context: Context): Boolean {
    return context.packageManager.hasSystemFeature(PackageManager.FEATURE_FACE)
  }

  fun isIrisAuthAvailable(context: Context): Boolean {
    return context.packageManager.hasSystemFeature(PackageManager.FEATURE_IRIS)
  }

  /** Check is permissions granted for biometric things. */
  @JvmStatic
  fun isPermissionsGranted(context: Context): Boolean {
    // before api23 no permissions for biometric, no hardware == no permissions
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return false
    }
    val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (!km.isKeyguardSecure) return false

    // api28+
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      context.checkSelfPermission(Manifest.permission.USE_BIOMETRIC) ==
          PackageManager.PERMISSION_GRANTED
    } else
        context.checkSelfPermission(Manifest.permission.USE_FINGERPRINT) ==
            PackageManager.PERMISSION_GRANTED

    // before api28
  }

  const val STRONG_BIOMETRIC_SOURCE_ANDROIDX = "androidx-strong"
  const val STRONG_BIOMETRIC_SOURCE_FINGERPRINT_API_29 = "fingerprint-api29-fallback"
  const val STRONG_BIOMETRIC_SOURCE_UNAVAILABLE = "unavailable"
}
