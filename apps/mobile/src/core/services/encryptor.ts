import Aes from 'react-native-aes-crypto';
import type { EncryptorAdapter } from '@rabby-wallet/service-keyring';

const algorithms = 'aes-256-cbc';
const algorithms_pbkdf2 = 'sha256';

export const KDF_VERSION_ORIGINAL = 'original' as const;
export const KDF_VERSION_PBKDF2_600000 = '20261022' as const;

export type KdfVersion =
  | typeof KDF_VERSION_ORIGINAL
  | typeof KDF_VERSION_PBKDF2_600000;

/**
 * Public KDF metadata stored beside the ciphertext. `version` is authoritative;
 * the remaining fields are checked against the registry for diagnostics and
 * corruption detection.
 */
export type KeyDerivationOptions = {
  version: KdfVersion;
  algorithm: 'PBKDF2';
  hash: 'sha256';
  iterations: 5_000 | 600_000;
};

const KDF_REGISTRY: Record<KdfVersion, KeyDerivationOptions> = Object.freeze({
  [KDF_VERSION_ORIGINAL]: Object.freeze({
    version: KDF_VERSION_ORIGINAL,
    algorithm: 'PBKDF2',
    hash: 'sha256',
    iterations: 5_000,
  }),
  [KDF_VERSION_PBKDF2_600000]: Object.freeze({
    version: KDF_VERSION_PBKDF2_600000,
    algorithm: 'PBKDF2',
    hash: 'sha256',
    iterations: 600_000,
  }),
});

export const LEGACY_DERIVATION_OPTIONS = KDF_REGISTRY[KDF_VERSION_ORIGINAL];
export const DERIVATION_OPTIONS_OWASP2023 =
  KDF_REGISTRY[KDF_VERSION_PBKDF2_600000];
export const DEFAULT_KDF_VERSION: KdfVersion = KDF_VERSION_ORIGINAL;

const KDF_VERSION_RANK: Record<KdfVersion, number> = {
  [KDF_VERSION_ORIGINAL]: 0,
  [KDF_VERSION_PBKDF2_600000]: 20261022,
};

// Controls the encryption target. Existing payloads select their own KDF.
const ENABLE_PBKDF2_600000 = false;

type LegacyKeyMetadata = {
  algorithm: 'PBKDF2';
  params: {
    iterations: number;
  };
};

type EncryptedData = {
  cipher: string;
  iv: string;
  salt: string;
  kdf?: unknown;
  /** Read-only compatibility with the previous metadata draft. */
  keyMetadata?: unknown;
};

type ExportedRNEncryptorKey = {
  version: 1;
  salt: string;
  key: string;
  kdf?: unknown;
  /** Read-only compatibility with the previous metadata draft. */
  keyMetadata?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneKdfOptions(options: KeyDerivationOptions): KeyDerivationOptions {
  return {
    version: options.version,
    algorithm: options.algorithm,
    hash: options.hash,
    iterations: options.iterations,
  };
}

function isKnownKdfVersion(value: unknown): value is KdfVersion {
  return value === KDF_VERSION_ORIGINAL || value === KDF_VERSION_PBKDF2_600000;
}

function parseKdfMetadata(value: unknown): KeyDerivationOptions {
  if (!isRecord(value) || !isKnownKdfVersion(value.version)) {
    throw new Error('Unsupported RNEncryptor KDF version');
  }

  const expected = KDF_REGISTRY[value.version];
  if (
    (value.algorithm !== undefined && value.algorithm !== expected.algorithm) ||
    (value.hash !== undefined && value.hash !== expected.hash) ||
    (value.iterations !== undefined && value.iterations !== expected.iterations)
  ) {
    throw new Error('Unsupported RNEncryptor KDF parameters');
  }

  return cloneKdfOptions(expected);
}

function parseLegacyKeyMetadata(value: unknown): KeyDerivationOptions {
  if (value === undefined) {
    return cloneKdfOptions(LEGACY_DERIVATION_OPTIONS);
  }

  const metadata = value as LegacyKeyMetadata | null;
  if (
    !metadata ||
    metadata.algorithm !== 'PBKDF2' ||
    !isRecord(metadata.params) ||
    typeof metadata.params.iterations !== 'number' ||
    !Number.isSafeInteger(metadata.params.iterations)
  ) {
    throw new Error('Unsupported RNEncryptor key derivation options');
  }

  const matched = Object.values(KDF_REGISTRY).find(
    options => options.iterations === metadata.params.iterations,
  );
  if (!matched) {
    throw new Error('Unsupported RNEncryptor key derivation options');
  }

  return cloneKdfOptions(matched);
}

function resolvePayloadKdfOptions(
  encryptedData: Pick<EncryptedData, 'kdf' | 'keyMetadata'>,
): KeyDerivationOptions {
  if (encryptedData.kdf !== undefined) {
    const versioned = parseKdfMetadata(encryptedData.kdf);
    if (
      encryptedData.keyMetadata !== undefined &&
      parseLegacyKeyMetadata(encryptedData.keyMetadata).version !==
        versioned.version
    ) {
      throw new Error('Conflicting RNEncryptor KDF metadata');
    }
    return versioned;
  }

  return parseLegacyKeyMetadata(encryptedData.keyMetadata);
}

function parseKdfVersion(value: unknown): KdfVersion {
  if (!isKnownKdfVersion(value)) {
    throw new Error('Unsupported RNEncryptor KDF version');
  }
  return value;
}

function resolvePayloadKdfCandidates(
  encryptedData: Pick<EncryptedData, 'kdf' | 'keyMetadata'>,
): KeyDerivationOptions[] {
  if (encryptedData.kdf !== undefined) {
    return [parseKdfMetadata(encryptedData.kdf)];
  }
  if (encryptedData.keyMetadata !== undefined) {
    return [parseLegacyKeyMetadata(encryptedData.keyMetadata)];
  }
  // Original payloads always used 5k; stronger writes carry KDF metadata.
  // A failed password check must not trigger a speculative 600k derivation.
  return [cloneKdfOptions(LEGACY_DERIVATION_OPTIONS)];
}

function resolveExportedKdfOptions(
  exportedKey: Pick<ExportedRNEncryptorKey, 'kdf' | 'keyMetadata'>,
): KeyDerivationOptions {
  if (exportedKey.kdf !== undefined) {
    return parseKdfMetadata(exportedKey.kdf);
  }
  return parseLegacyKeyMetadata(exportedKey.keyMetadata);
}

async function _generateSalt(byteCount = 32) {
  const saltStr = await Aes.randomKey(byteCount);

  return btoa(saltStr);
}

async function _keyFromPassword(
  password: string,
  salt: string,
  options: KeyDerivationOptions,
) {
  return Aes.pbkdf2(password, salt, options.iterations, 256, algorithms_pbkdf2);
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

async function decryptWithCandidates(
  password: string,
  encryptedData: EncryptedData,
) {
  let lastError: unknown;
  for (const options of resolvePayloadKdfCandidates(encryptedData)) {
    try {
      const key = await _keyFromPassword(password, encryptedData.salt, options);
      const data = await _decryptWithKey(encryptedData, key);
      return { data: JSON.parse(data), options, key };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to decrypt RNEncryptor payload');
}

async function encryptWithPassword(
  password: string,
  object: unknown,
  options: KeyDerivationOptions,
) {
  const salt = await _generateSalt(16);
  const key = await _keyFromPassword(password, salt, options);
  const result = await _encryptWithKey(JSON.stringify(object), key);

  return {
    encryptedData: {
      ...result,
      salt,
      kdf: cloneKdfOptions(options),
    },
    key,
  };
}

function serializeExportedKey(
  key: string,
  salt: string,
  options: KeyDerivationOptions,
) {
  const exportedKey: ExportedRNEncryptorKey = {
    version: 1,
    salt,
    key,
    kdf: cloneKdfOptions(options),
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

  resolveExportedKdfOptions(exportedKey);
  return exportedKey;
}

export default class RNEncryptor implements EncryptorAdapter {
  key = null;
  private readonly keyDerivationOptions: KeyDerivationOptions;

  constructor({
    keyDerivationOptions = KDF_REGISTRY[
      ENABLE_PBKDF2_600000 ? KDF_VERSION_PBKDF2_600000 : KDF_VERSION_ORIGINAL
    ],
  }: { keyDerivationOptions?: KeyDerivationOptions } = {}) {
    const parsed = parseKdfMetadata(keyDerivationOptions);
    this.keyDerivationOptions = cloneKdfOptions(parsed);
  }

  isVaultUpdated(encryptedString: string): boolean {
    let payload: EncryptedData;
    try {
      payload = JSON.parse(encryptedString) as EncryptedData;
      const options = resolvePayloadKdfOptions(payload);
      return (
        KDF_VERSION_RANK[options.version] >=
        KDF_VERSION_RANK[this.keyDerivationOptions.version]
      );
    } catch {
      // Never rewrite a payload we cannot understand.
      return true;
    }
  }

  /**
   * Adds explicit KDF metadata to a legacy payload without changing its
   * ciphertext, IV or salt. Returns null when no metadata update is needed.
   */
  normalizeKdfMetadata(
    encryptedString: string,
    resolvedVersion?: string,
  ): string | null {
    let payload: EncryptedData;
    try {
      payload = JSON.parse(encryptedString) as EncryptedData;
      if (payload.kdf !== undefined) {
        return null;
      }

      const resolved =
        payload.keyMetadata !== undefined
          ? resolvePayloadKdfOptions(payload)
          : resolvedVersion
          ? KDF_REGISTRY[parseKdfVersion(resolvedVersion)]
          : null;
      if (!resolved) {
        return null;
      }
      const { keyMetadata: _legacyMetadata, ...rest } = payload;
      return JSON.stringify({
        ...rest,
        kdf: cloneKdfOptions(resolved),
      });
    } catch {
      return null;
    }
  }

  async encrypt(password: string, object: any) {
    const { encryptedData } = await encryptWithPassword(
      password,
      object,
      this.keyDerivationOptions,
    );

    return JSON.stringify(encryptedData);
  }

  /**
   * Encrypts keyring state with the new-wallet policy: a fresh wallet uses the
   * strongest registered version, while rewrites inherit the version of the
   * ciphertext they replace so a password change never downgrades it.
   */
  async encryptKeyringState(
    password: string,
    object: unknown,
    currentEncryptedString?: string,
  ) {
    const options: KeyDerivationOptions = currentEncryptedString
      ? resolvePayloadKdfOptions(
          JSON.parse(currentEncryptedString) as EncryptedData,
        )
      : KDF_REGISTRY[KDF_VERSION_PBKDF2_600000];

    const { encryptedData } = await encryptWithPassword(
      password,
      object,
      options,
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

  async decrypt(password: string, encryptedString: string) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const result = await decryptWithCandidates(password, encryptedData);
    return result.data;
  }

  async decryptWithDetail(password: string, encryptedString: string) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const result = await decryptWithCandidates(password, encryptedData);
    return {
      vault: result.data,
      exportedKeyString: serializeExportedKey(
        result.key,
        encryptedData.salt,
        result.options,
      ),
      salt: encryptedData.salt,
      kdfVersion: result.options.version,
    };
  }

  async decryptWithExportedKey(
    encryptedString: string,
    exportedKeyString: string,
  ) {
    const encryptedData = JSON.parse(encryptedString) as EncryptedData;
    const exportedKey = parseExportedKey(exportedKeyString);
    const hasPayloadMetadata =
      encryptedData.kdf !== undefined ||
      encryptedData.keyMetadata !== undefined;
    const hasExportedMetadata =
      exportedKey.kdf !== undefined || exportedKey.keyMetadata !== undefined;

    if (exportedKey.salt !== encryptedData.salt) {
      throw new Error('Invalid exported RNEncryptor key');
    }
    if (hasPayloadMetadata && hasExportedMetadata) {
      const payloadOptions = resolvePayloadKdfOptions(encryptedData);
      const exportedOptions = resolveExportedKdfOptions(exportedKey);
      if (exportedOptions.version !== payloadOptions.version) {
        throw new Error('Invalid exported RNEncryptor key');
      }
    }

    if (!exportedKey.key) {
      throw new Error('Invalid exported RNEncryptor key');
    }

    const data = await _decryptWithKey(encryptedData, exportedKey.key);
    return JSON.parse(data);
  }
}
