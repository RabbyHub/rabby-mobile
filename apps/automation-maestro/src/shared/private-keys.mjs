const DEFAULT_PRIVATE_KEYS_ENV_NAME = 'RABBY_MAESTRO_TEST_PRIVATE_KEYS';
const DEFAULT_PRIVATE_KEY_ENV_NAME = 'RABBY_MAESTRO_TEST_PRIVATE_KEY';
const LEGACY_PRIVATE_KEYS_ENV_NAMES = ['RABBY_ANDROID_TEST_PRIVATE_KEYS'];
const LEGACY_PRIVATE_KEY_ENV_NAMES = ['RABBY_ANDROID_TEST_PRIVATE_KEY'];

function parsePrivateKeys(rawValue) {
  return rawValue
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

export function resolvePrivateKeys({
  privateKeysEnvName = DEFAULT_PRIVATE_KEYS_ENV_NAME,
  fallbackPrivateKeyEnvName = DEFAULT_PRIVATE_KEY_ENV_NAME,
} = {}) {
  const privateKeysEnvNames = [
    privateKeysEnvName,
    ...LEGACY_PRIVATE_KEYS_ENV_NAMES.filter(name => name !== privateKeysEnvName),
  ];

  for (const envName of privateKeysEnvNames) {
    const rawPrivateKeys = process.env[envName]?.trim();
    if (!rawPrivateKeys) {
      continue;
    }

    const privateKeys = parsePrivateKeys(rawPrivateKeys);
    if (privateKeys.length > 0) {
      return {
        privateKeys,
        sourceEnvName: envName,
      };
    }
  }

  const privateKeyEnvNames = [
    fallbackPrivateKeyEnvName,
    ...LEGACY_PRIVATE_KEY_ENV_NAMES.filter(
      name => name !== fallbackPrivateKeyEnvName,
    ),
  ];

  for (const envName of privateKeyEnvNames) {
    const privateKey = process.env[envName]?.trim();
    if (!privateKey) {
      continue;
    }

    return {
      privateKeys: [privateKey],
      sourceEnvName: envName,
    };
  }

  throw new Error(
    `[maestro] ${privateKeysEnvName} is required in shell env, .env, or .env.local. Single-key fallback ${fallbackPrivateKeyEnvName} is still accepted, and legacy Android-prefixed private-key envs remain supported.`,
  );
}

export function buildPrivateKeyEnv({
  privateKey,
  allPrivateKeys = [privateKey],
  privateKeyEnvName = DEFAULT_PRIVATE_KEY_ENV_NAME,
  privateKeysEnvName = DEFAULT_PRIVATE_KEYS_ENV_NAME,
}) {
  const env = {
    [privateKeyEnvName]: privateKey,
    [privateKeysEnvName]: allPrivateKeys.join(';'),
  };

  for (const envName of [
    DEFAULT_PRIVATE_KEY_ENV_NAME,
    ...LEGACY_PRIVATE_KEY_ENV_NAMES,
  ]) {
    env[envName] = privateKey;
  }

  for (const envName of [
    DEFAULT_PRIVATE_KEYS_ENV_NAME,
    ...LEGACY_PRIVATE_KEYS_ENV_NAMES,
  ]) {
    env[envName] = allPrivateKeys.join(';');
  }

  return env;
}
