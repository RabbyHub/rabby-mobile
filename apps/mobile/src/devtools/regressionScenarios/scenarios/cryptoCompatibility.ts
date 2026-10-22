import {
  decrypt,
  decryptWithDetail,
  encryptWithDetail,
  importKey,
} from '@metamask/browser-passworder';

import {
  createVaultStrengthEncryptor,
  derivePbkdf2KeyHex,
  derivePbkdf2KeyHexWithAes,
} from '@/core/serviceApi/appEncryptor';

import type { RegressionScenarioExecutionContext } from '../scenarioTypes';

// Public, synthetic test material only. Never read the wallet or accept secrets
// from scenario parameters. The app's normal global.ts installs QuickCrypto.
const TEST_PASSWORD = 'Rabby crypto compatibility fixture only';
const TEST_VALUE = {
  kind: 'crypto-compatibility',
  text: 'Rabby 测试 ✓',
  values: [0, 1, 255],
  version: 1,
};
const TEST_VALUE_JSON = JSON.stringify(TEST_VALUE);

// Generated independently with Node webcrypto: PBKDF2/SHA-256, 10,000
// iterations, AES-256-GCM with a 128-bit tag, salt bytes 0..31 and IV 32..47.
// Fixed salt/IV are for this immutable test vector only; encryptWithDetail below
// retains the production random salt/IV and default derivation parameters.
const NODE_WEBCRYPTO_VECTOR = {
  data: 'FnkgzYGskP/Fg/21FFPj5zt+ARp4rW06v9E9D3sBOZ98Ee69W+U/DAOdKr9FgcavogVBnHRWXwAvUXm4NsAvQ69amSI/iIvyCYq+YvLmlqcbTBo+64z1n5ueP6U+YJnkz5M+xKIeK50=',
  iv: 'ICEiIyQlJicoKSorLC0uLw==',
  salt: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
};

// Vault key derivation (PBKDF2-HMAC-SHA256 over the UTF-8 bytes of the
// password and salt strings). Keys produced by the native Aes.pbkdf2 on an
// Android device; any platform and implementation must reproduce them.
const VAULT_KDF_VECTOR = {
  password: 'Rabby 测试 password',
  salt: 'AAECAwQFBgcICQoLDA0ODw==',
  keys: {
    5000: '18c735ebae001a53ff727c972364f66d1f7e48f404f70d9d0c1b1fe5d88c7043',
    600000: 'c92a4705efec5643c52fbc71c4b57855f2af6e3443e1793f6d9a91a1c3fe41b4',
  },
} as const;
const VAULT_KDF_ITERATIONS = [5000, 600000] as const;

function nowMs() {
  return global.performance?.now?.() ?? Date.now();
}

function randomHex(byteCount: number) {
  const bytes = new Uint8Array(byteCount);
  global.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function timedDerive(
  context: RegressionScenarioExecutionContext,
  implementation: 'quick-crypto' | 'aes',
  password: string,
  salt: string,
  iterations: number,
) {
  const derive =
    implementation === 'aes' ? derivePbkdf2KeyHexWithAes : derivePbkdf2KeyHex;
  const startedAt = nowMs();
  const key = await derive(password, salt, iterations);
  // Timing only; never the key.
  context.report('perf-mark', {
    label: 'vault-kdf',
    implementation,
    iterations,
    durationMs: Math.round(nowMs() - startedAt),
  });
  return key;
}

async function assertCompatibility(
  context: RegressionScenarioExecutionContext,
  assertion: string,
  check: () => boolean | Promise<boolean>,
) {
  context.report('action-started', { action: assertion });
  let passed = false;
  try {
    passed = await check();
  } catch {
    // Emit only the assertion and result, never an encryption result or key.
  }
  context.report('assertion', { assertion, passed });
  if (!passed) {
    throw new Error(`Crypto compatibility assertion failed: ${assertion}`);
  }
}

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  await context.waitForNavigation();
  await assertCompatibility(context, 'crypto-globals-installed', () => {
    return (
      typeof global.Buffer?.from === 'function' &&
      typeof global.crypto?.subtle?.encrypt === 'function' &&
      typeof global.crypto?.subtle?.decrypt === 'function'
    );
  });
  context.report('precondition-ready', { cryptoGlobalsInstalled: true });

  await assertCompatibility(context, 'base64-binary-roundtrip', () => {
    const bytes = [0, 1, 2, 127, 128, 254, 255];
    const encoded = global.Buffer.from(bytes).toString('base64');
    const decoded = global.Buffer.from('AAECf4D+/w==', 'base64');
    return (
      encoded === 'AAECf4D+/w==' &&
      decoded.length === bytes.length &&
      bytes.every((value, index) => decoded[index] === value)
    );
  });

  await assertCompatibility(context, 'base64-sliced-buffer', () => {
    const backing = Uint8Array.of(222, 0, 1, 2, 127, 128, 254, 255, 223);
    const sliced = global.Buffer.from(backing.buffer, 1, 7);
    return sliced.toString('base64') === 'AAECf4D+/w==';
  });

  await assertCompatibility(context, 'base64-unicode-roundtrip', () => {
    return (
      global.Buffer.from(TEST_VALUE.text, 'utf8').toString('base64') ===
        'UmFiYnkg5rWL6K+VIOKckw==' &&
      global.Buffer.from('UmFiYnkg5rWL6K+VIOKckw==', 'base64').toString(
        'utf8',
      ) === TEST_VALUE.text
    );
  });

  await assertCompatibility(
    context,
    'passworder-node-legacy-vector',
    async () => {
      const result = await decryptWithDetail(
        TEST_PASSWORD,
        JSON.stringify(NODE_WEBCRYPTO_VECTOR),
      );
      return JSON.stringify(result.vault) === TEST_VALUE_JSON;
    },
  );

  await assertCompatibility(
    context,
    'passworder-node-metadata-vector',
    async () => {
      const result = await decryptWithDetail(
        TEST_PASSWORD,
        JSON.stringify({
          ...NODE_WEBCRYPTO_VECTOR,
          keyMetadata: {
            algorithm: 'PBKDF2',
            params: { iterations: 10_000 },
          },
        }),
      );
      return JSON.stringify(result.vault) === TEST_VALUE_JSON;
    },
  );

  await assertCompatibility(
    context,
    'passworder-default-roundtrip',
    async () => {
      const encrypted = await encryptWithDetail(TEST_PASSWORD, TEST_VALUE);
      const decrypted = await decryptWithDetail(TEST_PASSWORD, encrypted.vault);
      const exportedKey = await importKey(encrypted.exportedKeyString);
      const decryptedWithKey = await decrypt(
        TEST_PASSWORD,
        encrypted.vault,
        exportedKey,
      );
      return (
        JSON.stringify(decrypted.vault) === TEST_VALUE_JSON &&
        JSON.stringify(decryptedWithKey) === TEST_VALUE_JSON
      );
    },
  );

  await assertCompatibility(
    context,
    'passworder-wrong-password-rejected',
    async () => {
      try {
        await decryptWithDetail(
          `${TEST_PASSWORD}-incorrect`,
          JSON.stringify(NODE_WEBCRYPTO_VECTOR),
        );
        return false;
      } catch (error) {
        return error instanceof Error && error.message === 'Incorrect password';
      }
    },
  );

  for (const iterations of VAULT_KDF_ITERATIONS) {
    await assertCompatibility(
      context,
      `vault-kdf-device-vector-${iterations}`,
      async () => {
        const [quickCryptoKey, aesKey] = [
          await timedDerive(
            context,
            'quick-crypto',
            VAULT_KDF_VECTOR.password,
            VAULT_KDF_VECTOR.salt,
            iterations,
          ),
          await timedDerive(
            context,
            'aes',
            VAULT_KDF_VECTOR.password,
            VAULT_KDF_VECTOR.salt,
            iterations,
          ),
        ];
        const expected = VAULT_KDF_VECTOR.keys[iterations];
        return quickCryptoKey === expected && aesKey === expected;
      },
    );

    await assertCompatibility(
      context,
      `vault-kdf-implementations-match-${iterations}`,
      async () => {
        // Fresh synthetic input shaped like real vault payloads: a base64 salt
        // string and a password with multi-byte UTF-8 (CJK + emoji).
        const password = `${TEST_PASSWORD} 密码 😀 ${randomHex(8)}`;
        const salt = btoa(randomHex(16));
        const quickCryptoKey = await timedDerive(
          context,
          'quick-crypto',
          password,
          salt,
          iterations,
        );
        const aesKey = await timedDerive(
          context,
          'aes',
          password,
          salt,
          iterations,
        );
        return (
          /^[0-9a-f]{64}$/.test(quickCryptoKey) && quickCryptoKey === aesKey
        );
      },
    );
  }

  await assertCompatibility(context, 'vault-encryptor-roundtrip', async () => {
    const encryptor = createVaultStrengthEncryptor();
    const encrypted = await encryptor.encrypt(TEST_PASSWORD, TEST_VALUE);
    const decrypted = await encryptor.decrypt(TEST_PASSWORD, encrypted);
    return (
      encryptor.isVaultUpdated(encrypted) &&
      JSON.stringify(decrypted) === TEST_VALUE_JSON
    );
  });

  context.report('postcondition-ready', { cryptoCompatibilityPassed: true });
}
