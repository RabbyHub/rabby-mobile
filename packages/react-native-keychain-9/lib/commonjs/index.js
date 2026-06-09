"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  setGenericPassword: true,
  getGenericPassword: true,
  hasGenericPassword: true,
  resetGenericPassword: true,
  getAllGenericPasswordServices: true,
  hasInternetCredentials: true,
  setInternetCredentials: true,
  getInternetCredentials: true,
  resetInternetCredentials: true,
  getSupportedBiometryType: true,
  requestSharedWebCredentials: true,
  setSharedWebCredentials: true,
  canImplyAuthentication: true,
  getSecurityLevel: true
};
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
var _enums = require("./enums.js");
Object.keys(_enums).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _enums[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _enums[key];
    }
  });
});
var _normalizeOptions = require("./normalizeOptions.js");
var _types = require("./types.js");
Object.keys(_types).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _types[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _types[key];
    }
  });
});
const {
  RNRabbyKeychainV9Manager
} = _reactNative.NativeModules;

/**
 * Saves the `username` and `password` combination for the given service.
 *
 * @param {string} username - The username or e-mail to be saved.
 * @param {string} password - The password to be saved.
 * @param {SetOptions | string} [serviceOrOptions] - A keychain options object or a service name string. Passing a service name as a string is deprecated.
 *
 * @returns {Promise<false | Result>} Resolves to an object containing `service` and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * await Keychain.setGenericPassword('username', 'password');
 * ```
 */
function setGenericPassword(username, password, serviceOrOptions) {
  const options = (0, _normalizeOptions.normalizeOptions)(serviceOrOptions);
  return RNRabbyKeychainV9Manager.setGenericPasswordForOptions(options, username, password);
}

/**
 * Fetches the `username` and `password` combination for the given service.
 *
 * @param {GetOptions | string} [serviceOrOptions] - A keychain options object or a service name string.
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
  const options = (0, _normalizeOptions.normalizeOptions)(serviceOrOptions);
  return RNRabbyKeychainV9Manager.getGenericPasswordForOptions(options);
}

/**
 * Checks if generic password exists for the given service.
 *
 * @param {BaseOptions | string} [serviceOrOptions] - A keychain options object or a service name string.
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
  const options = (0, _normalizeOptions.normalizeServiceOption)(serviceOrOptions);
  return RNRabbyKeychainV9Manager.hasGenericPasswordForOptions(options);
}

/**
 * Deletes all generic password keychain entries for the given service.
 *
 * @param {BaseOptions | string} [serviceOrOptions] - A keychain options object or a service name string.
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
  const options = (0, _normalizeOptions.normalizeServiceOption)(serviceOrOptions);
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
 * @param {string} serverOrOptions - A keychain options object or a server name string.
 *
 * @returns {Promise<boolean>} Resolves to `true` if internet credentials exist, otherwise `false`.
 *
 * @example
 * ```typescript
 * const hasCredentials = await Keychain.hasInternetCredentials('https://example.com');
 * console.log('Internet credentials exist:', hasCredentials);
 * ```
 */
function hasInternetCredentials(serverOrOptions) {
  const options = (0, _normalizeOptions.normalizeServerOption)(serverOrOptions);
  return RNRabbyKeychainV9Manager.hasInternetCredentialsForOptions(options);
}

/**
 * Saves the internet credentials for the given server.
 *
 * @param {string} server - The server URL.
 * @param {string} username - The username or e-mail to be saved.
 * @param {string} password - The password to be saved.
 * @param {SetOptions} [options] - A keychain options object.
 *
 * @returns {Promise<false | Result>} Resolves to an object containing `service` and `storage` when successful, or `false` on failure.
 *
 * @example
 * ```typescript
 * await Keychain.setInternetCredentials('https://example.com', 'username', 'password');
 * ```
 */
function setInternetCredentials(server, username, password, options) {
  return RNRabbyKeychainV9Manager.setInternetCredentialsForServer(server, username, password, (0, _normalizeOptions.normalizeOptions)(options));
}

/**
 * Fetches the internet credentials for the given server.
 *
 * @param {string} server - The server URL.
 * @param {GetOptions} [options] - A keychain options object.
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
  return RNRabbyKeychainV9Manager.getInternetCredentialsForServer(server, (0, _normalizeOptions.normalizeOptions)(options));
}

/**
 * Deletes all internet password keychain entries for the given server.
 *
 * @param {BaseOptions | string} [serviceOrOptions] - A keychain options object or a service name string.
 *
 * @returns {Promise<void>} Resolves when the operation is completed.
 *
 * @example
 * ```typescript
 * await Keychain.resetInternetCredentials('https://example.com');
 * console.log('Credentials reset for server');
 * ```
 */
function resetInternetCredentials(serverOrOptions) {
  const options = (0, _normalizeOptions.normalizeServerOption)(serverOrOptions);
  return RNRabbyKeychainV9Manager.resetInternetCredentialsForOptions(options);
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
function getSupportedBiometryType(serviceOrOptions) {
  if (!RNRabbyKeychainV9Manager.getSupportedBiometryType) {
    return Promise.resolve(null);
  }
  const options = normalizeOptions(serviceOrOptions);
  if (RNRabbyKeychainV9Manager.getSupportedBiometryTypeForOptions) {
    return RNRabbyKeychainV9Manager.getSupportedBiometryTypeForOptions(options);
  }
  return RNRabbyKeychainV9Manager.getSupportedBiometryType();
}

/**
 * Request shared web credentials.
 *
 * @platform iOS
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
 * Sets shared web credentials.
 *
 * @platform iOS
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
 * Checks if the current device supports the specified authentication policy.
 *
 * @platform iOS
 *
 * @param {AuthenticationTypeOption} [options] - A keychain options object.
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
 * Returns the security level supported by the library on the current device.
 *
 * @platform Android
 *
 * @param {AccessControlOption} [options] - A keychain options object.
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
  SECURITY_LEVEL: _enums.SECURITY_LEVEL,
  ACCESSIBLE: _enums.ACCESSIBLE,
  ACCESS_CONTROL: _enums.ACCESS_CONTROL,
  AUTHENTICATION_TYPE: _enums.AUTHENTICATION_TYPE,
  BIOMETRY_TYPE: _enums.BIOMETRY_TYPE,
  STORAGE_TYPE: _enums.STORAGE_TYPE,
  SECURITY_RULES: _enums.SECURITY_RULES,
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
//# sourceMappingURL=index.js.map