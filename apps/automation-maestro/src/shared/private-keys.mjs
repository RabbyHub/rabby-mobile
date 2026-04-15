const DEFAULT_PRIVATE_KEYS_ENV_NAME = 'RABBY_ANDROID_TEST_PRIVATE_KEYS';
const LEGACY_PRIVATE_KEY_ENV_NAME = 'RABBY_ANDROID_TEST_PRIVATE_KEY';

function parsePrivateKeys(rawValue) {
  return rawValue
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

export function resolvePrivateKeys({
  privateKeysEnvName = DEFAULT_PRIVATE_KEYS_ENV_NAME,
  fallbackPrivateKeyEnvName = LEGACY_PRIVATE_KEY_ENV_NAME,
} = {}) {
  const rawPrivateKeys = process.env[privateKeysEnvName]?.trim();
  if (rawPrivateKeys) {
    const privateKeys = parsePrivateKeys(rawPrivateKeys);
    if (privateKeys.length > 0) {
      return {
        privateKeys,
        sourceEnvName: privateKeysEnvName,
      };
    }
  }

  const legacyPrivateKey = process.env[fallbackPrivateKeyEnvName]?.trim();
  if (legacyPrivateKey) {
    return {
      privateKeys: [legacyPrivateKey],
      sourceEnvName: fallbackPrivateKeyEnvName,
    };
  }

  throw new Error(
    `[maestro] ${privateKeysEnvName} is required in shell env, .env, or .env.local. Legacy fallback ${fallbackPrivateKeyEnvName} is still accepted for a single key.`,
  );
}

export function buildPrivateKeyEnv({
  privateKey,
  allPrivateKeys = [privateKey],
  privateKeyEnvName = LEGACY_PRIVATE_KEY_ENV_NAME,
  privateKeysEnvName = DEFAULT_PRIVATE_KEYS_ENV_NAME,
}) {
  return {
    [privateKeyEnvName]: privateKey,
    [privateKeysEnvName]: allPrivateKeys.join(';'),
  };
}

