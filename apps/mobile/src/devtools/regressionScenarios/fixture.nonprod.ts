import RNFS from '@rabby-wallet/react-native-fs';

const FIXTURE_DIRECTORY = 'rabby-regression-fixtures';
const MAX_FIXTURE_BYTES = 128 * 1024;
const PRIVATE_KEY_PATTERN = /(?:0x)?[a-fA-F0-9]{64}/g;
const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;

export const MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES = 100;

export type RegressionWalletFixture = {
  privateKeys: string[];
  seedPhrases: string[];
};

export type RegressionWatchAddressFixture = {
  addresses: string[];
};

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseFixtureJson(value: unknown): RegressionWalletFixture {
  if (!value || typeof value !== 'object') {
    throw new Error('Fixture JSON must be an object');
  }

  const fixture = value as Record<string, unknown>;
  const wallets = Array.isArray(fixture.wallets) ? fixture.wallets : [];
  const walletPrivateKeys: string[] = [];
  const walletSeedPhrases: string[] = [];
  wallets.forEach(wallet => {
    if (!wallet || typeof wallet !== 'object') {
      return;
    }
    const item = wallet as Record<string, unknown>;
    if (typeof item.privateKey === 'string') {
      walletPrivateKeys.push(item.privateKey);
    }
    if (typeof item.mnemonic === 'string') {
      walletSeedPhrases.push(item.mnemonic);
    }
    if (typeof item.seedPhrase === 'string') {
      walletSeedPhrases.push(item.seedPhrase);
    }
  });

  return {
    privateKeys: unique([
      ...readStringArray(fixture.privateKeys),
      ...walletPrivateKeys,
    ]),
    seedPhrases: unique([
      ...readStringArray(fixture.mnemonics),
      ...readStringArray(fixture.seedPhrases),
      ...walletSeedPhrases,
    ]),
  };
}

function parseFixtureText(contents: string): RegressionWalletFixture {
  const trimmed = contents.trim();
  if (trimmed.startsWith('{')) {
    return parseFixtureJson(JSON.parse(trimmed));
  }

  return {
    privateKeys: unique(trimmed.match(PRIVATE_KEY_PATTERN) || []),
    seedPhrases: [],
  };
}

function normalizeWatchAddresses(addresses: string[]) {
  const normalized = addresses.map(address => address.trim().toLowerCase());
  if (normalized.some(address => !/^0x[a-f0-9]{40}$/.test(address))) {
    throw new Error('Watch-address fixture contains an invalid EVM address');
  }

  const uniqueAddresses = [...new Set(normalized)];
  if (!uniqueAddresses.length) {
    throw new Error('Watch-address fixture contains no EVM addresses');
  }
  if (uniqueAddresses.length > MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES) {
    throw new Error(
      `Watch-address fixture exceeds ${MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES} addresses`,
    );
  }
  return uniqueAddresses;
}

function parseWatchAddressFixtureJson(
  value: unknown,
): RegressionWatchAddressFixture {
  if (!value || typeof value !== 'object') {
    throw new Error('Watch-address fixture JSON must be an object');
  }

  const fixture = value as Record<string, unknown>;
  const rankedFixtures = Array.isArray(fixture.fixtures)
    ? fixture.fixtures
    : undefined;
  const rawAddresses =
    fixture.addresses ??
    fixture.watchAddresses ??
    rankedFixtures?.map(item => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      return (item as Record<string, unknown>).address;
    });
  if (!Array.isArray(rawAddresses)) {
    throw new Error(
      'Watch-address fixture must define an addresses array or ranked fixtures',
    );
  }
  if (rawAddresses.some(address => typeof address !== 'string')) {
    throw new Error('Watch-address fixture addresses must be strings');
  }

  return {
    addresses: normalizeWatchAddresses(rawAddresses),
  };
}

export function parseRegressionWatchAddressFixture(
  contents: string,
): RegressionWatchAddressFixture {
  const trimmed = contents.trim();
  // A Watch-address probe must never accept a wallet fixture by accident.
  // Otherwise a 0x-prefixed private key would also match the first 40 hex
  // characters of the address pattern below.
  if (PRIVATE_KEY_PATTERN.test(trimmed)) {
    PRIVATE_KEY_PATTERN.lastIndex = 0;
    throw new Error('Watch-address fixture must not contain private keys');
  }
  PRIVATE_KEY_PATTERN.lastIndex = 0;

  if (trimmed.startsWith('{')) {
    return parseWatchAddressFixtureJson(JSON.parse(trimmed));
  }

  return {
    addresses: normalizeWatchAddresses(
      trimmed.match(EVM_ADDRESS_PATTERN) || [],
    ),
  };
}

function getFixtureCandidates(fixtureId: string) {
  const roots = [RNFS.ExternalDirectoryPath, RNFS.DocumentDirectoryPath].filter(
    (path): path is string => !!path,
  );
  const extensions = ['json', 'txt', 'fixture'];

  return roots.flatMap(root =>
    extensions.map(
      extension => `${root}/${FIXTURE_DIRECTORY}/${fixtureId}.${extension}`,
    ),
  );
}

async function consumeRegressionFixtureContents(fixtureId: string) {
  const candidates = getFixtureCandidates(fixtureId);
  const path = (
    await Promise.all(
      candidates.map(async candidate => ({
        candidate,
        exists: await RNFS.exists(candidate).catch(() => false),
      })),
    )
  ).find(result => result.exists)?.candidate;

  if (!path) {
    throw new Error(`Fixture "${fixtureId}" was not staged`);
  }

  const stat = await RNFS.stat(path);
  if (Number(stat.size) > MAX_FIXTURE_BYTES) {
    await RNFS.unlink(path).catch(() => undefined);
    throw new Error('Fixture exceeds the allowed size');
  }

  try {
    return await RNFS.readFile(path, 'utf8');
  } finally {
    await RNFS.unlink(path).catch(() => undefined);
  }
}

export async function consumeRegressionWalletFixture(fixtureId: string) {
  let contents = await consumeRegressionFixtureContents(fixtureId);

  const fixture = parseFixtureText(contents);
  contents = '';
  if (!fixture.privateKeys.length && !fixture.seedPhrases.length) {
    throw new Error('Fixture contains no supported wallet secrets');
  }
  return fixture;
}

export async function consumeRegressionWatchAddressFixture(fixtureId: string) {
  let contents = await consumeRegressionFixtureContents(fixtureId);
  const fixture = parseRegressionWatchAddressFixture(contents);
  contents = '';
  return fixture;
}
