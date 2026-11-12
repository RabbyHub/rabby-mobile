import Aes from 'react-native-aes-crypto';
import RNEncryptor, {
  DERIVATION_OPTIONS_OWASP2023,
  KDF_VERSION_ORIGINAL,
  KDF_VERSION_PBKDF2_600000,
  LEGACY_DERIVATION_OPTIONS,
  type KeyDerivationOptions,
} from './encryptor';

// Only the native crypto boundary is replaced. These tests cover the envelope
// version registry, compatibility parsing and metadata normalization.
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
  params: { iterations: 5000 },
};
const strongerMetadata = {
  algorithm: 'PBKDF2' as const,
  params: { iterations: 600000 },
};

// Ciphertext vectors are unchanged by KDF versioning: the same password, salt,
// key and IV produce the same AES-CBC ciphertext.
const fixtures = [
  {
    iterations: 5000,
    kdf: LEGACY_DERIVATION_OPTIONS,
    key: '446561e78f1e7ae32418aedeff6b17e29d2395da8b12d24c9f2bfe7843633ac0',
    encrypted: {
      cipher:
        'sX500q21aXLyKbSHmrSx8dn0/GMgKqqoGlWWdSxDrgJIwqlCsic9n0+5kKCcpw0V',
      iv,
      salt,
      kdf: LEGACY_DERIVATION_OPTIONS,
    },
  },
  {
    iterations: 600000,
    kdf: DERIVATION_OPTIONS_OWASP2023,
    key: 'f5c1f6ccd754b39c7c655759fc590d7cd7f966926906869cef9289975b28b8de',
    encrypted: {
      cipher:
        'OrQXspVasgaoArLYMCh9KPM4OfQyFCarsZiLhglXpBs/x2EiKyJqS4oO6Qvbu7cX',
      iv,
      salt,
      kdf: DERIVATION_OPTIONS_OWASP2023,
    },
  },
] as const;

const invalidKdfMetadata = [
  null,
  {},
  [],
  'PBKDF2',
  { version: 'unknown' },
  { version: KDF_VERSION_ORIGINAL, iterations: 600000 },
  { version: KDF_VERSION_PBKDF2_600000, iterations: 5000 },
  { version: KDF_VERSION_PBKDF2_600000, algorithm: 'scrypt' },
  { version: KDF_VERSION_PBKDF2_600000, hash: 'sha512' },
];

const invalidLegacyMetadata = [
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
    kdf: fixture.kdf,
  };
}

describe('RNEncryptor KDF version registry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes the original version explicitly by default', async () => {
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
  });

  it('writes the dated 600k version only when explicitly configured', async () => {
    jest
      .mocked(Aes.randomKey)
      .mockResolvedValueOnce(saltHex)
      .mockResolvedValueOnce(iv);
    const encryptor = new RNEncryptor({
      keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023,
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

  it('uses the 600k version for a new keyring and inherits the version of existing ciphertext', async () => {
    const encryptor = new RNEncryptor();
    const newKeyring = await encryptor.encryptKeyringState(password, vault);
    const rewrittenNewKeyring = await encryptor.encryptKeyringState(
      password,
      vault,
      newKeyring,
    );
    const rewrittenLegacyKeyring = await encryptor.encryptKeyringState(
      password,
      vault,
      JSON.stringify(fixtures[0].encrypted),
    );

    expect(JSON.parse(newKeyring).kdf).toEqual(DERIVATION_OPTIONS_OWASP2023);
    expect(JSON.parse(rewrittenNewKeyring).kdf).toEqual(
      DERIVATION_OPTIONS_OWASP2023,
    );
    expect(JSON.parse(rewrittenLegacyKeyring).kdf).toEqual(
      LEGACY_DERIVATION_OPTIONS,
    );
    expect(jest.mocked(Aes.pbkdf2).mock.calls.map(call => call[2])).toEqual([
      600000, 600000, 5000,
    ]);
  });

  it('rejects invalid existing keyring metadata instead of using the new-wallet policy', async () => {
    await expect(
      new RNEncryptor().encryptKeyringState(
        password,
        vault,
        '{"keyMetadata":{}}',
      ),
    ).rejects.toThrow('Unsupported RNEncryptor key derivation options');
    await expect(
      new RNEncryptor().encryptKeyringState(
        password,
        vault,
        '{"kdf":{"version":"unknown"}}',
      ),
    ).rejects.toThrow('Unsupported RNEncryptor KDF version');
    expect(Aes.pbkdf2).not.toHaveBeenCalled();
  });

  it.each([5000, 600000] as const)(
    'reads both registered versions when configured for %i',
    async configuredIterations => {
      const encryptor =
        configuredIterations === 5000
          ? new RNEncryptor()
          : new RNEncryptor({
              keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023,
            });

      for (const fixture of fixtures) {
        await expect(
          encryptor.decrypt(password, JSON.stringify(fixture.encrypted)),
        ).resolves.toEqual(vault);
      }
    },
  );

  it('reads unversioned original payloads', async () => {
    const encrypted = {
      cipher: fixtures[0].encrypted.cipher,
      iv: fixtures[0].encrypted.iv,
      salt: fixtures[0].encrypted.salt,
    };

    await expect(
      new RNEncryptor().decrypt(password, JSON.stringify(encrypted)),
    ).resolves.toEqual(vault);
    expect(Aes.pbkdf2).toHaveBeenCalledTimes(1);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      salt,
      5000,
      256,
      'sha256',
    );
  });

  it('reads the previous draft keyMetadata format as its registered version', async () => {
    const encrypted = {
      cipher: fixtures[1].encrypted.cipher,
      iv: fixtures[1].encrypted.iv,
      salt: fixtures[1].encrypted.salt,
      keyMetadata: strongerMetadata,
    };

    await expect(
      new RNEncryptor().decrypt(password, JSON.stringify(encrypted)),
    ).resolves.toEqual(vault);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      salt,
      600000,
      256,
      'sha256',
    );
  });

  it.each(['decrypt', 'decryptWithDetail'] as const)(
    'does not retry a wrong legacy password at 600k through %s',
    async method => {
      const encrypted = {
        cipher: fixtures[0].encrypted.cipher,
        iv,
        salt,
      };
      const encryptor = new RNEncryptor({
        keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023,
      });

      await expect(
        encryptor[method]('incorrect password', JSON.stringify(encrypted)),
      ).rejects.toThrow();
      expect(Aes.pbkdf2).toHaveBeenCalledTimes(1);
      expect(Aes.pbkdf2).toHaveBeenCalledWith(
        'incorrect password',
        salt,
        5000,
        256,
        'sha256',
      );
    },
  );

  it('does not infer 600k from an unversioned payload', async () => {
    const encrypted = {
      cipher: fixtures[1].encrypted.cipher,
      iv: fixtures[1].encrypted.iv,
      salt: fixtures[1].encrypted.salt,
    };
    await expect(
      new RNEncryptor().decryptWithDetail(password, JSON.stringify(encrypted)),
    ).rejects.toThrow();
    expect(Aes.pbkdf2).toHaveBeenCalledTimes(1);
    expect(Aes.pbkdf2).toHaveBeenCalledWith(
      password,
      salt,
      5000,
      256,
      'sha256',
    );
  });

  it.each(fixtures)(
    'derives the $iterations-iteration key once per decryptWithDetail',
    async fixture => {
      const detail = await new RNEncryptor().decryptWithDetail(
        password,
        JSON.stringify(fixture.encrypted),
      );

      expect(detail.vault).toEqual(vault);
      expect(detail.kdfVersion).toBe(fixture.kdf.version);
      expect(jest.mocked(Aes.pbkdf2)).toHaveBeenCalledTimes(1);
      expect(jest.mocked(Aes.pbkdf2)).toHaveBeenLastCalledWith(
        password,
        salt,
        fixture.iterations,
        256,
        'sha256',
      );
    },
  );

  it.each(fixtures)(
    'rejects a wrong password for the $iterations-iteration vault',
    async fixture => {
      await expect(
        new RNEncryptor().decrypt(
          'incorrect password',
          JSON.stringify(fixture.encrypted),
        ),
      ).rejects.toThrow();
    },
  );

  it('isolates configured metadata from later caller mutation', async () => {
    const options = {
      keyDerivationOptions: {
        ...DERIVATION_OPTIONS_OWASP2023,
      },
    };
    const encryptor = new RNEncryptor(options);
    options.keyDerivationOptions.iterations = 5000;

    const encrypted = await encryptor.encrypt(password, vault);

    expect(JSON.parse(encrypted).kdf).toEqual(DERIVATION_OPTIONS_OWASP2023);
    expect(jest.mocked(Aes.pbkdf2).mock.calls[0][2]).toBe(600000);
  });

  it.each(invalidKdfMetadata)(
    'rejects invalid encryption options %j before native work',
    keyDerivationOptions => {
      expect(
        () =>
          new RNEncryptor({
            keyDerivationOptions:
              keyDerivationOptions as unknown as KeyDerivationOptions,
          }),
      ).toThrow();
      expect(Aes.randomKey).not.toHaveBeenCalled();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.encrypt).not.toHaveBeenCalled();
    },
  );

  it.each([...invalidKdfMetadata, ...invalidLegacyMetadata])(
    'rejects invalid payload metadata %j before native derivation',
    async metadata => {
      const encrypted = JSON.stringify({
        ...fixtures[0].encrypted,
        kdf: 'version' in Object(metadata) ? undefined : metadata,
        keyMetadata: metadata,
      });

      await expect(
        new RNEncryptor().decrypt(password, encrypted),
      ).rejects.toThrow();
      expect(Aes.pbkdf2).not.toHaveBeenCalled();
      expect(Aes.decrypt).not.toHaveBeenCalled();
    },
  );
});

describe('RNEncryptor upgrade policy', () => {
  it.each(fixtures)(
    'treats the $iterations-iteration payload as current for the 5k target',
    fixture => {
      expect(
        new RNEncryptor().isVaultUpdated(JSON.stringify(fixture.encrypted)),
      ).toBe(true);
    },
  );

  it.each(fixtures)(
    'requests an upgrade only for older versions when targeting $iterations',
    fixture => {
      const encryptor = new RNEncryptor({
        keyDerivationOptions: DERIVATION_OPTIONS_OWASP2023,
      });

      expect(encryptor.isVaultUpdated(JSON.stringify(fixture.encrypted))).toBe(
        fixture.iterations === 600000,
      );
    },
  );

  it('does not rewrite payloads with unknown versions', () => {
    const encrypted = JSON.stringify({
      ...fixtures[0].encrypted,
      kdf: { version: 'future' },
    });

    expect(new RNEncryptor().isVaultUpdated(encrypted)).toBe(true);
  });
});

describe('RNEncryptor metadata normalization', () => {
  it('adds the original version without changing ciphertext, IV or salt', () => {
    const encrypted = {
      cipher: fixtures[0].encrypted.cipher,
      iv: fixtures[0].encrypted.iv,
      salt: fixtures[0].encrypted.salt,
    };
    const encryptor = new RNEncryptor();
    const normalized = encryptor.normalizeKdfMetadata(
      JSON.stringify(encrypted),
      KDF_VERSION_ORIGINAL,
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(normalized!)).toEqual(fixtures[0].encrypted);
    expect(encryptor.normalizeKdfMetadata(normalized!)).toBeNull();
    expect(
      encryptor.normalizeKdfMetadata(JSON.stringify(encrypted)),
    ).toBeNull();
  });

  it('promotes previous keyMetadata to the registered version marker', () => {
    const encrypted = {
      cipher: fixtures[1].encrypted.cipher,
      iv: fixtures[1].encrypted.iv,
      salt: fixtures[1].encrypted.salt,
      keyMetadata: strongerMetadata,
    };
    const normalized = new RNEncryptor().normalizeKdfMetadata(
      JSON.stringify(encrypted),
    );

    expect(normalized).not.toBeNull();
    expect(JSON.parse(normalized!)).toEqual(fixtures[1].encrypted);
  });

  it('leaves versioned and invalid payloads untouched', () => {
    expect(
      new RNEncryptor().normalizeKdfMetadata(
        JSON.stringify(fixtures[0].encrypted),
      ),
    ).toBeNull();
    expect(new RNEncryptor().normalizeKdfMetadata('not JSON')).toBeNull();
  });
});

describe('RNEncryptor exported-key compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(fixtures)(
    'decrypts a $iterations-iteration vault with its exported key',
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

  it('accepts previous-draft exported-key metadata', async () => {
    await expect(
      new RNEncryptor().decryptWithExportedKey(
        JSON.stringify({
          cipher: fixtures[1].encrypted.cipher,
          iv: fixtures[1].encrypted.iv,
          salt: fixtures[1].encrypted.salt,
          keyMetadata: strongerMetadata,
        }),
        JSON.stringify({
          version: 1,
          salt,
          key: fixtures[1].key,
          keyMetadata: strongerMetadata,
        }),
      ),
    ).resolves.toEqual(vault);
  });

  it('rejects mismatched versions and salts before native decryption', async () => {
    await expect(
      new RNEncryptor().decryptWithExportedKey(
        JSON.stringify(fixtures[0].encrypted),
        JSON.stringify({
          ...exportedFixture(fixtures[0]),
          kdf: DERIVATION_OPTIONS_OWASP2023,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      new RNEncryptor().decryptWithExportedKey(
        JSON.stringify(fixtures[1].encrypted),
        JSON.stringify({ ...exportedFixture(fixtures[1]), salt: 'other-salt' }),
      ),
    ).rejects.toThrow();
    expect(Aes.pbkdf2).not.toHaveBeenCalled();
    expect(Aes.decrypt).not.toHaveBeenCalled();
  });
});

describe('KDF version exports', () => {
  it('keeps the public version ids stable', () => {
    expect(KDF_VERSION_ORIGINAL).toBe('original');
    expect(KDF_VERSION_PBKDF2_600000).toBe('20261022');
  });
});
