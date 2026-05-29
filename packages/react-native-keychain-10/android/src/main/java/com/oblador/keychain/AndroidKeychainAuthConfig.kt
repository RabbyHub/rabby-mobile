package com.rabbywallet.keychain10

import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager

data class AndroidKeychainAuthConfig(
  val profile: String,
  val promptAuthenticators: Int?,
  val keyAuthenticators: Int?
) {
  companion object {
    const val PROFILE_BIOMETRIC_STRONG = "biometric-strong-v1"
    const val PROFILE_DEVICE_CREDENTIAL = "device-credential-v1"
    const val PROFILE_BIOMETRIC_OR_DEVICE_CREDENTIAL = "biometric-or-device-credential-v1"

    fun biometricStrong(): AndroidKeychainAuthConfig {
      return AndroidKeychainAuthConfig(
        PROFILE_BIOMETRIC_STRONG,
        BiometricManager.Authenticators.BIOMETRIC_STRONG,
        KeyProperties.AUTH_BIOMETRIC_STRONG
      )
    }

    fun deviceCredential(): AndroidKeychainAuthConfig {
      return AndroidKeychainAuthConfig(
        PROFILE_DEVICE_CREDENTIAL,
        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
        KeyProperties.AUTH_DEVICE_CREDENTIAL
      )
    }

    fun biometricOrDeviceCredential(): AndroidKeychainAuthConfig {
      return AndroidKeychainAuthConfig(
        PROFILE_BIOMETRIC_OR_DEVICE_CREDENTIAL,
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
          BiometricManager.Authenticators.DEVICE_CREDENTIAL,
        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
      )
    }

    fun fromProfile(profile: String?): AndroidKeychainAuthConfig? {
      return when (profile) {
        PROFILE_BIOMETRIC_STRONG -> biometricStrong()
        PROFILE_DEVICE_CREDENTIAL -> deviceCredential()
        PROFILE_BIOMETRIC_OR_DEVICE_CREDENTIAL -> biometricOrDeviceCredential()
        else -> null
      }
    }

    fun fromAccessControl(
      usePasscode: Boolean,
      useBiometry: Boolean
    ): AndroidKeychainAuthConfig {
      return when {
        usePasscode && useBiometry -> biometricOrDeviceCredential()
        usePasscode -> deviceCredential()
        else -> biometricStrong()
      }
    }
  }
}
