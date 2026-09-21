"use strict";

import { NativeModules } from 'react-native';
const {
  RNRabbyKeychainV9Manager
} = NativeModules;

/**
 * Enum representing when a keychain item is accessible.
 */
export let ACCESSIBLE = /*#__PURE__*/function (ACCESSIBLE) {
  ACCESSIBLE["WHEN_UNLOCKED"] = "AccessibleWhenUnlocked";
  ACCESSIBLE["AFTER_FIRST_UNLOCK"] = "AccessibleAfterFirstUnlock";
  ACCESSIBLE["ALWAYS"] = "AccessibleAlways";
  ACCESSIBLE["WHEN_PASSCODE_SET_THIS_DEVICE_ONLY"] = "AccessibleWhenPasscodeSetThisDeviceOnly";
  ACCESSIBLE["WHEN_UNLOCKED_THIS_DEVICE_ONLY"] = "AccessibleWhenUnlockedThisDeviceOnly";
  ACCESSIBLE["AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY"] = "AccessibleAfterFirstUnlockThisDeviceOnly";
  return ACCESSIBLE;
}({});

/**
 * Enum representing access control options.
 */
export let ACCESS_CONTROL = /*#__PURE__*/function (ACCESS_CONTROL) {
  ACCESS_CONTROL["USER_PRESENCE"] = "UserPresence";
  ACCESS_CONTROL["BIOMETRY_ANY"] = "BiometryAny";
  ACCESS_CONTROL["BIOMETRY_CURRENT_SET"] = "BiometryCurrentSet";
  ACCESS_CONTROL["DEVICE_PASSCODE"] = "DevicePasscode";
  ACCESS_CONTROL["APPLICATION_PASSWORD"] = "ApplicationPassword";
  ACCESS_CONTROL["BIOMETRY_ANY_OR_DEVICE_PASSCODE"] = "BiometryAnyOrDevicePasscode";
  ACCESS_CONTROL["BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE"] = "BiometryCurrentSetOrDevicePasscode";
  return ACCESS_CONTROL;
}({});

/**
 * Enum representing authentication types.
 */
export let AUTHENTICATION_TYPE = /*#__PURE__*/function (AUTHENTICATION_TYPE) {
  AUTHENTICATION_TYPE["DEVICE_PASSCODE_OR_BIOMETRICS"] = "AuthenticationWithBiometricsDevicePasscode";
  AUTHENTICATION_TYPE["BIOMETRICS"] = "AuthenticationWithBiometrics";
  return AUTHENTICATION_TYPE;
}({});

/**
 * Enum representing security levels.
 * @platform Android
 */
export let SECURITY_LEVEL = function (SECURITY_LEVEL) {
  SECURITY_LEVEL[SECURITY_LEVEL["SECURE_SOFTWARE"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_SECURE_SOFTWARE] = "SECURE_SOFTWARE";
  SECURITY_LEVEL[SECURITY_LEVEL["SECURE_HARDWARE"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_SECURE_HARDWARE] = "SECURE_HARDWARE";
  SECURITY_LEVEL[SECURITY_LEVEL["ANY"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_ANY] = "ANY";
  return SECURITY_LEVEL;
}({});

/**
 * Enum representing types of biometric authentication supported by the device.
 */
export let BIOMETRY_TYPE = /*#__PURE__*/function (BIOMETRY_TYPE) {
  BIOMETRY_TYPE["TOUCH_ID"] = "TouchID";
  BIOMETRY_TYPE["FACE_ID"] = "FaceID";
  BIOMETRY_TYPE["OPTIC_ID"] = "OpticID";
  BIOMETRY_TYPE["FINGERPRINT"] = "Fingerprint";
  BIOMETRY_TYPE["FACE"] = "Face";
  BIOMETRY_TYPE["IRIS"] = "Iris";
  return BIOMETRY_TYPE;
}({});

/**
 * Enum representing cryptographic storage types for sensitive data.
 *
 * Security Level Categories:
 *
 * 1. High Security (Biometric Authentication Required):
 * - AES_GCM: For sensitive local data (passwords, personal info)
 * - RSA: For asymmetric operations (signatures, key exchange)
 *
 * 2. Medium Security (No Authentication):
 * - AES_GCM_NO_AUTH: For app-level secrets and cached data
 *
 * 3. Legacy/Deprecated:
 * - AES_CBC: Outdated, use AES_GCM_NO_AUTH instead
 * - FB: Archived Facebook Conceal implementation
 *
 * @platform Android
 */
export let STORAGE_TYPE = /*#__PURE__*/function (STORAGE_TYPE) {
  STORAGE_TYPE["FB"] = "FacebookConceal";
  STORAGE_TYPE["AES"] = "KeystoreAES";
  STORAGE_TYPE["AES_CBC"] = "KeystoreAESCBC";
  STORAGE_TYPE["AES_GCM_NO_AUTH"] = "KeystoreAESGCM_NoAuth";
  STORAGE_TYPE["AES_GCM"] = "KeystoreAESGCM";
  STORAGE_TYPE["RSA"] = "KeystoreRSAECB";
  return STORAGE_TYPE;
}({});

/**
 * Enum representing security rules for storage.
 * @platform Android
 */
export let SECURITY_RULES = /*#__PURE__*/function (SECURITY_RULES) {
  SECURITY_RULES["NONE"] = "none";
  SECURITY_RULES["AUTOMATIC_UPGRADE"] = "automaticUpgradeToMoreSecuredStorage";
  return SECURITY_RULES;
}({});
//# sourceMappingURL=enums.js.map