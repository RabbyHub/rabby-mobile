import Aes from 'react-native-aes-crypto';
import type { EncryptorAdapter } from '@rabby-wallet/service-keyring';

const algorithms = 'aes-256-cbc';
const algorithms_pbkdf2 = 'sha256';

const LEGACY_PBKDF2_ITERATIONS = 5_000;
const UPGRADED_PBKDF2_ITERATIONS = 60_000;

// Controls the encryption target. Existing ciphertext selects its own KDF.
const ENABLE_PBKDF2_60000 = false;

export type KeyDerivationOptions = {
  algorithm: 'PBKDF2';
  params: {
    iterations:
      | typeof LEGACY_PBKDF2_ITERATIONS
      | typeof UPGRADED_PBKDF2_ITERATIONS;
  };
};

type EncryptedData = {
  cipher: string;
  iv: string;
  salt: string;
  keyMetadata?: KeyDerivationOptions;
};

function parseKeyMetadata(keyMetadata: unknown): KeyDerivationOptions {
  // Missing metadata is the original Rabby format, even with the flag enabled.
  if (keyMetadata === undefined) {
    return {
      algorithm: 'PBKDF2',
      params: { iterations: LEGACY_PBKDF2_ITERATIONS },
    };
  }

  const metadata = keyMetadata as KeyDerivationOptions | null;
  const iterations = metadata?.params?.iterations;
  if (
    metadata?.algorithm !== 'PBKDF2' ||
    (iterations !== LEGACY_PBKDF2_ITERATIONS &&
      iterations !== UPGRADED_PBKDF2_ITERATIONS)
  ) {
    throw new Error('Unsupported RNEncryptor key derivation options');
  }

  // Snapshot caller-owned options and accept only bounded, supported costs.
  return { algorithm: 'PBKDF2', params: { iterations } };
}

function metadataForWrite(keyMetadata: KeyDerivationOptions) {
  // Preserve the original 5k ciphertext and exported-key formats.
  return keyMetadata.params.iterations === LEGACY_PBKDF2_ITERATIONS
    ? {}
    : { keyMetadata };
}

async function _generateSalt(byteCount = 32) {
  const saltStr = await Aes.randomKey(byteCount);

  return btoa(saltStr);
}

async function _keyFromPassword(
  password: string,
  salt: string,
  keyMetadata: KeyDerivationOptions,
) {
  return Aes.pbkdf2(
    password,
    salt,
    keyMetadata.params.iterations,
    256,
    algorithms_pbkdf2,
  );
}

async function _encryptWithKey(text: string, key: string) {
  const iv = await Aes.randomKey(16);
  return Aes.encrypt(text, key, iv, algorithms).then(cipher => ({
    cipher,
    iv,
    salt: '',
  }));
}

async function _decryptWithKey(encryptedData: EncryptedData, key: string) {
  return Aes.decrypt(encryptedData.cipher, key, encryptedData.iv, algorithms);
}

async function encryptWithPassword(
  password: string,
  object: unknown,
  keyMetadata: KeyDerivationOptions,
) {
  const salt = await _generateSalt(16);
  const key = await _keyFromPassword(password, salt, keyMetadata);
  const result = await _encryptWithKey(JSON.stringify(object), key);

  return {
    encryptedData: { ...result, salt, ...metadataForWrite(keyMetadata) },
    key,
  };
}

type ExportedRNEncryptorKey = {
  version: 1;
  salt: string;
  key: string;
  keyMetadata?: KeyDerivationOptions;
};

function serializeExportedKey(
  key: string,
  salt: string,
  keyMetadata: KeyDerivationOptions,
) {
  const exportedKey: ExportedRNEncryptorKey = {
    version: 1,
    salt,
    key,
    ...metadataForWrite(keyMetadata),
  };

  return JSON.stringify(exportedKey);
}

function parseExportedKey(exportedKeyString: string): ExportedRNEncryptorKey {
  const exportedKey = JSON.parse(exportedKeyString) as ExportedRNEncryptorKey;

  if (
    exportedKey?.version !== 1 ||
    typeof exportedKey.salt !== 'string' ||
    typeof exportedKey.key !== 'string' ||
    !exportedKey.key
  ) {
    throw new Error('Invalid exported RNEncryptor key');
  }

  return exportedKey;
}

export default class RNEncryptor implements EncryptorAdapter {
  key = null;
  private readonly keyDerivationOptions: KeyDerivationOptions;

  constructor({
    keyDerivationOptions = {
      algorithm: 'PBKDF2',
      params: {
        iterations: ENABLE_PBKDF2_60000
          ? UPGRADED_PBKDF2_ITERATIONS
          : LEGACY_PBKDF2_ITERATIONS,
      },
    },
  }: { keyDerivationOptions?: KeyDerivationOptions } = {}) {
    this.keyDerivationOptions = parseKeyMetadata(keyDerivationOptions);
  }

  isVaultUpdated(encryptedString: string): boolean {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const keyMetadata = parseKeyMetadata(encryptedData.keyMetadata);

    // A lower configured target must never request a vault downgrade.
    return (
      keyMetadata.params.iterations >=
      this.keyDerivationOptions.params.iterations
    );
  }

  /**
   * Encrypts a JS object using a password (and AES encryption with native libraries)
   *
   * @returns - Promise resolving to stringified data
   */
  async encrypt(password: string, object: any) {
    const { encryptedData } = await encryptWithPassword(
      password,
      object,
      this.keyDerivationOptions,
    );

    return JSON.stringify(encryptedData);
  }

  async encryptWithDetail(password: string, object: any) {
    const { encryptedData, key } = await encryptWithPassword(
      password,
      object,
      this.keyDerivationOptions,
    );

    return {
      vault: JSON.stringify(encryptedData),
      exportedKeyString: serializeExportedKey(
        key,
        encryptedData.salt,
        this.keyDerivationOptions,
      ),
    };
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
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const keyMetadata = parseKeyMetadata(encryptedData.keyMetadata);
    const key = await _keyFromPassword(
      password,
      encryptedData.salt,
      keyMetadata,
    );
    const data = await _decryptWithKey(encryptedData, key);

    return JSON.parse(data);
  }

  async decryptWithDetail(password: string, encryptedString: string) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const keyMetadata = parseKeyMetadata(encryptedData.keyMetadata);
    const key = await _keyFromPassword(
      password,
      encryptedData.salt,
      keyMetadata,
    );
    const data = await _decryptWithKey(encryptedData, key);
    return {
      vault: JSON.parse(data),
      exportedKeyString: serializeExportedKey(
        key,
        encryptedData.salt,
        keyMetadata,
      ),
      salt: encryptedData.salt,
    };
  }

  async decryptWithExportedKey(
    encryptedString: string,
    exportedKeyString: string,
  ) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const exportedKey = parseExportedKey(exportedKeyString);
    const keyMetadata = parseKeyMetadata(encryptedData.keyMetadata);
    const exportedKeyMetadata = parseKeyMetadata(exportedKey.keyMetadata);

    if (
      exportedKey.salt !== encryptedData.salt ||
      exportedKeyMetadata.params.iterations !== keyMetadata.params.iterations
    ) {
      throw new Error('Invalid exported RNEncryptor key');
    }

    const data = await _decryptWithKey(encryptedData, exportedKey.key);
    return JSON.parse(data);
  }
}
