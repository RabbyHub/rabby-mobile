import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';

import type { EncryptorAdapter } from '../src/utils/encryptor';

// Node stand-in for the mobile RNEncryptor (apps/mobile/src/core/services/encryptor.ts).
// Same payload format and primitives as react-native-aes-crypto on device:
// PBKDF2-HMAC-SHA256 over the UTF-8 bytes of the password and salt strings,
// a hex key, a hex IV, and AES-256-CBC with base64 output.

export const LEGACY_ITERATIONS = 5_000;
export const OWASP2023_ITERATIONS = 600_000;

type Payload = {
  cipher: string;
  iv: string;
  salt: string;
  keyMetadata?: { algorithm: 'PBKDF2'; params: { iterations: number } };
};

const pbkdf2Hex = (password: string, salt: string, iterations: number) => {
  return pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    Buffer.from(salt, 'utf8'),
    iterations,
    32,
    'sha256',
  ).toString('hex');
};

const aesEncrypt = (text: string, keyHex: string, ivHex: string) => {
  const cipher = createCipheriv(
    'aes-256-cbc',
    Buffer.from(keyHex, 'hex'),
    Buffer.from(ivHex, 'hex'),
  );
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString(
    'base64',
  );
};

const aesDecrypt = (cipherText: string, keyHex: string, ivHex: string) => {
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(keyHex, 'hex'),
    Buffer.from(ivHex, 'hex'),
  );
  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const randomHex = (bytes: number) => {
  return randomBytes(bytes).toString('hex');
};

const payloadIterations = (payload: Payload) => {
  if (payload.keyMetadata === undefined) {
    return LEGACY_ITERATIONS;
  }
  const iterations = payload.keyMetadata.params?.iterations;
  if (
    payload.keyMetadata.algorithm !== 'PBKDF2' ||
    !Number.isSafeInteger(iterations) ||
    iterations < LEGACY_ITERATIONS
  ) {
    throw new Error('Unsupported key derivation options');
  }
  return iterations;
};

const decryptWithExportedKey = (
  encrypted: string,
  exportedKeyString: string,
) => {
  const payload = JSON.parse(encrypted) as Payload;
  const exported = JSON.parse(exportedKeyString);
  if (exported.version !== 1 || exported.salt !== payload.salt) {
    throw new Error('Invalid exported RNEncryptor key');
  }
  return JSON.parse(aesDecrypt(payload.cipher, exported.key, payload.iv));
};

export type KdfEncryptor = Required<EncryptorAdapter> & {
  /** Number of PBKDF2 derivations performed, by iteration count. */
  derivations: Map<number, number>;
};

/**
 * Current behavior: reads any iteration count, writes `targetIterations`.
 *
 * @param targetIterations - Iterations used for new payloads.
 * @returns An encryptor that also counts its PBKDF2 derivations.
 */
export const createKdfAwareEncryptor = (
  targetIterations = OWASP2023_ITERATIONS,
): KdfEncryptor => {
  const derivations = new Map<number, number>();
  const derive = (password: string, salt: string, iterations: number) => {
    derivations.set(iterations, (derivations.get(iterations) || 0) + 1);
    return pbkdf2Hex(password, salt, iterations);
  };

  return {
    derivations,
    async encrypt(password, object) {
      const salt = btoa(randomHex(16));
      const key = derive(password, salt, targetIterations);
      const iv = randomHex(16);
      const payload: Payload = {
        cipher: aesEncrypt(JSON.stringify(object), key, iv),
        iv,
        salt,
      };
      if (targetIterations !== LEGACY_ITERATIONS) {
        payload.keyMetadata = {
          algorithm: 'PBKDF2',
          params: { iterations: targetIterations },
        };
      }
      return JSON.stringify(payload);
    },
    async decrypt(password, encrypted) {
      const payload = JSON.parse(encrypted) as Payload;
      const key = derive(password, payload.salt, payloadIterations(payload));
      return JSON.parse(aesDecrypt(payload.cipher, key, payload.iv));
    },
    async decryptWithDetail(password, encrypted) {
      const payload = JSON.parse(encrypted) as Payload;
      const key = derive(password, payload.salt, payloadIterations(payload));
      return {
        vault: JSON.parse(aesDecrypt(payload.cipher, key, payload.iv)),
        exportedKeyString: JSON.stringify({
          version: 1,
          salt: payload.salt,
          key,
        }),
        salt: payload.salt,
      };
    },
    async decryptWithExportedKey(encrypted, exportedKeyString) {
      return decryptWithExportedKey(encrypted, exportedKeyString);
    },
    isVaultUpdated(encrypted) {
      try {
        return payloadIterations(JSON.parse(encrypted)) >= targetIterations;
      } catch {
        return true;
      }
    },
  };
};

/**
 * The encryptor as shipped before this change (old APK): always 5,000
 * iterations, ignores `keyMetadata`, and has no `isVaultUpdated`.
 *
 * @returns The shipped legacy encryptor.
 */
export const createShippedLegacyEncryptor = (): EncryptorAdapter => {
  return {
    async encrypt(password, object) {
      const salt = btoa(randomHex(16));
      const key = pbkdf2Hex(password, salt, LEGACY_ITERATIONS);
      const iv = randomHex(16);
      return JSON.stringify({
        cipher: aesEncrypt(JSON.stringify(object), key, iv),
        iv,
        salt,
      });
    },
    async decrypt(password, encrypted) {
      const payload = JSON.parse(encrypted) as Payload;
      const key = pbkdf2Hex(password, payload.salt, LEGACY_ITERATIONS);
      return JSON.parse(aesDecrypt(payload.cipher, key, payload.iv));
    },
    async decryptWithDetail(password, encrypted) {
      const payload = JSON.parse(encrypted) as Payload;
      const key = pbkdf2Hex(password, payload.salt, LEGACY_ITERATIONS);
      return {
        vault: JSON.parse(aesDecrypt(payload.cipher, key, payload.iv)),
        exportedKeyString: JSON.stringify({
          version: 1,
          salt: payload.salt,
          key,
        }),
        salt: payload.salt,
      };
    },
    async decryptWithExportedKey(encrypted, exportedKeyString) {
      return decryptWithExportedKey(encrypted, exportedKeyString);
    },
  };
};

export const payloadIterationsOf = (encrypted: string) => {
  return payloadIterations(JSON.parse(encrypted));
};
