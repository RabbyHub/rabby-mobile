const crypto = require('crypto');

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: crypto.webcrypto || {
      getRandomValues: array => crypto.randomFillSync(array),
    },
  });
}

if (!globalThis.crypto.CryptoKey) {
  Object.defineProperty(globalThis.crypto, 'CryptoKey', {
    configurable: true,
    value: globalThis.CryptoKey || function CryptoKey() {},
  });
}
