import { isNonPublicProductionEnv } from '@/constant';
import { addWatchAddresses } from '@/core/apis/address';
import {
  getPublicAccountSnapshotAccounts,
  hasKeyringPublicAccountSnapshot,
  keyringServiceApi,
} from '@/core/serviceApi/keyring';
import {
  getHomeAssetSelectionSettings,
  setIncludeWatchAddressesInHomeAssetSelection,
} from '@/hooks/appSettings';
import {
  MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES,
  normalizeRegressionWatchAddresses,
} from './regressionScenarios/watchAddressFixturePayload.nonprod';

const MAX_REMOTE_FIXTURE_BYTES = 128 * 1024;
const REMOTE_FIXTURE_TIMEOUT_MS = 20 * 1000;
const MAX_FIXTURE_ID_LENGTH = 160;
const MAX_FIXTURE_URL_LENGTH = 4096;

type ImportProgress = {
  completedCount: number;
  totalCount: number;
};

type FixtureFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type FixtureFetcher = (
  input: string,
  init: RequestInit,
) => Promise<FixtureFetchResponse>;

export type HighCardinalityWatchAddressFixture = {
  fixtureId: string;
  addresses: string[];
};

export type HighCardinalityWatchAddressImportResult = {
  accounts: Array<{ address: string }>;
  fixtureAddressCount: number;
  existingCount: number;
  importedCount: number;
  failedCount: number;
  missingCount: number;
};

async function getVisibleAccountIdentities() {
  const snapshotAccounts = getPublicAccountSnapshotAccounts();
  if (snapshotAccounts.length || hasKeyringPublicAccountSnapshot()) {
    return snapshotAccounts;
  }

  return keyringServiceApi.getAllVisibleAccountsArray();
}

export function normalizeHighCardinalityWatchAddressFixtureUrl(input: string) {
  const value = input.trim();
  if (!value) {
    throw new Error('Enter a benchmark JSON link');
  }
  if (value.length > MAX_FIXTURE_URL_LENGTH) {
    throw new Error('Benchmark JSON link is too long');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Benchmark JSON link is invalid');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Benchmark JSON link must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Benchmark JSON link must not contain credentials');
  }
  return url.toString();
}

export function parseHighCardinalityWatchAddressFixture(
  contents: string,
): HighCardinalityWatchAddressFixture {
  if (contents.length > MAX_REMOTE_FIXTURE_BYTES) {
    throw new Error('Benchmark address fixture exceeds the allowed size');
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error('Benchmark address fixture is not valid JSON');
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Benchmark address fixture must be an object');
  }

  const fixture = value as Record<string, unknown>;
  if (fixture.schemaVersion !== 1) {
    throw new Error('Benchmark address fixture schema is unsupported');
  }
  if (
    typeof fixture.fixtureId !== 'string' ||
    !fixture.fixtureId.trim() ||
    fixture.fixtureId.length > MAX_FIXTURE_ID_LENGTH
  ) {
    throw new Error('Benchmark address fixture identity is invalid');
  }
  if (
    !Number.isInteger(fixture.addressCount) ||
    (fixture.addressCount as number) < 1 ||
    (fixture.addressCount as number) >
      MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES ||
    !Array.isArray(fixture.addresses) ||
    fixture.addresses.length !== fixture.addressCount
  ) {
    throw new Error('Benchmark address fixture count does not match');
  }

  const semantics = fixture.semantics;
  if (
    !semantics ||
    typeof semantics !== 'object' ||
    (semantics as Record<string, unknown>).containsPrivateUserFixtures !== false
  ) {
    throw new Error('Benchmark address fixture privacy marker is missing');
  }

  const addresses = normalizeRegressionWatchAddresses(
    fixture.addresses.map(address => {
      if (typeof address !== 'string') {
        throw new Error('Benchmark address fixture addresses must be strings');
      }
      return address;
    }),
  );
  if (addresses.length !== fixture.addressCount) {
    throw new Error('Benchmark address fixture contains duplicate addresses');
  }

  return {
    fixtureId: fixture.fixtureId,
    addresses,
  };
}

export async function fetchHighCardinalityWatchAddressFixture(
  fixtureUrl: string,
  options: {
    fetcher?: FixtureFetcher;
  } = {},
): Promise<HighCardinalityWatchAddressFixture> {
  if (!isNonPublicProductionEnv) {
    throw new Error('High-cardinality address import is non-production only');
  }
  const url = normalizeHighCardinalityWatchAddressFixtureUrl(fixtureUrl);

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  try {
    const request = (options.fetcher || fetch)(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const response = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Benchmark address fixture request timed out'));
        }, REMOTE_FIXTURE_TIMEOUT_MS);
      }),
    ]);
    if (!response.ok) {
      throw new Error(
        `Benchmark address fixture returned HTTP ${response.status}`,
      );
    }
    return parseHighCardinalityWatchAddressFixture(await response.text());
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Benchmark address fixture request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout!);
  }
}

export async function importHighCardinalityWatchAddresses(
  addresses: string[],
  options: {
    onProgress?: (progress: ImportProgress) => void;
  } = {},
): Promise<HighCardinalityWatchAddressImportResult> {
  if (!isNonPublicProductionEnv) {
    throw new Error('High-cardinality address import is non-production only');
  }

  const normalizedAddresses = normalizeRegressionWatchAddresses(addresses);
  const beforeAccounts = await getVisibleAccountIdentities();
  const existingAddresses = new Set(
    beforeAccounts.map(account => account.address.toLowerCase()),
  );
  const existingCount = normalizedAddresses.filter(address =>
    existingAddresses.has(address),
  ).length;
  const missingAddresses = normalizedAddresses.filter(
    address => !existingAddresses.has(address),
  );
  options.onProgress?.({
    completedCount: existingCount,
    totalCount: normalizedAddresses.length,
  });

  const previousSettings = getHomeAssetSelectionSettings();
  const shouldSuspendWatchSelection =
    missingAddresses.length > 0 && previousSettings.includeWatchAddresses;
  if (shouldSuspendWatchSelection) {
    // Avoid turning one batch import into N Home asset synchronizations. An
    // idempotent import never touches Home selection state.
    setIncludeWatchAddressesInHomeAssetSelection(false);
  }

  try {
    let importedCount = 0;
    let failedCount = 0;
    if (missingAddresses.length) {
      try {
        const importedAddresses = await addWatchAddresses(missingAddresses);
        importedCount = importedAddresses.length;
        failedCount = missingAddresses.length - importedCount;
      } catch {
        failedCount = missingAddresses.length;
      }
    }
    options.onProgress?.({
      completedCount: normalizedAddresses.length,
      totalCount: normalizedAddresses.length,
    });

    const accounts = await getVisibleAccountIdentities();
    const visibleAddresses = new Set(
      accounts.map(account => account.address.toLowerCase()),
    );
    const fixtureAddressCount = normalizedAddresses.filter(address =>
      visibleAddresses.has(address),
    ).length;

    return {
      accounts,
      fixtureAddressCount,
      existingCount,
      importedCount,
      failedCount,
      missingCount: normalizedAddresses.length - fixtureAddressCount,
    };
  } finally {
    if (shouldSuspendWatchSelection) {
      setIncludeWatchAddressesInHomeAssetSelection(true);
    }
  }
}

export async function importHighCardinalityWatchAddressFixtureFromUrl(
  fixtureUrl: string,
  options: {
    onProgress?: (progress: ImportProgress) => void;
  } = {},
) {
  const fixture = await fetchHighCardinalityWatchAddressFixture(fixtureUrl);
  const result = await importHighCardinalityWatchAddresses(fixture.addresses, {
    onProgress: options.onProgress,
  });
  return {
    ...result,
    fixtureId: fixture.fixtureId,
  };
}
