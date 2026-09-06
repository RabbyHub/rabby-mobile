package com.rabbywallet.keychain9

import androidx.biometric.BiometricManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptAuthenticatorPolicyTest {
  @Test
  fun api29FingerprintFallbackUsesStrongBiometricWithoutUnsupportedCredentialCombination() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = true,
        usePasscode = true,
        api29FingerprintFallbackEligible = true
      )

    assertEquals(
      BiometricManager.Authenticators.BIOMETRIC_STRONG,
      policy.allowedAuthenticators
    )
    assertTrue(policy.usesApi29FingerprintFallback)
  }

  @Test
  fun modernAndroidKeepsStrongBiometricAndDeviceCredentialCombination() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 30,
        useBiometry = true,
        usePasscode = true,
        api29FingerprintFallbackEligible = true
      )

    assertEquals(
      BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
      policy.allowedAuthenticators
    )
    assertFalse(policy.usesApi29FingerprintFallback)
  }

  @Test
  fun api29WithoutFingerprintFallbackKeepsExistingAuthenticatorPolicy() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = true,
        usePasscode = true,
        api29FingerprintFallbackEligible = false
      )

    assertEquals(
      BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL,
      policy.allowedAuthenticators
    )
    assertFalse(policy.usesApi29FingerprintFallback)
  }

  @Test
  fun passcodeOnlyDoesNotActivateFingerprintFallback() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = false,
        usePasscode = true,
        api29FingerprintFallbackEligible = true
      )

    assertEquals(
      BiometricManager.Authenticators.DEVICE_CREDENTIAL,
      policy.allowedAuthenticators
    )
    assertFalse(policy.usesApi29FingerprintFallback)
  }
}
