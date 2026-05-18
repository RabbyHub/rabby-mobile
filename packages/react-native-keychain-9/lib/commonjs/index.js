"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.STORAGE_TYPE = exports.SECURITY_RULES = exports.SECURITY_LEVEL = exports.BIOMETRY_TYPE = exports.AUTHENTICATION_TYPE = exports.ACCESS_CONTROL = exports.ACCESSIBLE = void 0;
exports.canImplyAuthentication = canImplyAuthentication;
exports.default = void 0;
exports.getAllGenericPasswordServices = getAllGenericPasswordServices;
exports.getGenericPassword = getGenericPassword;
exports.getInternetCredentials = getInternetCredentials;
exports.getSecurityLevel = getSecurityLevel;
exports.getSupportedBiometryType = getSupportedBiometryType;
exports.hasGenericPassword = hasGenericPassword;
exports.hasInternetCredentials = hasInternetCredentials;
exports.requestSharedWebCredentials = requestSharedWebCredentials;
exports.resetGenericPassword = resetGenericPassword;
exports.resetInternetCredentials = resetInternetCredentials;
exports.setGenericPassword = setGenericPassword;
exports.setInternetCredentials = setInternetCredentials;
exports.setSharedWebCredentials = setSharedWebCredentials;
var _reactNative = require("react-native");
const {
  RNRabbyKeychainV9Manager
} = _reactNative.NativeModules;

/**
 * Enum representing when a keychain item is accessible.
 */
let ACCESSIBLE = exports.ACCESSIBLE = /*#__PURE__*/function (ACCESSIBLE) {
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
let ACCESS_CONTROL = exports.ACCESS_CONTROL = /*#__PURE__*/function (ACCESS_CONTROL) {
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
let AUTHENTICATION_TYPE = exports.AUTHENTICATION_TYPE = /*#__PURE__*/function (AUTHENTICATION_TYPE) {
  AUTHENTICATION_TYPE["DEVICE_PASSCODE_OR_BIOMETRICS"] = "AuthenticationWithBiometricsDevicePasscode";
  AUTHENTICATION_TYPE["BIOMETRICS"] = "AuthenticationWithBiometrics";
  return AUTHENTICATION_TYPE;
}({});
/**
 * Enum representing security levels. (Android only)
 */
let SECURITY_LEVEL = exports.SECURITY_LEVEL = function (SECURITY_LEVEL) {
  SECURITY_LEVEL[SECURITY_LEVEL["SECURE_SOFTWARE"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_SECURE_SOFTWARE] = "SECURE_SOFTWARE";
  SECURITY_LEVEL[SECURITY_LEVEL["SECURE_HARDWARE"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_SECURE_HARDWARE] = "SECURE_HARDWARE";
  SECURITY_LEVEL[SECURITY_LEVEL["ANY"] = RNRabbyKeychainV9Manager && RNRabbyKeychainV9Manager.SECURITY_LEVEL_ANY] = "ANY";
  return SECURITY_LEVEL;
}({});
/**
 * Enum representing types of biometric authentication supported by the device.
 */
let BIOMETRY_TYPE = exports.BIOMETRY_TYPE = /*#__PURE__*/function (BIOMETRY_TYPE) {
  BIOMETRY_TYPE["TOUCH_ID"] = "TouchID";
  BIOMETRY_TYPE["FACE_ID"] = "FaceID";
  BIOMETRY_TYPE["OPTIC_ID"] = "OpticID";
  BIOMETRY_TYPE["FINGERPRINT"] = "Fingerprint";
  BIOMETRY_TYPE["FACE"] = "Face";
  BIOMETRY_TYPE["IRIS"] = "Iris";
  return BIOMETRY_TYPE;
}({});
/**
 * Enum representing storage types. (Android only)
 */
let STORAGE_TYPE = exports.STORAGE_TYPE = /*#__PURE__*/function (STORAGE_TYPE) {
  STORAGE_TYPE["FB"] = "FacebookConceal";
  STORAGE_TYPE["AES"] = "KeystoreAESCBC";
  STORAGE_TYPE["RSA"] = "KeystoreRSAECB";
  STORAGE_TYPE["KC"] = "keychain";
  return STORAGE_TYPE;
}({});
/**
 * Enum representing security rules for storage. (Android only)
 */
let SECURITY_RULES = exports.SECURITY_RULES = /*#__PURE__*/function (SECURITY_RULES) {
  SECURITY_RULES["NONE"] = "none";
  SECURITY_RULES["AUTOMATIC_UPGRADE"] = "automaticUpgradeToMoreSecuredStorage";
  return SECURITY_RULES;
}({});
/**
 * Options for authentication prompt displayed to the user.
 */
/** Base options for keychain functions. */
/**
 * Normalized options including authentication prompt details.
 */
/**
 * Options for keychain functions.
 */
/**
 * Result returned by keychain functions.
 */
/**
 * User credentials returned by keychain functions.
 */
/**
 * Shared web credentials returned by keychain functions (iOS only).
 */
// Default authentication prompt options
const AUTH_PROMPT_DEFAULTS = {
  title: 'Authenticate to retrieve secret',
  cancel: 'Cancel'
};
function normalizeServiceOption(serviceOrOptions) {
  if (typeof serviceOrOptions === 'string') {
    console.warn(`You passed a service string as an argument to one of the react-native-keychain functions.
          This way of passing service is deprecated and will be removed in a future major.
          Please update your code to use { service: ${JSON.stringify(serviceOrOptions)} }`);
    return {
      service: serviceOrOptions
    };
  }
  return serviceOrOptions || {};
}
function normalizeOptions(serviceOrOptions) {
  const options = {
    ...normalizeServiceOption(serviceOrOptions)
  };
  const {
    authenticationPrompt
  } = options;
  if (typeof authenticationPrompt === 'string') {
    console.warn(`You passed a authenticationPrompt string as an argument to one of the react-native-keychain functions.
          This way of passing authenticationPrompt is deprecated and will be removed in a future major.
          Please update your code to use { authenticationPrompt: { title: ${JSON.stringify(authenticationPrompt)} }`);
    options.authenticationPrompt = {
      ...AUTH_PROMPT_DEFAULTS,
      title: authenticationPrompt
    };
  } else {
    options.authenticationPrompt = {
      ...AUTH_PROMPT_DEFAULTS,
      ...authenticationPrompt
    };
  }
  return options;
}

/**
 * Saves the `username` and `password` combination for the given service.
 *
 * @param {string} username - The username or e-mail to be saved.
 * @param {string} password - The password to be saved.
 * @param {Options | string} [serviceOrOptions] - A keychain options object or a service name string. Passing a service name as a string is deprecated.
 *
 * @returns {Promise<false | Result>} Resolves to an object containing `service` and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * await Keychain.setGenericPassword('username', 'password');
 * ```
 */
function setGenericPassword(username, password, serviceOrOptions) {
  const options = normalizeOptions(serviceOrOptions);
  return RNRabbyKeychainV9Manager.setGenericPasswordForOptions(options, username, password);
}

/**
 * Fetches the `username` and `password` combination for the given service.
 *
 * @param {Options | string} [serviceOrOptions] - A keychain options object or a service name string.
 *
 * @returns {Promise<false | UserCredentials>} Resolves to an object containing `service`, `username`, `password`, and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * const credentials = await Keychain.getGenericPassword();
 * if (credentials) {
 *   console.log('Credentials successfully loaded for user ' + credentials.username);
 * } else {
 *   console.log('No credentials stored');
 * }
 * ```
 */
function getGenericPassword(serviceOrOptions) {
  const options = normalizeOptions(serviceOrOptions);
  return RNRabbyKeychainV9Manager.getGenericPasswordForOptions(options);
}

/**
 * Checks if generic password exists for the given service.
 *
 * @param {Options | string} [serviceOrOptions] - A keychain options object or a service name string.
 *
 * @returns {Promise<boolean>} Resolves to `true` if a password exists, otherwise `false`.
 *
 * @example
 * ```typescript
 * const hasPassword = await Keychain.hasGenericPassword();
 * console.log('Password exists:', hasPassword);
 * ```
 */
function hasGenericPassword(serviceOrOptions) {
  const options = normalizeOptions(serviceOrOptions);
  return RNRabbyKeychainV9Manager.hasGenericPasswordForOptions(options);
}

/**
 * Deletes all generic password keychain entries for the given service.
 *
 * @param {Options | string} [serviceOrOptions] - A keychain options object or a service name string.
 *
 * @returns {Promise<boolean>} Resolves to `true` when successful, otherwise `false`.
 *
 * @example
 * ```typescript
 * const success = await Keychain.resetGenericPassword();
 * console.log('Password reset successful:', success);
 * ```
 */
function resetGenericPassword(serviceOrOptions) {
  const options = normalizeOptions(serviceOrOptions);
  return RNRabbyKeychainV9Manager.resetGenericPasswordForOptions(options);
}

/**
 * Gets all service keys used in generic password keychain entries.
 *
 * @returns {Promise<string[]>} Resolves to an array of strings representing service keys.
 *
 * @example
 * ```typescript
 * const services = await Keychain.getAllGenericPasswordServices();
 * console.log('Services:', services);
 * ```
 */
function getAllGenericPasswordServices() {
  return RNRabbyKeychainV9Manager.getAllGenericPasswordServices();
}

/**
 * Checks if internet credentials exist for the given server.
 *
 * @param {string} server - The server URL.
 *
 * @returns {Promise<false | Result>} Resolves to an object containing `service` and `storage` when successful, or `false` if not found.
 *
 * @example
 * ```typescript
 * const hasCredentials = await Keychain.hasInternetCredentials('https://example.com');
 * console.log('Internet credentials exist:', hasCredentials);
 * ```
 */
function hasInternetCredentials(server) {
  return RNRabbyKeychainV9Manager.hasInternetCredentialsForServer(server);
}

/**
 * Saves the internet credentials for the given server.
 *
 * @param {string} server - The server URL.
 * @param {string} username - The username or e-mail to be saved.
 * @param {string} password - The password to be saved.
 * @param {Options} [options] - A keychain options object.
 *
 * @returns {Promise<false | Result>} Resolves to an object containing `service` and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * await Keychain.setInternetCredentials('https://example.com', 'username', 'password');
 * ```
 */
function setInternetCredentials(server, username, password, options) {
  return RNRabbyKeychainV9Manager.setInternetCredentialsForServer(server, username, password, options);
}

/**
 * Fetches the internet credentials for the given server.
 *
 * @param {string} server - The server URL.
 * @param {Options} [options] - A keychain options object.
 *
 * @returns {Promise<false | UserCredentials>} Resolves to an object containing `server`, `username`, `password`, and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * const credentials = await Keychain.getInternetCredentials('https://example.com');
 * if (credentials) {
 *   console.log('Credentials loaded for user ' + credentials.username);
 * } else {
 *   console.log('No credentials stored for server');
 * }
 * ```
 */
function getInternetCredentials(server, options) {
  return RNRabbyKeychainV9Manager.getInternetCredentialsForServer(server, normalizeOptions(options));
}

/**
 * Deletes all internet password keychain entries for the given server.
 *
 * @param {string} server - The server URL.
 *
 * @returns {Promise<void>} Resolves when the operation is completed.
 *
 * @example
 * ```typescript
 * await Keychain.resetInternetCredentials('https://example.com');
 * console.log('Credentials reset for server');
 * ```
 */
function resetInternetCredentials(server) {
  return RNRabbyKeychainV9Manager.resetInternetCredentialsForServer(server);
}

/**
 * Gets the type of biometric authentication supported by the device.
 *
 * @returns {Promise<null | BIOMETRY_TYPE>} Resolves to a `BIOMETRY_TYPE` when supported, otherwise `null`.
 *
 * @example
 * ```typescript
 * const biometryType = await Keychain.getSupportedBiometryType();
 * console.log('Supported Biometry Type:', biometryType);
 * ```
 */
function getSupportedBiometryType() {
  if (!RNRabbyKeychainV9Manager.getSupportedBiometryType) {
    return Promise.resolve(null);
  }
  return RNRabbyKeychainV9Manager.getSupportedBiometryType();
}

/**
 * Request shared web credentials (iOS only).
 *
 * @returns {Promise<false | SharedWebCredentials>} Resolves to an object containing `server`, `username`, and `password` if approved, or `false` if denied.
 *
 * @example
 * ```typescript
 * const credentials = await Keychain.requestSharedWebCredentials();
 * if (credentials) {
 *   console.log('Shared credentials retrieved:', credentials);
 * } else {
 *   console.log('No shared credentials available');
 * }
 * ```
 */
function requestSharedWebCredentials() {
  if (_reactNative.Platform.OS !== 'ios') {
    return Promise.reject(new Error(`requestSharedWebCredentials() is not supported on ${_reactNative.Platform.OS} yet`));
  }
  return RNRabbyKeychainV9Manager.requestSharedWebCredentials();
}

/**
 * Sets shared web credentials (iOS only).
 *
 * @param {string} server - The server URL.
 * @param {string} username - The username or e-mail to be saved.
 * @param {string} [password] - The password to be saved.
 *
 * @returns {Promise<void>} Resolves when the operation is completed.
 *
 * @example
 * ```typescript
 * await Keychain.setSharedWebCredentials('https://example.com', 'username', 'password');
 * console.log('Shared web credentials set');
 * ```
 */
function setSharedWebCredentials(server, username, password) {
  if (_reactNative.Platform.OS !== 'ios') {
    return Promise.reject(new Error(`setSharedWebCredentials() is not supported on ${_reactNative.Platform.OS} yet`));
  }
  return RNRabbyKeychainV9Manager.setSharedWebCredentialsForServer(server, username, password);
}

/**
 * Checks if the current device supports the specified authentication policy (iOS only).
 *
 * @param {Options} [options] - A keychain options object.
 *
 * @returns {Promise<boolean>} Resolves to `true` when supported, otherwise `false`.
 *
 * @example
 * ```typescript
 * const canAuthenticate = await Keychain.canImplyAuthentication();
 * console.log('Can imply authentication:', canAuthenticate);
 * ```
 */
function canImplyAuthentication(options) {
  if (!RNRabbyKeychainV9Manager.canCheckAuthentication) {
    return Promise.resolve(false);
  }
  return RNRabbyKeychainV9Manager.canCheckAuthentication(options);
}

/**
 * Returns the security level supported by the library on the current device (Android only).
 *
 * @param {Options} [options] - A keychain options object.
 *
 * @returns {Promise<null | SECURITY_LEVEL>} Resolves to a `SECURITY_LEVEL` when supported, otherwise `null`.
 *
 * @example
 * ```typescript
 * const securityLevel = await Keychain.getSecurityLevel();
 * console.log('Security Level:', securityLevel);
 * ```
 */
function getSecurityLevel(options) {
  if (!RNRabbyKeychainV9Manager.getSecurityLevel) {
    return Promise.resolve(null);
  }
  return RNRabbyKeychainV9Manager.getSecurityLevel(options);
}

/** @ignore */
var _default = exports.default = {
  SECURITY_LEVEL,
  ACCESSIBLE,
  ACCESS_CONTROL,
  AUTHENTICATION_TYPE,
  BIOMETRY_TYPE,
  STORAGE_TYPE,
  SECURITY_RULES,
  getSecurityLevel,
  canImplyAuthentication,
  getSupportedBiometryType,
  setInternetCredentials,
  getInternetCredentials,
  resetInternetCredentials,
  setGenericPassword,
  getGenericPassword,
  getAllGenericPasswordServices,
  resetGenericPassword,
  requestSharedWebCredentials,
  setSharedWebCredentials
};
