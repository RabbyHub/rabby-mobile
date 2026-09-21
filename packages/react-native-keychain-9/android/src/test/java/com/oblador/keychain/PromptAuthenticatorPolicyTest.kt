package com.rabbywallet.keychain9

import androidx.biometric.BiometricManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptAuthenticatorPolicyTest {
  @Test
  fun api29PasscodeCapableAccessPreservesDeviceCredentialFallback() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = true,
        usePasscode = true,
        api29FingerprintFallbackEligible = true
      )

    assertEquals(null, policy.allowedAuthenticators)
    assertFalse(policy.usesApi29FingerprintFallback)
    assertTrue(policy.usesApi29LegacyDeviceCredentialApi)
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
    assertFalse(policy.usesApi29LegacyDeviceCredentialApi)
  }

  @Test
  fun api29WithoutConfirmedFingerprintStillPreservesDeviceCredentialFallback() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = true,
        usePasscode = true,
        api29FingerprintFallbackEligible = false
      )

    assertEquals(null, policy.allowedAuthenticators)
    assertFalse(policy.usesApi29FingerprintFallback)
    assertTrue(policy.usesApi29LegacyDeviceCredentialApi)
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

    assertEquals(null, policy.allowedAuthenticators)
    assertFalse(policy.usesApi29FingerprintFallback)
    assertTrue(policy.usesApi29LegacyDeviceCredentialApi)
  }

  @Test
  fun api29BiometricOnlyAccessKeepsStrongPrompt() {
    val policy =
      PromptAuthenticatorPolicyResolver.resolve(
        apiLevel = 29,
        useBiometry = true,
        usePasscode = false,
        api29FingerprintFallbackEligible = true
      )

    assertEquals(
      BiometricManager.Authenticators.BIOMETRIC_STRONG,
      policy.allowedAuthenticators
    )
    assertTrue(policy.usesApi29FingerprintFallback)
    assertFalse(policy.usesApi29LegacyDeviceCredentialApi)
  }
}
