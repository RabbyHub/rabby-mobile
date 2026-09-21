"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AUTH_PROMPT_DEFAULTS = void 0;
exports.normalizeOptions = normalizeOptions;
exports.normalizeServerOption = normalizeServerOption;
exports.normalizeServiceOption = normalizeServiceOption;
exports.normalizeStorageOptions = normalizeStorageOptions;
var _enums = require("./enums.js");
// Default authentication prompt options
const AUTH_PROMPT_DEFAULTS = exports.AUTH_PROMPT_DEFAULTS = {
  title: 'Authenticate to retrieve secret',
  cancel: 'Cancel'
};
function normalizeStorageOptions(options) {
  if ('storage' in options && options.storage === _enums.STORAGE_TYPE.AES) {
    console.warn(`You passed 'AES' as a storage option to one of the react-native-keychain functions.
            This way of passing storage is deprecated and will be removed in a future major.`);
    return {
      ...options,
      storage: _enums.STORAGE_TYPE.AES_CBC
    };
  }
  return options;
}
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
function normalizeServerOption(serverOrOptions) {
  if (typeof serverOrOptions === 'string') {
    console.warn(`You passed a server string as an argument to one of the react-native-keychain functions.
            This way of passing service is deprecated and will be removed in a future major.
            Please update your code to use { service: ${JSON.stringify(serverOrOptions)} }`);
    return {
      server: serverOrOptions
    };
  }
  return serverOrOptions || {};
}
function normalizeOptions(serviceOrOptions) {
  const options = normalizeStorageOptions({
    authenticationPrompt: AUTH_PROMPT_DEFAULTS,
    ...normalizeServiceOption(serviceOrOptions)
  });
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
//# sourceMappingURL=normalizeOptions.js.map