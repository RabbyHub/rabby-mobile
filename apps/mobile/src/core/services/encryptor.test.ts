import Aes from 'react-native-aes-crypto';
import RNEncryptor from './encryptor';

// Unit coverage for RNEncryptor's wire format and derivation policy. Only the
// native boundary is replaced; this does not verify iOS/Android bridge behavior.
jest.mock('react-native-aes-crypto', () => {
  const crypto: typeof import('node:crypto') = require('node:crypto');
  const { Buffer } = require('node:buffer');

  return {
    randomKey: jest.fn(async (length: number) =>
      crypto.randomBytes(length).toString('hex'),
    ),
    pbkdf2: jest.fn(
      async (
        password: string,
        salt: string,
        iterations: number,
        length: number,
        algorithm: string,
      ) =>
        crypto
          .pbkdf2Sync(password, salt, iterations, length / 8, algorithm)
          .toString('hex'),
    ),
    encrypt: jest.fn(
      async (text: string, key: string, iv: string, algorithm: string) => {
        const cipher = crypto.createCipheriv(
          algorithm,
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          cipher.update(text, 'utf8'),
          cipher.final(),
        ]).toString('base64');
      },
    ),
    decrypt: jest.fn(
      async (text: string, key: string, iv: string, algorithm: string) => {
        const decipher = crypto.createDecipheriv(
          algorithm,
          Buffer.from(key, 'hex'),
          Buffer.from(iv, 'hex'),
        );
        return Buffer.concat([
          decipher.update(text, 'base64'),
          decipher.final(),
        ]).toString('utf8');
      },
    ),
  };
});

const password = 'test-only password 🔐';
const vault = { mnemonic: 'test-only mnemonic', accounts: [] };
const saltHex = '000102030405060708090a0b0c0d0e0f';
const salt = 'MDAwMTAyMDMwNDA1MDYwNzA4MDkwYTBiMGMwZDBlMGY=';
const iv = '101112131415161718191a1b1c1d1e1f';
const legacyMetadata = {
  algorithm: 'PBKDF2' as const,
  params: { iterations: 5000 as const },
};
const strongerMetadata = {
  algorithm: 'PBKDF2' as const,
  params: { iterations: 600000 as const },
};

// Fixed independently using Python hashlib.pbkdf2_hmac('sha256', ..., 32)
// and OpenSSL enc -aes-256-cbc with PKCS#7 padding. Salt is the UTF-8 base64
// representation of hex random bytes, preserving the pre-existing wire format.
// The 600k vector uses hashlib.pbkdf2_hmac('sha256', password.encode(),
// salt.encode(), 600000, 32), then openssl enc -aes-256-cbc -K <key hex>
// -iv 101112131415161718191a1b1c1d1e1f -base64 -A on JSON.stringify(vault).
const fixtures = [
  {
    iterations: 5000,
    key: '446561e78f1e7ae32418aedeff6b17e29d2395da8b12d24c9f2bfe7843633ac0',
    encrypted: {
      cipher:
        'sX500q21aXLyKbSHmrSx8dn0/GMgKqqoGlWWdSxDrgJIwqlCsic9n0+5kKCcpw0V',
      iv,
      salt,
    },
  },
  {
    iterations: 600000,
    key: 'f5c1f6ccd754b39c7c655759fc590d7cd7f966926906869cef9289975b28b8de',
    encrypted: {
      cipher:
        'OrQXspVasgaoArLYMCh9KPM4OfQyFCarsZiLhglXpBs/x2EiKyJqS4oO6Qvbu7cX',
      iv,
      salt,
      keyMetadata: strongerMetadata,
    },
  },
] as const;

const invalidMetadata = [
  null,
  {},
  [],
  'PBKDF2',
  { algorithm: 'scrypt', params: { iterations: 600000 } },
  { algorithm: 'PBKDF2' },
  { algorithm: 'PBKDF2', params: null },
  { algorithm: 'PBKDF2', params: {} },
  { algorithm: 'PBKDF2', params: { iterations: '600000' } },
  { algorithm: 'PBKDF2', params: { iterations: 0 } },
  { algorithm: 'PBKDF2', params: { iterations: 5000.5 } },
  { algorithm: 'PBKDF2', params: { iterations: 60000 } },
  { algorithm: 'PBKDF2', params: { iterations: 600001 } },
  { algorithm: 'PBKDF2', params: { iterations: Number.MAX_SAFE_INTEGER } },
];

function exportedFixture(fixture: (typeof fixtures)[number]) {
  return {
    version: 1,
    salt,
    key: fixture.key,
    ...(fixture.iterations === 600000 ? { keyMetadata: strongerMetadata } : {}),
  };
}

describe('RNEncryptor PBKDF2 compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the default at 5,000 iterations and preserves the legacy payload', async () => {
    jest
      .mocked(Aes.randomKey)
      .mockResolvedValueOnce(saltHex)
      .mockResolvedValueOnce(iv);

    const encrypted = await new RNEncryptor().encrypt(password, vault);

    expect(JSON.parse(encrypted)).toEqual(fixtures[0].encrypted);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      salt,
      5000,
      256,
      'sha256',
    );
    expect(Aes.encrypt).toHaveBeenCalledWith(
      JSON.stringify(vault),
      fixtures[0].key,
      iv,
      'aes-256-cbc',
    );
    expect(Aes.randomKey).toHaveBeenNthCalledWith(1, 16);
    expect(Aes.randomKey).toHaveBeenNthCalledWith(2, 16);
  });

  it('writes 600,000-iteration metadata only when explicitly configured', async () => {
    jest
      .mocked(Aes.randomKey)
      .mockResolvedValueOnce(saltHex)
      .mockResolvedValueOnce(iv);
    const encryptor = new RNEncryptor({
      keyDerivationOptions: strongerMetadata,
    });

    const encrypted = await encryptor.encrypt(password, vault);

    expect(JSON.parse(encrypted)).toEqual(fixtures[1].encrypted);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      salt,
      600000,
      256,
      'sha256',
    );
  });

  describe.each([5000, 600000] as const)(
    'with %i iterations configured for new encryption',
    configuredIterations => {
      it.each(fixtures)(
        'reads the fixed $iterations-iteration vault using its payload metadata',
        async fixture => {
          const encryptor =
            configuredIterations === 5000
              ? new RNEncryptor()
              : new RNEncryptor({
                  keyDerivationOptions: strongerMetadata,
                });
          const encrypted = JSON.stringify(fixture.encrypted);

          await expect(encryptor.decrypt(password, encrypted)).resolves.toEqual(
            vault,
          );
          const detail = await encryptor.decryptWithDetail(password, encrypted);

          expect(detail.vault).toEqual(vault);
          expect(detail.salt).toBe(salt);
          expect(JSON.parse(detail.exportedKeyString)).toEqual(
            exportedFixture(fixture),
          );
          expect(Aes.pbkdf2).toHaveBeenCalledTimes(2);
          expect(Aes.pbkdf2).toHaveBeenLastCalledWith(
            password,
            salt,
            fixture.iterations,
            256,
            'sha256',
          );
        },
      );
    },
  );

  it.each(fixtures)(
    'rejects a wrong password for the $iterations-iteration vault',
    async fixture => {
      const encryptor = new RNEncryptor();
      const encrypted = JSON.stringify(fixture.encrypted);

      await expect(
        encryptor.decrypt('incorrect password', encrypted),
      ).rejects.toThrow();
      await expect(
        encryptor.decryptWithDetail('incorrect password', encrypted),
      ).rejects.toThrow();
    },
  );

  it.each([legacyMetadata, strongerMetadata])(
    'uses fresh salt and IV for every encryption with %j',
    async keyDerivationOptions => {
      const encryptor = new RNEncryptor({ keyDerivationOptions });
      const first = JSON.parse(await encryptor.encrypt(password, vault));
      const second = JSON.parse(await encryptor.encrypt(password, vault));

      expect(first.salt).not.toBe(second.salt);
      expect(first.iv).not.toBe(second.iv);
      expect(first.cipher).not.toBe(second.cipher);
      expect(atob(first.salt)).toMatch(/^[0-9a-f]{32}$/);
      expect(first.iv).toMatch(/^[0-9a-f]{32}$/);
      await expect(
        encryptor.decrypt(password, JSON.stringify(second)),
      ).resolves.toEqual(vault);
    },
  );

  it('isolates the configured iteration count from later caller mutation', async () => {
    const options = {
      keyDerivationOptions: {
        algorithm: 'PBKDF2' as const,
        params: { iterations: 600000 as 5000 | 600000 },
      },
    };
    const encryptor = new RNEncryptor(options);
    options.keyDerivationOptions.params.iterations = 5000;

    const encrypted = await encryptor.encrypt(password, vault);

    expect(JSON.parse(encrypted).keyMetadata).toEqual(strongerMetadata);
    expect(jest.mocked(Aes.pbkdf2).mock.calls[0][2]).toBe(600000);
  });

  it.each(invalidMetadata)(
    'rejects invalid encryption options %j before native work',
    keyDerivationOptions => {
      expect(
        () =>
          new RNEncryptor({
            keyDerivationOptions:
              keyDerivationOptions as typeof strongerMetadata,
          }),
      ).toThrow();
      expect(Aes.randomKey).not.toHaveBeenCalled();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.encrypt).not.toHaveBeenCalled();
    },
  );

  it.each(invalidMetadata)(
    'rejects invalid vault metadata %j before native derivation or decryption',
    async keyMetadata => {
      const encryptor = new RNEncryptor();
      const encrypted = JSON.stringify({
        ...fixtures[0].encrypted,
        keyMetadata,
      });

      await expect(encryptor.decrypt(password, encrypted)).rejects.toThrow();
      await expect(
        encryptor.decryptWithDetail(password, encrypted),
      ).rejects.toThrow();
      await expect(
        encryptor.decryptWithExportedKey(
          encrypted,
          JSON.stringify(exportedFixture(fixtures[0])),
        ),
      ).rejects.toThrow();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.decrypt).not.toHaveBeenCalled();
    },
  );
});

describe('RNEncryptor vault upgrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(fixtures)(
    'keeps a $iterations-iteration vault when the configured target is 5,000',
    fixture => {
      expect(
        new RNEncryptor().isVaultUpdated(JSON.stringify(fixture.encrypted)),
      ).toBe(true);
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.encrypt).not.toHaveBeenCalled();
      expect(Aes.decrypt).not.toHaveBeenCalled();
    },
  );

  it.each(fixtures)(
    'only requests an upgrade for weaker vaults with $iterations stored iterations',
    fixture => {
      const encryptor = new RNEncryptor({
        keyDerivationOptions: strongerMetadata,
      });

      expect(encryptor.isVaultUpdated(JSON.stringify(fixture.encrypted))).toBe(
        fixture.iterations === 600000,
      );
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
    },
  );

  it.each(invalidMetadata)(
    'rejects malformed metadata %j when checking whether to upgrade',
    keyMetadata => {
      const encrypted = JSON.stringify({
        ...fixtures[0].encrypted,
        keyMetadata,
      });

      expect(() => new RNEncryptor().isVaultUpdated(encrypted)).toThrow();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid JSON when checking whether to upgrade', () => {
    expect(() => new RNEncryptor().isVaultUpdated('not JSON')).toThrow();
  });

  it.each(fixtures)(
    'returns the $iterations-iteration ciphertext and its exported key from one derivation',
    async fixture => {
      jest
        .mocked(Aes.randomKey)
        .mockResolvedValueOnce(saltHex)
        .mockResolvedValueOnce(iv);
      const encryptor =
        fixture.iterations === 5000
          ? new RNEncryptor()
          : new RNEncryptor({ keyDerivationOptions: strongerMetadata });

      const detail = await encryptor.encryptWithDetail(password, vault);

      expect(JSON.parse(detail.vault)).toEqual(fixture.encrypted);
      expect(JSON.parse(detail.exportedKeyString)).toEqual(
        exportedFixture(fixture),
      );
      expect(Aes.pbkdf2).toHaveBeenCalledTimes(1);
      expect(Aes.pbkdf2).toHaveBeenCalledWith(
        password,
        salt,
        fixture.iterations,
        256,
        'sha256',
      );
      await expect(
        new RNEncryptor().decryptWithExportedKey(
          detail.vault,
          detail.exportedKeyString,
        ),
      ).resolves.toEqual(vault);
      expect(Aes.pbkdf2).toHaveBeenCalledTimes(1);
      await expect(
        new RNEncryptor().decrypt(password, detail.vault),
      ).resolves.toEqual(vault);
    },
  );

  it('uses a fresh salt and IV when creating replacement vaults and keys', async () => {
    const encryptor = new RNEncryptor({
      keyDerivationOptions: strongerMetadata,
    });
    const first = await encryptor.encryptWithDetail(password, vault);
    const second = await encryptor.encryptWithDetail(password, vault);
    const firstEncrypted = JSON.parse(first.vault);
    const secondEncrypted = JSON.parse(second.vault);

    expect(firstEncrypted.salt).not.toBe(secondEncrypted.salt);
    expect(firstEncrypted.iv).not.toBe(secondEncrypted.iv);
    expect(JSON.parse(first.exportedKeyString).key).not.toBe(
      JSON.parse(second.exportedKeyString).key,
    );
    expect(Aes.pbkdf2).toHaveBeenCalledTimes(2);
    await expect(
      encryptor.decryptWithExportedKey(second.vault, second.exportedKeyString),
    ).resolves.toEqual(vault);
    expect(Aes.pbkdf2).toHaveBeenCalledTimes(2);
  });
});

describe('RNEncryptor exported-key compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(fixtures)(
    'decrypts a $iterations-iteration vault with its exported key without PBKDF2',
    async fixture => {
      await expect(
        new RNEncryptor().decryptWithExportedKey(
          JSON.stringify(fixture.encrypted),
          JSON.stringify(exportedFixture(fixture)),
        ),
      ).resolves.toEqual(vault);

      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.decrypt).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['vault', 'exportedKey'] as const)(
    'normalizes absent and explicit legacy metadata on the %s',
    async target => {
      const encrypted = {
        ...fixtures[0].encrypted,
        ...(target === 'vault' ? { keyMetadata: legacyMetadata } : {}),
      };
      const exportedKey = {
        ...exportedFixture(fixtures[0]),
        ...(target === 'exportedKey' ? { keyMetadata: legacyMetadata } : {}),
      };

      await expect(
        new RNEncryptor().decryptWithExportedKey(
          JSON.stringify(encrypted),
          JSON.stringify(exportedKey),
        ),
      ).resolves.toEqual(vault);
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
    },
  );

  it.each(fixtures)(
    'rejects mismatched derivation metadata despite equal salt for $iterations iterations',
    async fixture => {
      const mismatchedKey = {
        version: 1,
        salt,
        key: fixture.key,
        ...(fixture.iterations === 5000
          ? { keyMetadata: strongerMetadata }
          : {}),
      };

      await expect(
        new RNEncryptor().decryptWithExportedKey(
          JSON.stringify(fixture.encrypted),
          JSON.stringify(mismatchedKey),
        ),
      ).rejects.toThrow();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.decrypt).not.toHaveBeenCalled();
    },
  );

  it('rejects an exported key from another salt before native decryption', async () => {
    await expect(
      new RNEncryptor().decryptWithExportedKey(
        JSON.stringify(fixtures[1].encrypted),
        JSON.stringify({ ...exportedFixture(fixtures[1]), salt: 'other-salt' }),
      ),
    ).rejects.toThrow();
    expect(Aes.pbkdf2).not.toHaveBeenCalled();
    expect(Aes.decrypt).not.toHaveBeenCalled();
  });

  it.each(invalidMetadata)(
    'rejects invalid exported-key metadata %j before native decryption',
    async keyMetadata => {
      await expect(
        new RNEncryptor().decryptWithExportedKey(
          JSON.stringify(fixtures[0].encrypted),
          JSON.stringify({ ...exportedFixture(fixtures[0]), keyMetadata }),
        ),
      ).rejects.toThrow();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.decrypt).not.toHaveBeenCalled();
    },
  );
});
