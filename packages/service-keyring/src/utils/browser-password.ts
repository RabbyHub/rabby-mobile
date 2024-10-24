// this file is a fork from https://github.com/MetaMask/browser-passworder/blob/main/src/index.ts
import { hasProperty, isPlainObject } from '@metamask/utils';

function getWebCrypto() {
  const { webcrypto } = require('crypto') as typeof import('crypto');

  return {
    webcrypto,
    CryptoKey: webcrypto.CryptoKey,
  };
}

export type DetailedEncryptionResult = {
  vault: string;
  exportedKeyString: string;
};

export type PBKDF2Params = {
  iterations: number;
};

export type KeyDerivationOptions = {
  derivedKeyFormat?: 'AES-CBC' | 'AES-GCM';
  ivFormat?: 'hex' | 'base64';
  algorithm: 'PBKDF2';
  params: PBKDF2Params;
};

export type EncryptionKey = {
  key: CryptoKey;
  derivationOptions: KeyDerivationOptions;
};

export type ExportedEncryptionKey = {
  key: JsonWebKey;
  derivationOptions: KeyDerivationOptions;
};

export type EncryptionResult = {
  data: string;
  iv: string;
  salt?: string;
  // old encryption results will not have this
  keyMetadata?: KeyDerivationOptions;
};

export type DetailedDecryptResult = {
  exportedKeyString: string;
  vault: unknown;
  salt: string;
};

const EXPORT_FORMAT = 'jwk';
const DERIVED_KEY_FORMAT = 'AES-CBC';
const STRING_ENCODING = 'utf-8';
const OLD_DERIVATION_PARAMS: KeyDerivationOptions = {
  derivedKeyFormat: 'AES-CBC',
  algorithm: 'PBKDF2',
  params: {
    iterations: 10_000,
  },
};
const DEFAULT_DERIVATION_PARAMS: KeyDerivationOptions = {
  derivedKeyFormat: 'AES-CBC',
  algorithm: 'PBKDF2',
  params: {
    iterations: 900_000,
  },
};

function restrainIvFormat(ivFormat?: KeyDerivationOptions['ivFormat']) {
  return !['hex', 'base64'].includes(ivFormat || '') ? 'hex' : ivFormat;
}

function filterPersistedKeyDerivationOptions(derivationOptions: KeyDerivationOptions) {
  const obj = JSON.parse(JSON.stringify(derivationOptions));
  if (obj?.ivFormat === 'hex') {
    delete obj.ivFormat;
  }

  return obj
}

/**
 * Encrypts a data object that can be any serializable value using
 * a provided password.
 *
 * @param password - The password to use for encryption.
 * @param dataObj - The data to encrypt.
 * @param key - The CryptoKey to encrypt with.
 * @param salt - The salt to use to encrypt.
 * @param keyDerivationOptions - The options to use for key derivation.
 * @returns The encrypted vault.
 */
export async function encrypt<R>(
  password: string,
  dataObj: R,
  options?: EncryptionOptions & {
    key?: EncryptionKey | CryptoKey,
    salt?: string,
    keyDerivationOptions?: KeyDerivationOptions,
  }
): Promise<string> {
  const {
    key,
    vector,
    salt = generateSalt(),
    keyDerivationOptions = DEFAULT_DERIVATION_PARAMS
  } = options || {};

  const cryptoKey =
    key || (await keyFromPassword(password, salt, false, keyDerivationOptions));
  const payload = await encryptWithKey(cryptoKey, dataObj, { vector, keyDerivationOptions });
  payload.salt = salt;
  return JSON.stringify(payload);
}

/**
 * Encrypts a data object that can be any serializable value using
 * a provided password.
 *
 * @param password - A password to use for encryption.
 * @param dataObj - The data to encrypt.
 * @param salt - The salt used to encrypt.
 * @param keyDerivationOptions - The options to use for key derivation.
 * @returns The vault and exported key string.
 */
export async function encryptWithDetail<R>(
  password: string,
  dataObj: R,
  salt = generateSalt(),
  keyDerivationOptions = DEFAULT_DERIVATION_PARAMS,
): Promise<DetailedEncryptionResult> {
  const key = await keyFromPassword(password, salt, true, keyDerivationOptions);
  const exportedKeyString = await exportKey(key);
  const vault = await encrypt(password, dataObj, { key, salt });

  return {
    vault,
    exportedKeyString,
  };
}

type EncryptionOptions = {
  vector?: Uint8Array;
};
/**
 * Encrypts the provided serializable javascript object using the
 * provided CryptoKey and returns an object containing the cypher text and
 * the initialization vector used.
 *
 * @param encryptionKey - The CryptoKey to encrypt with.
 * @param dataObj - A serializable JavaScript object to encrypt.
 * @returns The encrypted data.
 */
export async function encryptWithKey<R>(
  encryptionKey: EncryptionKey | CryptoKey,
  dataObj: R,
  options?: EncryptionOptions & {
    keyDerivationOptions?: KeyDerivationOptions,
  }
): Promise<EncryptionResult> {
  const { webcrypto } = getWebCrypto();

  const data = JSON.stringify(dataObj);
  const dataBuffer = Buffer.from(data, STRING_ENCODING);
  const { derivedKeyFormat = DERIVED_KEY_FORMAT, ivFormat = 'hex' } = options?.keyDerivationOptions || {};
  const vector = options?.vector || webcrypto.getRandomValues(new Uint8Array(16));
  const key = unwrapKey(encryptionKey);

  const buf = await webcrypto.subtle.encrypt(
    {
      name: derivedKeyFormat,
      iv: vector,
    },
    key,
    dataBuffer,
  );

  const buffer = new Uint8Array(buf);
  const vectorStr = Buffer.from(vector).toString(restrainIvFormat(ivFormat));
  const vaultStr = Buffer.from(buffer).toString('base64');
  const encryptionResult: EncryptionResult = {
    data: vaultStr,
    iv: vectorStr,
  };

  if (isEncryptionKey(encryptionKey)) {
    encryptionResult.keyMetadata = filterPersistedKeyDerivationOptions(encryptionKey.derivationOptions);
  }

  return encryptionResult;
}

/**
 * Given a password and a cypher text, decrypts the text and returns
 * the resulting value.
 *
 * @param password - The password to decrypt with.
 * @param text - The cypher text to decrypt.
 * @param encryptionKey - The key to decrypt with.
 * @returns The decrypted data.
 */
export async function decrypt<T = any>(
  password: string,
  text: string,
  encryptionKey?: EncryptionKey | CryptoKey,
): Promise<T> {
  const payload = JSON.parse(text);
  const { salt, keyMetadata } = payload;
  const cryptoKey = unwrapKey(
    encryptionKey ||
      (await keyFromPassword(password, salt, false, keyMetadata)),
  );

  return decryptWithKey<T>(cryptoKey, payload);
}

/**
 * Given a password and a cypher text, decrypts the text and returns
 * the resulting value, keyString, and salt.
 *
 * @param password - The password to decrypt with.
 * @param text - The encrypted vault to decrypt.
 * @returns The decrypted vault along with the salt and exported key.
 */
export async function decryptWithDetail(
  password: string,
  text: string,
): Promise<DetailedDecryptResult> {
  const payload = JSON.parse(text);
  const { salt, keyMetadata } = payload;
  const key = await keyFromPassword(password, salt, true, keyMetadata);
  const exportedKeyString = await exportKey(key);
  const vault = await decrypt(password, text, key);

  return {
    exportedKeyString,
    vault,
    salt,
  };
}

type DecryptionOptions = Pick<KeyDerivationOptions, 'derivedKeyFormat'>;

/**
 * Given a CryptoKey and an EncryptionResult object containing the initialization
 * vector (iv) and data to decrypt, return the resulting decrypted value.
 *
 * @param encryptionKey - The CryptoKey to decrypt with.
 * @param payload - The payload to decrypt, returned from an encryption method.
 * @returns The decrypted data.
 */
export async function decryptWithKey<R>(
  encryptionKey: EncryptionKey | CryptoKey,
  payload: EncryptionResult,
  options?: DecryptionOptions
): Promise<R> {
  let decryptedObj;
  try {
    const { webcrypto } = getWebCrypto();

    const { derivedKeyFormat = DERIVED_KEY_FORMAT } = options || {};

    const encryptedData = Buffer.from(payload.data, 'base64');
    const vector = Buffer.from(payload.iv, restrainIvFormat(payload.keyMetadata?.ivFormat));
    const key = unwrapKey(encryptionKey);

    const result = await webcrypto.subtle.decrypt(
      { name: derivedKeyFormat, iv: vector },
      key,
      encryptedData,
    );

    const decryptedData = new Uint8Array(result);
    const decryptedStr = Buffer.from(decryptedData).toString(STRING_ENCODING);
    decryptedObj = JSON.parse(decryptedStr);
  } catch (e) {
    console.error(e);
    throw new Error('Incorrect password');
  }

  return decryptedObj;
}

/**
 * Receives an exported CryptoKey string and creates a key.
 *
 * This function supports both JsonWebKey's and exported EncryptionKey's.
 * It will return a CryptoKey for the former, and an EncryptionKey for the latter.
 *
 * @param keyString - The key string to import.
 * @returns An EncryptionKey or a CryptoKey.
 */
export async function importKey(
  keyString: string,
  options?: Pick<KeyDerivationOptions, 'derivedKeyFormat'>,
): Promise<EncryptionKey | CryptoKey> {
  const exportedEncryptionKey = JSON.parse(keyString);
  const { webcrypto } = getWebCrypto();
  const { derivedKeyFormat = DERIVED_KEY_FORMAT } = options || {};

  if (isExportedEncryptionKey(exportedEncryptionKey)) {

    return {
      key: await webcrypto.subtle.importKey(
        EXPORT_FORMAT,
        exportedEncryptionKey.key,
        derivedKeyFormat,
        true,
        ['encrypt', 'decrypt'],
      ),
      derivationOptions: exportedEncryptionKey.derivationOptions,
    };
  }

  return await webcrypto.subtle.importKey(
    EXPORT_FORMAT,
    exportedEncryptionKey,
    derivedKeyFormat,
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Exports a key string from a CryptoKey or from an
 * EncryptionKey instance.
 *
 * @param encryptionKey - The CryptoKey or EncryptionKey to export.
 * @returns A key string.
 */
export async function exportKey(
  encryptionKey: CryptoKey | EncryptionKey,
): Promise<string> {
  const { webcrypto } = getWebCrypto();

  if (isEncryptionKey(encryptionKey)) {
    return JSON.stringify({
      key: await webcrypto.subtle.exportKey(
        EXPORT_FORMAT,
        encryptionKey.key,
      ),
      derivationOptions: encryptionKey.derivationOptions,
    });
  }

  return JSON.stringify(
    await webcrypto.subtle.exportKey(EXPORT_FORMAT, encryptionKey),
  );
}

// const algorithms_pbkdf2 = { name: 'PBKDF2', hash: 'SHA-256' } as const;
export async function keyArrayFromPassword(password: string, saltBase64: string) {
  const { webcrypto } = getWebCrypto();

  const passBuffer = Uint8Array.from(Buffer.from(password));
  const saltBuffer = Uint8Array.from(Buffer.from(saltBase64));

  const keyMaterial = await webcrypto.subtle.importKey(
    'raw', // Format of the key material
    passBuffer, // Key data
    { name: 'PBKDF2', hash: 'SHA-256' }, // Algorithm to use for key derivation
    false, // Not extractable
    ['deriveBits'] // Key usages
  );

  const derivedKey = await webcrypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: saltBuffer,
    iterations: 5000,
    hash: { name: 'SHA-256' }
  }, keyMaterial, 256); // Length in bits (32 bytes * 8 bits per byte)

  return new Uint8Array(derivedKey);
}
/**
 * Generate a CryptoKey from a password and random salt.
 *
 * @param password - The password to use to generate key.
 * @param salt - The salt string to use in key derivation.
 * @param exportable - Whether or not the key should be exportable.
 * @returns A CryptoKey for encryption and decryption.
 */
export async function keyFromPassword(
  password: string,
  salt: string,
  exportable?: boolean,
): Promise<CryptoKey>;
/**
 * Generate a CryptoKey from a password and random salt, specifying
 * key derivation options.
 *
 * @param password - The password to use to generate key.
 * @param salt - The salt string to use in key derivation.
 * @param exportable - Whether or not the key should be exportable.
 * @param opts - The options to use for key derivation.
 * @returns An EncryptionKey for encryption and decryption.
 */
export async function keyFromPassword(
  password: string,
  salt: string,
  exportable?: boolean,
  opts?: KeyDerivationOptions,
): Promise<EncryptionKey>;
// The overloads are already documented.
// eslint-disable-next-line jsdoc/require-jsdoc
export async function keyFromPassword(
  password: string,
  saltBase64: string,
  exportable = false,
  opts: KeyDerivationOptions = OLD_DERIVATION_PARAMS,
): Promise<CryptoKey | EncryptionKey> {
  const passBuffer = Uint8Array.from(Buffer.from(password));
  const saltBuffer = Uint8Array.from(Buffer.from(saltBase64));

  const { webcrypto } = getWebCrypto();

  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    passBuffer,
    { name: 'PBKDF2', hash: 'SHA-256' },
    false,
    ['deriveKey'],
  );

  const derivedKey = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: opts.params.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: DERIVED_KEY_FORMAT, length: 256 },
    exportable,
    ['encrypt', 'decrypt'],
  );

  return opts
    ? {
        key: derivedKey,
        derivationOptions: opts,
      }
    : derivedKey;
}

/**
 * Converts a hex string into a buffer.
 *
 * @param str - Hex encoded string.
 * @returns The string ecoded as a byte array.
 */
export function serializeBufferFromStorage(str: string): Uint8Array {
  const stripStr = str.slice(0, 2) === '0x' ? str.slice(2) : str;
  const buf = new Uint8Array(stripStr.length / 2);
  for (let i = 0; i < stripStr.length; i += 2) {
    const seg = stripStr.substr(i, 2);
    buf[i / 2] = parseInt(seg, 16);
  }
  return buf;
}

/**
 * Converts a buffer into a hex string ready for storage.
 *
 * @param buffer - Buffer to serialize.
 * @returns A hex encoded string.
 */
export function serializeBufferForStorage(buffer: Uint8Array): string {
  let result = '0x';
  buffer.forEach((value) => {
    result += unprefixedHex(value);
  });
  return result;
}

/**
 * Converts a number into hex value, and ensures proper leading 0
 * for single characters strings.
 *
 * @param num - The number to convert to string.
 * @returns An unprefixed hex string.
 */
function unprefixedHex(num: number): string {
  let hex = num.toString(16);
  while (hex.length < 2) {
    hex = `0${hex}`;
  }
  return hex;
}

/**
 * Generates a random string for use as a salt in CryptoKey generation.
 *
 * @param byteCount - The number of bytes to generate.
 * @returns A randomly generated string.
 */
export function generateSalt(byteCount = 32): string {
  const { webcrypto } = getWebCrypto();

  const view = new Uint8Array(byteCount);
  webcrypto.getRandomValues(view);
  // Uint8Array is a fixed length array and thus does not have methods like pop, etc
  // so TypeScript complains about casting it to an array. Array.from() works here for
  // getting the proper type, but it results in a functional difference. In order to
  // cast, you have to first cast view to unknown then cast the unknown value to number[]
  // TypeScript ftw: double opt in to write potentially type-mismatched code.
  const b64encoded = btoa(
    String.fromCharCode.apply(null, view as unknown as number[]),
  );
  return b64encoded;
}

/**
 * Updates the provided vault, re-encrypting
 * data with a safer algorithm if one is available.
 *
 * If the provided vault is already using the latest available encryption method,
 * it is returned as is.
 *
 * @param vault - The vault to update.
 * @param password - The password to use for encryption.
 * @param targetDerivationParams - The options to use for key derivation.
 * @returns A promise resolving to the updated vault.
 */
export async function updateVault(
  vault: string,
  password: string,
  targetDerivationParams = DEFAULT_DERIVATION_PARAMS,
): Promise<string> {
  if (isVaultUpdated(vault, targetDerivationParams)) {
    return vault;
  }

  return encrypt(
    password,
    await decrypt(password, vault),
    {
      keyDerivationOptions: targetDerivationParams
    },
  );
}

/**
 * Updates the provided vault and exported key, re-encrypting
 * data with a safer algorithm if one is available.
 *
 * If the provided vault is already using the latest available encryption method,
 * it is returned as is.
 *
 * @param encryptionResult - The encrypted data to update.
 * @param password - The password to use for encryption.
 * @param targetDerivationParams - The options to use for key derivation.
 * @returns A promise resolving to the updated encrypted data and exported key.
 */
export async function updateVaultWithDetail(
  encryptionResult: DetailedEncryptionResult,
  password: string,
  targetDerivationParams = DEFAULT_DERIVATION_PARAMS,
): Promise<DetailedEncryptionResult> {
  if (isVaultUpdated(encryptionResult.vault, targetDerivationParams)) {
    return encryptionResult;
  }

  return encryptWithDetail(
    password,
    await decrypt(password, encryptionResult.vault),
    undefined,
    targetDerivationParams,
  );
}

/**
 * Checks if the provided key is an `EncryptionKey`.
 *
 * @param encryptionKey - The object to check.
 * @returns Whether or not the key is an `EncryptionKey`.
 */
function isEncryptionKey(
  encryptionKey: unknown,
): encryptionKey is EncryptionKey {
  const { CryptoKey } = getWebCrypto();

  return (
    isPlainObject(encryptionKey) &&
    hasProperty(encryptionKey, 'key') &&
    hasProperty(encryptionKey, 'derivationOptions') &&
    encryptionKey.key instanceof CryptoKey &&
    isKeyDerivationOptions(encryptionKey.derivationOptions)
  );
}

/**
 * Checks if the provided object is a `KeyDerivationOptions`.
 *
 * @param derivationOptions - The object to check.
 * @returns Whether or not the object is a `KeyDerivationOptions`.
 */
function isKeyDerivationOptions(
  derivationOptions: unknown,
): derivationOptions is KeyDerivationOptions {
  return (
    isPlainObject(derivationOptions) &&
    hasProperty(derivationOptions, 'algorithm') &&
    hasProperty(derivationOptions, 'params')
  );
}

/**
 * Checks if the provided key is an `ExportedEncryptionKey`.
 *
 * @param exportedKey - The object to check.
 * @returns Whether or not the object is an `ExportedEncryptionKey`.
 */
function isExportedEncryptionKey(
  exportedKey: unknown,
): exportedKey is ExportedEncryptionKey {
  return (
    isPlainObject(exportedKey) &&
    hasProperty(exportedKey, 'key') &&
    hasProperty(exportedKey, 'derivationOptions') &&
    isKeyDerivationOptions(exportedKey.derivationOptions)
  );
}

/**
 * Returns the `CryptoKey` from the provided encryption key.
 * If the provided key is a `CryptoKey`, it is returned as is.
 *
 * @param encryptionKey - The key to unwrap.
 * @returns The `CryptoKey` from the provided encryption key.
 */
function unwrapKey(encryptionKey: EncryptionKey | CryptoKey): CryptoKey {
  return isEncryptionKey(encryptionKey) ? encryptionKey.key : encryptionKey;
}

/**
 * Checks if the provided vault is an updated encryption format.
 *
 * @param vault - The vault to check.
 * @param targetDerivationParams - The options to use for key derivation.
 * @returns Whether or not the vault is an updated encryption format.
 */
export function isVaultUpdated(
  vault: string,
  targetDerivationParams = DEFAULT_DERIVATION_PARAMS,
): boolean {
  const { keyMetadata } = JSON.parse(vault);
  return (
    isKeyDerivationOptions(keyMetadata) &&
    keyMetadata.algorithm === targetDerivationParams.algorithm &&
    keyMetadata.params.iterations === targetDerivationParams.params.iterations
  );
}
