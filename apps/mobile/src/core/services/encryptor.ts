import { NativeModules, Platform } from 'react-native'
import Aes from 'react-native-aes-crypto';
// TODO: we don't know what is the difference between Aes and AesForked, use Aes first,
// but we should test AesForked later.

// import { NativeModules } from 'react-native';
// const Aes = NativeModules.Aes;
// const AesForked = NativeModules.AesForked;

const algorithms = 'aes-256-cbc';
const algorithms_pbkdf2 = 'sha256';

export default class RNEncryptor {
  key = null;

  private async _generateSalt(byteCount = 32) {
    const saltStr = await Aes.randomKey(byteCount);

    return btoa(saltStr);
  }

  private _generateKey = (password: string, salt: string, lib?: string) =>
    Aes.pbkdf2(password, salt, 5000, 256, algorithms_pbkdf2);

  _keyFromPassword = (password: string, salt: string, lib?: string) =>
    this._generateKey(password, salt, lib);

  _encryptWithKey = async (text: string, keyBase64: string) => {
    const iv = await Aes.randomKey(16);
    return Aes.encrypt(text, keyBase64, iv, algorithms).then((cipher: any) => ({
      cipher,
      iv,
      salt: '',
    }));
  };

  _decryptWithKey = (encryptedData: any, key: string, lib?: string) =>
    Aes.decrypt(encryptedData.cipher, key, encryptedData.iv, algorithms);

  /**
   * Encrypts a JS object using a password (and AES encryption with native libraries)
   *
   * @returns - Promise resolving to stringified data
   */
  encrypt = async (password: string, object: any) => {
    const salt = await this._generateSalt(16);
    const key = await this._keyFromPassword(password, salt);
    const result = await this._encryptWithKey(JSON.stringify(object), key);
    result.salt = salt;

    return JSON.stringify(result);
  };

  /**
   * Decrypts an encrypted JS object (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} password - Password used for decryption
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  decrypt = async (password: string, encryptedString: string) => {
    const encryptedData = JSON.parse(encryptedString);
    const key = await this._keyFromPassword(password, encryptedData.salt);
    const data = await this._decryptWithKey(encryptedData, key);
    return JSON.parse(data);
  };
}
