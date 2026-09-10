package com.rabbywallet.keychain9

import android.os.Build
import androidx.biometric.BiometricManager

internal data class PromptAuthenticatorPolicy(
  val allowedAuthenticators: Int?,
  val usesApi29FingerprintFallback: Boolean,
  val usesApi29LegacyDeviceCredentialApi: Boolean
)

internal object PromptAuthenticatorPolicyResolver {
  fun resolve(
    apiLevel: Int,
    useBiometry: Boolean,
    usePasscode: Boolean,
    api29FingerprintFallbackEligible: Boolean
  ): PromptAuthenticatorPolicy {
    val usesApi29LegacyDeviceCredentialApi =
      apiLevel == Build.VERSION_CODES.Q &&
        usePasscode
    val usesApi29FingerprintFallback =
      apiLevel == Build.VERSION_CODES.Q &&
        useBiometry &&
        !usePasscode &&
        api29FingerprintFallbackEligible

    val allowedAuthenticators =
      when {
        usesApi29LegacyDeviceCredentialApi -> null
        useBiometry && usePasscode ->
          BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        usePasscode -> BiometricManager.Authenticators.DEVICE_CREDENTIAL
        else -> BiometricManager.Authenticators.BIOMETRIC_STRONG
      }

    return PromptAuthenticatorPolicy(
      allowedAuthenticators = allowedAuthenticators,
      usesApi29FingerprintFallback = usesApi29FingerprintFallback,
      usesApi29LegacyDeviceCredentialApi = usesApi29LegacyDeviceCredentialApi
    )
  }
}
