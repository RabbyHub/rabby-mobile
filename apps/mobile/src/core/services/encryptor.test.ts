import crypto from 'crypto';

import RNEncryptor, {
  DERIVATION_OPTIONS_OWASP2023,
  derivePbkdf2KeyHex,
  derivePbkdf2KeyHexWithAes,
  getPayloadDerivationOptions,
  LEGACY_DERIVATION_OPTIONS,
} from './encryptor';

// Unit contract for the payload format. react-native-aes-crypto and
// react-native-quick-crypto are native modules, so both are replaced with Node
// crypto using the same primitives as the device implementations: PBKDF2-HMAC-SHA256 over the UTF-8 bytes of the
// password and salt strings, hex keys/IVs, AES-256-CBC with base64 output.
// The PBKDF2 output was cross-checked on an Android device (spongycastle
// PKCS5S2, as used by the native module) for 5,000 and 600,000 iterations.
jest.mock('react-native-aes-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto') as typeof crypto;
  const pbkdf2 = jest.fn(
    async (
      password: string,
      salt: string,
      cost: number,
      length: number,
      algorithm: string,
    ) =>
      nodeCrypto
        .pbkdf2Sync(
          Buffer.from(password, 'utf8'),
          Buffer.from(salt, 'utf8'),
          cost,
          length / 8,
          algorithm,
        )
        .toString('hex'),
  );
  return {
    __esModule: true,
    default: {
      pbkdf2,
      randomKey: async (length: number) =>
        nodeCrypto.randomBytes(length).toString('hex'),
      encrypt: async (text: string, key: string, iv: string) => {
        const cipher = nodeCrypto.createCipheriv(
          'aes-256-cbc',
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          cipher.update(text, 'utf8'),
          cipher.final(),
        ]).toString('base64');
      },
      decrypt: async (cipherText: string, key: string, iv: string) => {
        const decipher = nodeCrypto.createDecipheriv(
          'aes-256-cbc',
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          decipher.update(Buffer.from(cipherText, 'base64')),
          decipher.final(),
        ]).toString('utf8');
      },
    },
  };
});

// react-native-quick-crypto's pbkdf2 is native too. Node's crypto.pbkdf2 has
// the same callback signature and also hashes string inputs as UTF-8.
jest.mock('react-native-quick-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto') as typeof crypto;
  return {
    __esModule: true,
    pbkdf2: jest.fn((...args: Parameters<typeof nodeCrypto.pbkdf2>) =>
      nodeCrypto.pbkdf2(...args),
    ),
  };
});

import Aes from 'react-native-aes-crypto';
import { pbkdf2 as quickCryptoPbkdf2 } from 'react-native-quick-crypto';

const aesPbkdf2Mock = Aes.pbkdf2 as jest.Mock;
const pbkdf2Mock = quickCryptoPbkdf2 as unknown as jest.Mock;

// Output of the native Aes.pbkdf2 on an Android device (spongycastle
// PKCS5S2, SHA-256, 256 bits) for these inputs.
const DEVICE_VECTOR = {
  password: 'Rabby 测试 password',
  salt: 'AAECAwQFBgcICQoLDA0ODw==',
  keys: {
    5000: '18c735ebae001a53ff727c972364f66d1f7e48f404f70d9d0c1b1fe5d88c7043',
    600000: 'c92a4705efec5643c52fbc71c4b57855f2af6e3443e1793f6d9a91a1c3fe41b4',
  },
} as const;

const FIXTURE_PASSWORD = 'Rabby legacy fixture password';
const FIXTURE_VAULT = [
  {
    type: 'Simple Key Pair',
    // Public test key 1. Never real funds.
    data: ['0000000000000000000000000000000000000000000000000000000000000001'],
  },
  {
    type: 'Watch Address',
    data: { accounts: ['0x000000000000000000000000000000000000dead'] },
  },
];
// Exactly what the shipped encryptor writes: 5,000 iterations, no keyMetadata.
const SHIPPED_LEGACY_VAULT = JSON.stringify({
  cipher:
    'xvrBxQDiHGxsusfjxw0kVR379BNbyvBqnviJ2hz9giLEx09fPc3vrsdeDWTfrjSZXUFuvXCBxGEivae7qBdF1tKLAgE/PrgZwx3b5fS/F3n4x2kqyqFhDECX3FbJHMsMztj0lHoSu5EELFZGf7mNmPYfXA8nUuElP8SXWLNqEynhuVGyJCy/sdK7WXKP6hbBkAVQWwnNk8MHWuLIw8/OoqNmEbjRORvuNJSVjZTDBMs2UCxKrIkUjh2OmNM/4g4l9+s0V5XQHu2aj1MUTET65w==',
  iv: '101112131415161718191a1b1c1d1e1f',
  salt: 'MDAwMTAyMDMwNDA1MDYwNzA4MDkwYTBiMGMwZDBlMGY=',
});

/** The shipped decrypt: ignores keyMetadata and always derives 5,000. */
async function shippedLegacyDecrypt(password: string, encrypted: string) {
  const payload = JSON.parse(encrypted);
  const key = crypto
    .pbkdf2Sync(
      Buffer.from(password, 'utf8'),
      Buffer.from(payload.salt, 'utf8'),
      5000,
      32,
      'sha256',
    )
    .toString('hex');
  return JSON.parse(await Aes.decrypt(payload.cipher, key, payload.iv, 'cbc'));
}

const vaultEncryptor = () =>
  new RNEncryptor({ keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023 });
const legacyEncryptor = () =>
  new RNEncryptor({ keyDerivationOptions: LEGACY_DERIVATION_OPTIONS });

beforeEach(() => {
  pbkdf2Mock.mockClear();
  aesPbkdf2Mock.mockClear();
});

describe('RNEncryptor KDF compatibility', () => {
  describe('reading data written by the shipped app', () => {
    it('decrypts a payload without keyMetadata with 5,000 iterations', async () => {
      await expect(
        vaultEncryptor().decrypt(FIXTURE_PASSWORD, SHIPPED_LEGACY_VAULT),
      ).resolves.toStrictEqual(FIXTURE_VAULT);
      expect(pbkdf2Mock).toHaveBeenCalledTimes(1);
      expect(pbkdf2Mock.mock.calls[0][2]).toBe(5000);
    });

    it('decryptWithDetail returns a key that opens the same payload', async () => {
      const encryptor = vaultEncryptor();
      const detail = await encryptor.decryptWithDetail(
        FIXTURE_PASSWORD,
        SHIPPED_LEGACY_VAULT,
      );
      expect(detail.vault).toStrictEqual(FIXTURE_VAULT);
      await expect(
        encryptor.decryptWithExportedKey(
          SHIPPED_LEGACY_VAULT,
          detail.exportedKeyString,
        ),
      ).resolves.toStrictEqual(FIXTURE_VAULT);
    });

    it('reports the shipped payload as needing an upgrade', () => {
      expect(vaultEncryptor().isVaultUpdated(SHIPPED_LEGACY_VAULT)).toBe(false);
      expect(legacyEncryptor().isVaultUpdated(SHIPPED_LEGACY_VAULT)).toBe(true);
    });

    it('rejects a wrong password', async () => {
      await expect(
        vaultEncryptor().decrypt('wrong password', SHIPPED_LEGACY_VAULT),
      ).rejects.toThrow();
    });
  });

  describe('writing new payloads', () => {
    it('derives with 600k iterations and records them in keyMetadata', async () => {
      const encryptor = vaultEncryptor();
      const encrypted = await encryptor.encrypt(
        FIXTURE_PASSWORD,
        FIXTURE_VAULT,
      );
      const payload = JSON.parse(encrypted);

      expect(pbkdf2Mock.mock.calls[0][2]).toBe(600_000);
      expect(payload.keyMetadata).toStrictEqual({
        algorithm: 'PBKDF2',
        params: { iterations: 600_000 },
      });
      expect(encryptor.isVaultUpdated(encrypted)).toBe(true);

      pbkdf2Mock.mockClear();
      await expect(
        encryptor.decrypt(FIXTURE_PASSWORD, encrypted),
      ).resolves.toStrictEqual(FIXTURE_VAULT);
      expect(pbkdf2Mock.mock.calls[0][2]).toBe(600_000);
    });

    it('a legacy-configured encryptor keeps the exact shipped payload shape', async () => {
      const encrypted = await legacyEncryptor().encrypt(
        FIXTURE_PASSWORD,
        FIXTURE_VAULT,
      );

      expect(Object.keys(JSON.parse(encrypted))).toStrictEqual([
        'cipher',
        'iv',
        'salt',
      ]);
      expect(pbkdf2Mock.mock.calls[0][2]).toBe(5000);
      await expect(
        shippedLegacyDecrypt(FIXTURE_PASSWORD, encrypted),
      ).resolves.toStrictEqual(FIXTURE_VAULT);
    });
  });

  describe('old app reading 600k payloads (downgrade)', () => {
    it('cannot decrypt them with the password', async () => {
      const encrypted = await vaultEncryptor().encrypt(
        FIXTURE_PASSWORD,
        FIXTURE_VAULT,
      );
      await expect(
        shippedLegacyDecrypt(FIXTURE_PASSWORD, encrypted),
      ).rejects.toThrow();
    });

    it('can still use an exported key, whose format is unchanged', async () => {
      const encryptor = vaultEncryptor();
      const encrypted = await encryptor.encrypt(
        FIXTURE_PASSWORD,
        FIXTURE_VAULT,
      );
      const { exportedKeyString } = await encryptor.decryptWithDetail(
        FIXTURE_PASSWORD,
        encrypted,
      );
      expect(Object.keys(JSON.parse(exportedKeyString))).toStrictEqual([
        'version',
        'salt',
        'key',
      ]);
      // The shipped decryptWithExportedKey is unchanged: salt check + AES.
      await expect(
        legacyEncryptor().decryptWithExportedKey(encrypted, exportedKeyString),
      ).resolves.toStrictEqual(FIXTURE_VAULT);
    });
  });

  describe('keyMetadata validation', () => {
    const withMetadata = (keyMetadata: unknown) =>
      JSON.stringify({ ...JSON.parse(SHIPPED_LEGACY_VAULT), keyMetadata });

    it.each([
      ['an unknown algorithm', { algorithm: 'scrypt', params: { N: 1 } }],
      [
        'too few iterations',
        { algorithm: 'PBKDF2', params: { iterations: 1 } },
      ],
      [
        'too many iterations',
        { algorithm: 'PBKDF2', params: { iterations: 1e9 } },
      ],
      [
        'non-integer iterations',
        { algorithm: 'PBKDF2', params: { iterations: 6000.5 } },
      ],
      ['missing params', { algorithm: 'PBKDF2' }],
      ['null', null],
    ])('rejects %s without deriving', async (_label, keyMetadata) => {
      await expect(
        vaultEncryptor().decrypt(FIXTURE_PASSWORD, withMetadata(keyMetadata)),
      ).rejects.toThrow('Unsupported key derivation options');
      expect(pbkdf2Mock).not.toHaveBeenCalled();
      expect(aesPbkdf2Mock).not.toHaveBeenCalled();
      // Never treated as rewritable.
      expect(vaultEncryptor().isVaultUpdated(withMetadata(keyMetadata))).toBe(
        true,
      );
    });

    it('treats a stronger payload as up to date so it is never weakened', () => {
      const stronger = withMetadata({
        algorithm: 'PBKDF2',
        params: { iterations: 900_000 },
      });
      expect(vaultEncryptor().isVaultUpdated(stronger)).toBe(true);
      expect(getPayloadDerivationOptions(JSON.parse(stronger))).toStrictEqual({
        algorithm: 'PBKDF2',
        params: { iterations: 900_000 },
      });
    });

    it('treats unparseable input as not rewritable', () => {
      expect(vaultEncryptor().isVaultUpdated('not json')).toBe(true);
      expect(vaultEncryptor().isVaultUpdated('null')).toBe(true);
    });

    it('rejects invalid constructor options', () => {
      expect(
        () =>
          new RNEncryptor({
            keyDerivationOptions: {
              algorithm: 'PBKDF2',
              params: { iterations: 100 },
            },
          }),
      ).toThrow('Unsupported key derivation options');
    });
  });
  describe('key derivation implementation', () => {
    it.each([5000, 600000] as const)(
      'QuickCrypto matches the device Aes.pbkdf2 vector at %i iterations',
      async iterations => {
        const key = await derivePbkdf2KeyHex(
          DEVICE_VECTOR.password,
          DEVICE_VECTOR.salt,
          iterations,
        );
        expect(key).toBe(DEVICE_VECTOR.keys[iterations]);
        expect(pbkdf2Mock).toHaveBeenCalledTimes(1);
        expect(pbkdf2Mock.mock.calls[0].slice(0, 5)).toStrictEqual([
          DEVICE_VECTOR.password,
          DEVICE_VECTOR.salt,
          iterations,
          32,
          'sha256',
        ]);
        expect(aesPbkdf2Mock).not.toHaveBeenCalled();
      },
    );

    it.each([5000, 600000] as const)(
      'the Aes.pbkdf2 test double reproduces the device vector at %i iterations',
      async iterations => {
        expect(
          await derivePbkdf2KeyHexWithAes(
            DEVICE_VECTOR.password,
            DEVICE_VECTOR.salt,
            iterations,
          ),
        ).toBe(DEVICE_VECTOR.keys[iterations]);
      },
    );

    it('encryption and decryption derive through QuickCrypto only', async () => {
      const encryptor = vaultEncryptor();
      const encrypted = await encryptor.encrypt(
        FIXTURE_PASSWORD,
        FIXTURE_VAULT,
      );
      await encryptor.decrypt(FIXTURE_PASSWORD, encrypted);
      await encryptor.decrypt(FIXTURE_PASSWORD, SHIPPED_LEGACY_VAULT);

      expect(pbkdf2Mock).toHaveBeenCalledTimes(3);
      expect(aesPbkdf2Mock).not.toHaveBeenCalled();
    });

    it('falls back to Aes.pbkdf2 with the same result if QuickCrypto fails', async () => {
      pbkdf2Mock.mockImplementationOnce((...args: unknown[]) => {
        const callback = args[5] as (error: Error) => void;
        callback(new Error('native module unavailable'));
      });

      expect(
        await derivePbkdf2KeyHex(
          DEVICE_VECTOR.password,
          DEVICE_VECTOR.salt,
          5000,
        ),
      ).toBe(DEVICE_VECTOR.keys[5000]);
      expect(aesPbkdf2Mock).toHaveBeenCalledTimes(1);
    });

    it('falls back to Aes.pbkdf2 if QuickCrypto throws synchronously', async () => {
      pbkdf2Mock.mockImplementationOnce(() => {
        throw new Error('JSI not installed');
      });

      expect(
        await derivePbkdf2KeyHex(
          DEVICE_VECTOR.password,
          DEVICE_VECTOR.salt,
          5000,
        ),
      ).toBe(DEVICE_VECTOR.keys[5000]);
      expect(aesPbkdf2Mock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a lone high surrogate', 'pass\uD83Dword'],
      ['a lone low surrogate', 'pass\uDE00word'],
    ])('keeps Aes.pbkdf2 for a password with %s', async (_label, password) => {
      await derivePbkdf2KeyHex(password, DEVICE_VECTOR.salt, 5000);
      expect(pbkdf2Mock).not.toHaveBeenCalled();
      expect(aesPbkdf2Mock).toHaveBeenCalledTimes(1);
    });

    it('uses QuickCrypto for passwords with paired surrogates (emoji)', async () => {
      await derivePbkdf2KeyHex('pass😀word', DEVICE_VECTOR.salt, 5000);
      expect(pbkdf2Mock).toHaveBeenCalledTimes(1);
      expect(aesPbkdf2Mock).not.toHaveBeenCalled();
    });
  });
});
