import Aes from 'react-native-aes-crypto';
import { pbkdf2 } from 'react-native-quick-crypto';

import type { EncryptorAdapter } from '@rabby-wallet/service-keyring';

const algorithms = 'aes-256-cbc';
const algorithms_pbkdf2 = 'sha256';
const DERIVED_KEY_BYTES = 32;

export const KDF_ALGORITHM = 'PBKDF2';

/**
 * PBKDF2-HMAC-SHA256 iteration counts.
 *
 * "OWASP2023" names the source and year of the recommendation so the value can
 * be versioned if it changes again.
 * Source: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
 */
export enum KeyDerivationIteration {
  /** Every payload written before key metadata existed uses this value. */
  Legacy5000 = 5_000,
  OWASP2023 = 600_000,
}

/**
 * Upper bound accepted from a payload. It keeps a corrupted or crafted payload
 * from pinning the native thread with an absurd iteration count.
 */
const MAX_KDF_ITERATIONS = 10_000_000;

export type KeyDerivationOptions = {
  algorithm: typeof KDF_ALGORITHM;
  params: {
    iterations: number;
  };
};

export const LEGACY_DERIVATION_OPTIONS: KeyDerivationOptions = Object.freeze({
  algorithm: KDF_ALGORITHM,
  params: Object.freeze({ iterations: KeyDerivationIteration.Legacy5000 }),
});

export const DERIVATION_OPTIONS_OWASP2023: KeyDerivationOptions = Object.freeze(
  {
    algorithm: KDF_ALGORITHM,
    params: Object.freeze({ iterations: KeyDerivationIteration.OWASP2023 }),
  },
);

type EncryptedPayload = {
  cipher: string;
  iv: string;
  salt: string;
  /** Absent on legacy payloads, which always used 5,000 iterations. */
  keyMetadata?: KeyDerivationOptions;
};

function isLegacyDerivation(options: KeyDerivationOptions) {
  return (
    options.algorithm === KDF_ALGORITHM &&
    options.params.iterations === KeyDerivationIteration.Legacy5000
  );
}

function assertValidDerivationOptions(
  value: unknown,
): asserts value is KeyDerivationOptions {
  const options = value as KeyDerivationOptions | null;
  const iterations = options?.params?.iterations;
  if (
    !options ||
    options.algorithm !== KDF_ALGORITHM ||
    typeof iterations !== 'number' ||
    !Number.isSafeInteger(iterations) ||
    iterations < KeyDerivationIteration.Legacy5000 ||
    iterations > MAX_KDF_ITERATIONS
  ) {
    throw new Error('Unsupported key derivation options');
  }
}

/**
 * Reads the KDF parameters a payload was written with. Payloads without
 * `keyMetadata` predate it and were derived with 5,000 iterations.
 */
export function getPayloadDerivationOptions(
  payload: Pick<EncryptedPayload, 'keyMetadata'>,
): KeyDerivationOptions {
  if (payload.keyMetadata === undefined) {
    return LEGACY_DERIVATION_OPTIONS;
  }
  assertValidDerivationOptions(payload.keyMetadata);
  return payload.keyMetadata;
}

async function _generateSalt(byteCount = 32) {
  const saltStr = await Aes.randomKey(byteCount);

  return btoa(saltStr);
}

/**
 * Unpaired UTF-16 surrogates have no single UTF-8 encoding: Java, iOS and the
 * Buffer used by QuickCrypto each substitute them differently.
 */
function hasLoneSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function derivePbkdf2WithAes(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  return Aes.pbkdf2(
    password,
    salt,
    iterations,
    DERIVED_KEY_BYTES * 8,
    algorithms_pbkdf2,
  );
}

function derivePbkdf2WithQuickCrypto(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    pbkdf2(
      password,
      salt,
      iterations,
      DERIVED_KEY_BYTES,
      algorithms_pbkdf2,
      (error, derived) => {
        if (error || !derived) {
          reject(error || new Error('Empty PBKDF2 result'));
          return;
        }
        resolve(derived.toString('hex'));
      },
    );
  });
}

/**
 * PBKDF2-HMAC-SHA256 key as a lowercase hex string, byte-for-byte what
 * `Aes.pbkdf2(password, salt, iterations, 256, 'sha256')` returns: both hash
 * the UTF-8 bytes of the password and of the salt string (the base64 text
 * itself, not its decoded bytes).
 *
 * It runs on react-native-quick-crypto (fastpbkdf2 + OpenSSL, off the JS and
 * shared native-module threads), which is about 10x faster on Android than the
 * Java implementation behind `Aes.pbkdf2`. `Aes.pbkdf2` is kept for passwords
 * whose UTF-8 bytes differ by platform, and as a fallback if QuickCrypto
 * fails.
 */
export async function derivePbkdf2KeyHex(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  if (hasLoneSurrogate(password) || hasLoneSurrogate(salt)) {
    return derivePbkdf2WithAes(password, salt, iterations);
  }
  try {
    return await derivePbkdf2WithQuickCrypto(password, salt, iterations);
  } catch {
    return derivePbkdf2WithAes(password, salt, iterations);
  }
}

/** The previous implementation, kept for compatibility checks. */
export const derivePbkdf2KeyHexWithAes = derivePbkdf2WithAes;

function _keyFromPassword(
  password: string,
  salt: string,
  options: KeyDerivationOptions,
): Promise<string> {
  return derivePbkdf2KeyHex(password, salt, options.params.iterations);
}

async function _encryptWithKey(text: string, keyBase64: string) {
  const iv = await Aes.randomKey(16);
  const cipher: string = await Aes.encrypt(text, keyBase64, iv, algorithms);
  return { cipher, iv };
}

async function _decryptWithKey(encryptedData: EncryptedPayload, key: string) {
  return Aes.decrypt(encryptedData.cipher, key, encryptedData.iv, algorithms);
}

type ExportedRNEncryptorKey = {
  version: 1;
  salt: string;
  key: string;
};

function parseExportedKey(exportedKeyString: string): ExportedRNEncryptorKey {
  const exportedKey = JSON.parse(exportedKeyString) as ExportedRNEncryptorKey;

  if (
    exportedKey.version !== 1 ||
    typeof exportedKey.salt !== 'string' ||
    !exportedKey.key
  ) {
    throw new Error('Invalid exported RNEncryptor key');
  }

  return exportedKey;
}

export type RNEncryptorOptions = {
  /**
   * KDF parameters for new payloads. Decryption always follows the parameters
   * recorded in each payload, so any value here can read every older payload.
   */
  keyDerivationOptions: KeyDerivationOptions;
};

export default class RNEncryptor implements EncryptorAdapter {
  key = null;

  private readonly keyDerivationOptions: KeyDerivationOptions;

  constructor({ keyDerivationOptions }: RNEncryptorOptions) {
    assertValidDerivationOptions(keyDerivationOptions);
    this.keyDerivationOptions = keyDerivationOptions;
  }

  /**
   * Encrypts a JS object using a password (and AES encryption with native libraries)
   *
   * @returns - Promise resolving to stringified data
   */
  async encrypt(password: string, object: any) {
    const salt = await _generateSalt(16);
    const options = this.keyDerivationOptions;
    const key = await _keyFromPassword(password, salt, options);
    const { cipher, iv } = await _encryptWithKey(JSON.stringify(object), key);
    const result: EncryptedPayload = { cipher, iv, salt };
    // Legacy payloads keep their exact pre-metadata shape so they stay
    // byte-for-byte what every shipped version writes.
    if (!isLegacyDerivation(options)) {
      result.keyMetadata = options;
    }

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
    const encryptedData = JSON.parse(encryptedString) as EncryptedPayload;
    const key = await _keyFromPassword(
      password,
      encryptedData.salt,
      getPayloadDerivationOptions(encryptedData),
    );
    const data = await _decryptWithKey(encryptedData, key);

    return JSON.parse(data);
  }

  async decryptWithDetail(password: string, encryptedString: string) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedPayload;
    const key = await _keyFromPassword(
      password,
      encryptedData.salt,
      getPayloadDerivationOptions(encryptedData),
    );
    const data = await _decryptWithKey(encryptedData, key);
    // The exported key is the derived AES key itself, so its format does not
    // depend on the iteration count and older versions can still read it.
    const exportedKey: ExportedRNEncryptorKey = {
      version: 1,
      salt: encryptedData.salt,
      key,
    };

    return {
      vault: JSON.parse(data),
      exportedKeyString: JSON.stringify(exportedKey),
      salt: encryptedData.salt,
    };
  }

  async decryptWithExportedKey(
    encryptedString: string,
    exportedKeyString: string,
  ) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedPayload;
    const exportedKey = parseExportedKey(exportedKeyString);

    if (exportedKey.salt !== encryptedData.salt) {
      throw new Error('Invalid exported RNEncryptor key');
    }

    const data = await _decryptWithKey(encryptedData, exportedKey.key);
    return JSON.parse(data);
  }

  /**
   * Whether a payload is at least as strong as this encryptor's KDF target.
   * A payload with more iterations (e.g. written by a newer version) counts as
   * updated, so a rewrite never weakens it. Unparseable input also reports
   * `true` so callers never try to rewrite it.
   */
  isVaultUpdated(encryptedString: string) {
    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(encryptedString);
    } catch {
      return true;
    }
    if (!payload || typeof payload !== 'object') {
      return true;
    }

    let current: KeyDerivationOptions;
    try {
      current = getPayloadDerivationOptions(payload);
    } catch {
      return true;
    }
    return (
      current.algorithm === this.keyDerivationOptions.algorithm &&
      current.params.iterations >= this.keyDerivationOptions.params.iterations
    );
  }
}
