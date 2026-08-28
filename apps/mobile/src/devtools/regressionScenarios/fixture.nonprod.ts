import RNFS from '@rabby-wallet/react-native-fs';

const FIXTURE_DIRECTORY = 'rabby-regression-fixtures';
const MAX_FIXTURE_BYTES = 128 * 1024;
const PRIVATE_KEY_PATTERN = /(?:0x)?[a-fA-F0-9]{64}/g;

export type RegressionWalletFixture = {
  privateKeys: string[];
  seedPhrases: string[];
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

export async function consumeRegressionWalletFixture(fixtureId: string) {
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

  let contents = '';
  try {
    contents = await RNFS.readFile(path, 'utf8');
  } finally {
    await RNFS.unlink(path).catch(() => undefined);
  }

  const fixture = parseFixtureText(contents);
  contents = '';
  if (!fixture.privateKeys.length && !fixture.seedPhrases.length) {
    throw new Error('Fixture contains no supported wallet secrets');
  }
  return fixture;
}
