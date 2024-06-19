// import { NativeModules, Platform } from 'react-native';
import Aes from 'react-native-aes-crypto';
// TODO: we don't know what is the difference between Aes and AesForked, use Aes first,
// but we should test AesForked later.

// import { NativeModules } from 'react-native';
// const Aes = NativeModules.Aes;
// const AesForked = NativeModules.AesForked;

import type { EncryptorAdapter } from '@rabby-wallet/service-keyring';

const algorithms = 'aes-256-cbc';
const algorithms_pbkdf2 = 'sha256';

async function _generateSalt(byteCount = 32) {
  const saltStr = await Aes.randomKey(byteCount);

  return btoa(saltStr);
}

async function _generateKey(password: string, salt: string, lib?: string) {
  return Aes.pbkdf2(password, salt, 5000, 256, algorithms_pbkdf2);
}

async function _keyFromPassword(password: string, salt: string, lib?: string) {
  return _generateKey(password, salt, lib);
}

async function _encryptWithKey(text: string, keyBase64: string) {
  const iv = await Aes.randomKey(16);
  return Aes.encrypt(text, keyBase64, iv, algorithms).then((cipher: any) => ({
    cipher,
    iv,
    salt: '',
  }));
}

async function _decryptWithKey(encryptedData: any, key: string, lib?: string) {
  return Aes.decrypt(encryptedData.cipher, key, encryptedData.iv, algorithms);
}

export default class RNEncryptor implements EncryptorAdapter {
  key = null;

  /**
   * Encrypts a JS object using a password (and AES encryption with native libraries)
   *
   * @returns - Promise resolving to stringified data
   */
  async encrypt(password: string, object: any) {
    const salt = await _generateSalt(16);
    const key = await _keyFromPassword(password, salt);
    const result = await _encryptWithKey(JSON.stringify(object), key);
    result.salt = salt;

    return JSON.stringify(result);
  }

  /**
   * Decrypts an encrypted JS object (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} password - Password used for decryption
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  async decrypt(password: string, encryptedString: string) {
    const encryptedData = JSON.parse(encryptedString);
    const key = await _keyFromPassword(password, encryptedData.salt);
    const data = await _decryptWithKey(encryptedData, key);

    return JSON.parse(data);
  }
}
