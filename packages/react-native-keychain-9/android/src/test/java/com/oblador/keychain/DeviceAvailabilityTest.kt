package com.rabbywallet.keychain9

import androidx.biometric.BiometricManager
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceAvailabilityTest {
  @Test
  fun allowsApi29LegacyFingerprintWhenAndroidXStrongCannotResolveIt() {
    assertTrue(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = true
      )
    )
  }

  @Test
  fun allowsApi29LegacyFingerprintWhenAndroidXReportsNoEnrollment() {
    assertTrue(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = true
      )
    )
  }

  @Test
  fun weakBiometricSignalDoesNotBecomeConfirmedFingerprintFallback() {
    assertFalse(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = false,
        legacyFingerprintEnrolled = false
      )
    )
    assertTrue(
      DeviceAvailability.shouldAllowApi29FingerprintPromptProbe(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = false,
        legacyFingerprintEnrolled = false
      )
    )
  }

  @Test
  fun hardwareUnavailableNeverActivatesFingerprintFallbackOrProbe() {
    assertFalse(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = true
      )
    )
    assertFalse(
      DeviceAvailability.shouldAllowApi29FingerprintPromptProbe(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = false,
        legacyFingerprintEnrolled = false
      )
    )
  }

  @Test
  fun doesNotOverrideSecurityUpdateRequired() {
    assertFalse(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = 15,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = true
      )
    )
  }

  @Test
  fun doesNotApplyFallbackOutsideApi29() {
    assertFalse(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 30,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = true
      )
    )
  }

  @Test
  fun requiresEveryLegacyFingerprintSignal() {
    assertFalse(
      DeviceAvailability.shouldUseApi29FingerprintFallback(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        permissionsGranted = true,
        hasFingerprintFeature = true,
        legacyFingerprintHardwareDetected = true,
        legacyFingerprintEnrolled = false
      )
    )
  }

  @Test
  fun weakBiometricHeuristicStillRequiresFingerprintHardwareFeature() {
    assertFalse(
      DeviceAvailability.shouldAllowApi29FingerprintPromptProbe(
        apiLevel = 29,
        androidXStrongStatusCode = BiometricManager.BIOMETRIC_STATUS_UNKNOWN,
        androidXWeakStatusCode = BiometricManager.BIOMETRIC_SUCCESS,
        permissionsGranted = true,
        hasFingerprintFeature = false,
        legacyFingerprintHardwareDetected = false,
        legacyFingerprintEnrolled = false
      )
    )
  }
}
