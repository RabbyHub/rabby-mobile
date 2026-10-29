import * as Sentry from '@sentry/react-native';
import { getVersion } from 'react-native-device-info';

import {
  captureAppStorageStartupSnapshot,
  checkBrowserTabsOnLoad,
  checkContactBookAtStartup,
  countAliases,
  parseStoredJsonOrReport,
  recordBrowserTabsChange,
  recordContactBookAliasesChange,
  resetAppStorageIntegrityStateForTests,
} from './appStorageIntegrity';
import { appMMKV, storageDiagnosticsMMKV } from './mmkvInstances';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const ADDRESS_C = '0x3333333333333333333333333333333333333333';

const NAMED_ALIASES = {
  [ADDRESS_A]: { address: ADDRESS_A, alias: 'Main wallet' },
  [ADDRESS_B]: { address: ADDRESS_B, alias: 'Ledger savings' },
  [ADDRESS_C]: { address: ADDRESS_C, alias: '0x333333...333333' },
};

const DEFAULT_ALIASES = {
  [ADDRESS_A]: { address: ADDRESS_A, alias: '0x111111...111111' },
  [ADDRESS_B]: { address: ADDRESS_B, alias: '0x222222...222222' },
  [ADDRESS_C]: { address: ADDRESS_C, alias: '0x333333...333333' },
};

const WATCHED_KEYS = [
  'preference',
  'contactBook',
  'browser',
  'dapps',
  'whitelist',
  '@SceneAccounts202512',
];

const captureException = Sentry.captureException as jest.Mock;
const mockedGetVersion = getVersion as jest.Mock;

const archGlobals = globalThis as typeof globalThis & {
  nativeFabricUIManager?: unknown;
  RN$Bridgeless?: boolean;
};
const jestFabricUIManager = archGlobals.nativeFabricUIManager;

function setArchitecture(arch: 'new' | 'legacy') {
  delete archGlobals.RN$Bridgeless;
  if (arch === 'new') {
    archGlobals.nativeFabricUIManager = jestFabricUIManager ?? {};
  } else {
    delete archGlobals.nativeFabricUIManager;
  }
}

/** Puts the watched keys on disk, except the given ones. */
function seedAppStorage(except: string[] = []) {
  appMMKV.clearAll();
  WATCHED_KEYS.filter(key => !except.includes(key)).forEach(key => {
    appMMKV.set(key, '{}');
  });
}

async function flushReports() {
  await new Promise(resolve => setImmediate(resolve));
}

function reportedIssues() {
  return captureException.mock.calls.map(
    ([, context]) => context.tags.app_storage_integrity,
  );
}

function reportContext(issue: string) {
  const call = captureException.mock.calls.find(
    ([, context]) => context.tags.app_storage_integrity === issue,
  );
  return call?.[1];
}

/** Simulates the next cold start: per-session memory is gone, files remain. */
function nextLaunch(version: string, arch: 'new' | 'legacy' = 'legacy') {
  resetAppStorageIntegrityStateForTests();
  mockedGetVersion.mockReturnValue(version);
  setArchitecture(arch);
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  appMMKV.clearAll();
  storageDiagnosticsMMKV.clearAll();
  captureException.mockClear();
  nextLaunch('0.6.93');
});

afterEach(() => {
  warnSpy.mockRestore();
});

afterAll(() => {
  mockedGetVersion.mockReturnValue('0.0.0-test');
  archGlobals.nativeFabricUIManager = jestFabricUIManager;
});

describe('appStorageIntegrity', () => {
  it('counts only user-written aliases as custom', () => {
    expect(countAliases(NAMED_ALIASES)).toEqual({ total: 3, custom: 2 });
    expect(countAliases(DEFAULT_ALIASES)).toEqual({ total: 3, custom: 0 });
    expect(countAliases({})).toEqual({ total: 0, custom: 0 });
  });

  it('snapshots missing keys once per launch, counting keys only when needed', () => {
    seedAppStorage();
    expect(captureAppStorageStartupSnapshot()).toEqual({ missingStores: [] });

    nextLaunch('0.6.93');
    seedAppStorage(['contactBook', 'browser']);
    const snapshot = captureAppStorageStartupSnapshot();
    expect(snapshot).toEqual({
      missingStores: ['contactBook', 'browser'],
      appStorageKeyCount: 4,
    });

    // A service recreating the key later does not change this launch's view.
    appMMKV.set('contactBook', '{}');
    expect(captureAppStorageStartupSnapshot()).toBe(snapshot);
  });

  it('reports a stored value that is no longer valid JSON', async () => {
    const source = { fileId: 'test.parse', key: 'contactBook' };
    const truncated = '{"aliases":{"0x1111';

    expect(parseStoredJsonOrReport('{"aliases":{}}', source)).toEqual({
      aliases: {},
    });
    expect(parseStoredJsonOrReport('null', source)).toBeNull();
    expect(parseStoredJsonOrReport(truncated, source)).toBeNull();
    expect(
      parseStoredJsonOrReport('\u0000\u0000x�', {
        fileId: 'test.parse',
        key: `token_${ADDRESS_A}`,
      }),
    ).toBeNull();
    // Same key again in the same session is not reported twice.
    expect(parseStoredJsonOrReport(truncated, source)).toBeNull();
    await flushReports();

    expect(reportedIssues()).toEqual([
      'json_parse_failed',
      'json_parse_failed',
    ]);
    const [truncatedReport, corruptedReport] = captureException.mock.calls.map(
      ([, context]) => context,
    );
    expect(truncatedReport.tags.app_storage_scope).toBe(
      'test.parse/contactBook',
    );
    expect(truncatedReport.extra).toEqual({
      rawLength: 19,
      firstChar: '{',
      lastChar: 'other',
      replacementCharCount: 0,
      nulCharCount: 0,
    });
    expect(corruptedReport.tags.app_storage_scope).toBe(
      'test.parse/token_0x<address>',
    );
    expect(corruptedReport.extra).toEqual({
      rawLength: 4,
      firstChar: 'other',
      lastChar: 'other',
      replacementCharCount: 1,
      nulCharCount: 2,
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      ADDRESS_A,
    );
  });

  it('reports custom aliases lost between launches, with the previous version', async () => {
    seedAppStorage();
    checkContactBookAtStartup({ isBootedWallet: true, aliases: NAMED_ALIASES });
    await flushReports();
    expect(captureException).not.toHaveBeenCalled();

    nextLaunch('0.6.95', 'new');
    seedAppStorage(['contactBook']);
    checkContactBookAtStartup({ isBootedWallet: true, aliases: {} });
    await flushReports();

    expect(reportedIssues()).toEqual([
      'core_store_missing',
      'aliases_dropped_between_launches',
    ]);
    expect(reportContext('core_store_missing').extra).toEqual({
      missingStores: ['contactBook'],
      appStorageKeyCount: 5,
    });
    const dropped = reportContext('aliases_dropped_between_launches');
    expect(dropped.tags.rn_arch).toBe('new');
    expect(dropped.extra).toEqual({
      previousAppVersion: '0.6.93',
      previousRnArch: 'legacy',
      customAliasCount: 0,
      aliasCount: 0,
      missingStores: ['contactBook'],
      appStorageKeyCount: 5,
    });

    const sent = JSON.stringify(captureException.mock.calls);
    expect(sent).not.toContain('Main wallet');
    expect(sent).not.toContain(ADDRESS_A);
  });

  it('tells names reset to defaults apart from an emptied contact book', async () => {
    seedAppStorage();
    checkContactBookAtStartup({ isBootedWallet: true, aliases: NAMED_ALIASES });

    nextLaunch('0.6.95');
    seedAppStorage();
    checkContactBookAtStartup({
      isBootedWallet: true,
      aliases: DEFAULT_ALIASES,
    });
    await flushReports();

    expect(reportContext('aliases_dropped_between_launches').extra).toEqual({
      previousAppVersion: '0.6.93',
      previousRnArch: 'legacy',
      customAliasCount: 0,
      aliasCount: 3,
      missingStores: [],
    });
  });

  it('does not report accounts without aliases on their own', async () => {
    // Seed phrases created from the add-address sheet and extension sync can
    // leave accounts without any alias.
    seedAppStorage();
    checkContactBookAtStartup({ isBootedWallet: true, aliases: {} });
    await flushReports();

    expect(captureException).not.toHaveBeenCalled();
  });

  it('does not report missing stores on a first launch', async () => {
    checkContactBookAtStartup({ isBootedWallet: false, aliases: {} });
    await flushReports();

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a persisting missing store once per app version', async () => {
    const launch = () => {
      seedAppStorage(['contactBook']);
      checkContactBookAtStartup({ isBootedWallet: true, aliases: {} });
    };

    launch();
    nextLaunch('0.6.93');
    launch();
    await flushReports();
    expect(reportedIssues()).toEqual(['core_store_missing']);

    nextLaunch('0.6.96');
    launch();
    await flushReports();
    expect(reportedIssues()).toEqual([
      'core_store_missing',
      'core_store_missing',
    ]);
  });

  it('does not report aliases the user removed one by one', async () => {
    seedAppStorage();
    checkContactBookAtStartup({ isBootedWallet: true, aliases: NAMED_ALIASES });
    const withoutA = {
      [ADDRESS_B]: NAMED_ALIASES[ADDRESS_B],
      [ADDRESS_C]: NAMED_ALIASES[ADDRESS_C],
    };
    const withoutAB = { [ADDRESS_C]: NAMED_ALIASES[ADDRESS_C] };
    recordContactBookAliasesChange(withoutA, NAMED_ALIASES);
    recordContactBookAliasesChange(withoutAB, withoutA);

    nextLaunch('0.6.95');
    seedAppStorage();
    checkContactBookAtStartup({ isBootedWallet: true, aliases: withoutAB });
    await flushReports();

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports several aliases dropped by one write, deleted or overwritten', async () => {
    recordContactBookAliasesChange({}, NAMED_ALIASES);
    await flushReports();
    expect(reportContext('aliases_bulk_dropped').extra).toEqual({
      removedAliasCount: 3,
      removedCustomAliasCount: 2,
    });

    nextLaunch('0.6.95');
    captureException.mockClear();
    recordContactBookAliasesChange(DEFAULT_ALIASES, NAMED_ALIASES);
    await flushReports();
    expect(reportContext('aliases_bulk_dropped').extra).toEqual({
      removedAliasCount: 0,
      removedCustomAliasCount: 2,
    });
  });

  it('reports browser tabs lost between launches but not tabs the user closed', async () => {
    const tabs = [
      { url: 'https://app.uniswap.org' },
      { url: '', initialUrl: 'https://aave.com' },
      { url: 'about:blank' },
    ];
    seedAppStorage();
    checkBrowserTabsOnLoad({ tabs, historyCount: 4, bookmarkCount: 1 });

    nextLaunch('0.6.95');
    seedAppStorage(['browser']);
    checkBrowserTabsOnLoad({ tabs: [], historyCount: 0, bookmarkCount: 0 });
    await flushReports();
    expect(reportedIssues()).toEqual(['browser_tabs_dropped_between_launches']);
    expect(
      reportContext('browser_tabs_dropped_between_launches').extra,
    ).toEqual({
      previousAppVersion: '0.6.93',
      previousRnArch: 'legacy',
      tabCount: 0,
      historyCount: 0,
      bookmarkCount: 0,
      missingStores: ['browser'],
      appStorageKeyCount: 5,
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      'uniswap',
    );

    captureException.mockClear();
    recordBrowserTabsChange(tabs);
    recordBrowserTabsChange([]);
    nextLaunch('0.6.95');
    seedAppStorage();
    checkBrowserTabsOnLoad({ tabs: [], historyCount: 0, bookmarkCount: 0 });
    await flushReports();
    expect(captureException).not.toHaveBeenCalled();
  });
});
