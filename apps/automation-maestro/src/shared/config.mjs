import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { maestroRoot, resolveFromMaestro, toFileHref } from './paths.mjs';

const require = createRequire(import.meta.url);

const DEFAULT_CONFIG = Object.freeze({
  maestro: {
    binary: null,
    env: {},
  },
  android: {
    sharedFixtureFile: 'flows.fixture.local.json',
    onboardingImportPrivateKey: {
      packageName: 'com.debank.rabbymobile.debug',
      appPassword: '11111111',
      privateKeysEnvName: 'RABBY_ANDROID_TEST_PRIVATE_KEYS',
      privateKeyEnvName: 'RABBY_ANDROID_TEST_PRIVATE_KEY',
      flowFile: 'flows/android-onboarding-import-private-key.yaml',
      launchActivity: null,
      maestroEnv: {},
    },
    homeImportPrivateKey: {
      flowFile: 'flows/android-home-import-private-key.yaml',
      maestroEnv: {},
    },
    homeBalanceSmoke: {
      flowFile: 'flows/android-home-balance-smoke.yaml',
      maestroEnv: {},
    },
    singleHomeBalanceSmoke: {
      flowFile: 'flows/android-onboarding-import-private-key-to-single-home.yaml',
      maestroEnv: {},
    },
    homeAddWatchAddress: {
      flowFile: 'flows/android-home-add-watch-address.yaml',
      maestroEnv: {
        WATCH_ADDRESS_QUERY: 'jjlin.eth',
      },
    },
    components2024ShowcaseSmoke: {
      flowFile: 'flows/android-components2024-showcase-smoke.yaml',
      maestroEnv: {},
    },
    sendSmoke: {
      flowFile: 'flows/android-send-smoke.yaml',
      bootstrapFlowFile: 'flows/android-home-ready-existing-user.yaml',
      fixtureFile: null,
      maestroEnv: {},
    },
  },
});

const CONFIG_FILENAMES = [
  'maestro.config.local.mjs',
  'maestro.config.local.js',
  'maestro.config.local.cjs',
  'maestro.config.local.json',
  'maestro.config.mjs',
  'maestro.config.js',
  'maestro.config.cjs',
  'maestro.config.json',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base, override) {
  const output = { ...base };

  for (const [key, value] of Object.entries(override ?? {})) {
    const previous = output[key];

    if (isPlainObject(previous) && isPlainObject(value)) {
      output[key] = mergeConfig(previous, value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

async function readConfigFile(filePath) {
  const extension = path.extname(filePath);

  if (extension === '.json') {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  if (extension === '.cjs') {
    return require(filePath);
  }

  const imported = await import(toFileHref(filePath));
  return imported.default ?? imported;
}

function resolveCandidateFiles() {
  const explicitPath = process.env.RABBY_MAESTRO_CONFIG?.trim();
  if (explicitPath) {
    return [path.resolve(maestroRoot, explicitPath)];
  }

  return CONFIG_FILENAMES.map(filename => resolveFromMaestro(filename));
}

export async function loadMaestroConfig() {
  const defaults = structuredClone(DEFAULT_CONFIG);

  for (const filePath of resolveCandidateFiles()) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const loaded = await readConfigFile(filePath);
    return mergeConfig(defaults, loaded ?? {});
  }

  return defaults;
}

export function resolveMaestroFile(filePath) {
  if (!filePath) {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return resolveFromMaestro(filePath);
}
