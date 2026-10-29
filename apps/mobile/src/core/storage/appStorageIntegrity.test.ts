import * as Sentry from '@sentry/react-native';
import { getVersion } from 'react-native-device-info';

import {
  captureAppStoragePresence,
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

const ALL_PRESENT = {
  preference: true,
  contactBook: true,
  browser: true,
  dapps: true,
  whitelist: true,
  '@SceneAccounts202512': true,
};

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
    expect(countAliases({})).toEqual({ total: 0, custom: 0 });
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
      parseStoredJsonOrReport('not json', {
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
    expect(reportContext('json_parse_failed')?.extra).toMatchObject({
      fileId: 'test.parse',
      key: 'contactBook',
      rawLength: 19,
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      ADDRESS_A,
    );
  });

  it('reports custom aliases lost between launches, with the previous version', async () => {
    checkContactBookAtStartup({
      presence: ALL_PRESENT,
      accountAddresses: [ADDRESS_A, ADDRESS_B, ADDRESS_C],
      aliases: NAMED_ALIASES,
    });
    await flushReports();
    expect(captureException).not.toHaveBeenCalled();

    nextLaunch('0.6.95', 'new');
    checkContactBookAtStartup({
      presence: { ...ALL_PRESENT, contactBook: false },
      accountAddresses: [ADDRESS_A, ADDRESS_B, ADDRESS_C],
      aliases: {},
    });
    await flushReports();

    expect(reportedIssues()).toEqual([
      'core_store_missing',
      'aliases_empty_with_accounts',
      'aliases_dropped_between_launches',
    ]);
    const dropped = reportContext('aliases_dropped_between_launches');
    expect(dropped.tags.rn_arch).toBe('new');
    expect(dropped.extra).toMatchObject({
      appVersion: '0.6.95',
      previousAppVersion: '0.6.93',
      previousRnArch: 'legacy',
      previousCustomAliasCount: 2,
      customAliasCount: 0,
      accountCount: 3,
      accountsWithoutAlias: 3,
      contactBookPresent: false,
      missingStores: ['contactBook'],
    });

    const sent = JSON.stringify(captureException.mock.calls);
    expect(sent).not.toContain('Main wallet');
    expect(sent).not.toContain(ADDRESS_A);
  });

  it('reports a persisting empty contact book once per app version', async () => {
    const input = {
      presence: ALL_PRESENT,
      accountAddresses: [ADDRESS_A],
      aliases: {},
    };

    checkContactBookAtStartup(input);
    nextLaunch('0.6.93');
    checkContactBookAtStartup(input);
    await flushReports();
    expect(reportedIssues()).toEqual(['aliases_empty_with_accounts']);

    nextLaunch('0.6.96');
    checkContactBookAtStartup(input);
    await flushReports();
    expect(reportedIssues()).toEqual([
      'aliases_empty_with_accounts',
      'aliases_empty_with_accounts',
    ]);
  });

  it('does not report aliases the user removed one by one', async () => {
    checkContactBookAtStartup({
      presence: ALL_PRESENT,
      accountAddresses: [ADDRESS_A, ADDRESS_B],
      aliases: NAMED_ALIASES,
    });
    const withoutA = {
      [ADDRESS_B]: NAMED_ALIASES[ADDRESS_B],
      [ADDRESS_C]: NAMED_ALIASES[ADDRESS_C],
    };
    const withoutAB = { [ADDRESS_C]: NAMED_ALIASES[ADDRESS_C] };
    recordContactBookAliasesChange(withoutA, NAMED_ALIASES);
    recordContactBookAliasesChange(withoutAB, withoutA);

    nextLaunch('0.6.95');
    checkContactBookAtStartup({
      presence: ALL_PRESENT,
      accountAddresses: [ADDRESS_C],
      aliases: withoutAB,
    });
    await flushReports();

    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports several aliases dropped by one write', async () => {
    recordContactBookAliasesChange({}, NAMED_ALIASES);
    await flushReports();

    expect(reportedIssues()).toEqual(['aliases_bulk_dropped']);
    expect(reportContext('aliases_bulk_dropped').extra).toMatchObject({
      previousAliasCount: 3,
      aliasCount: 0,
      previousCustomAliasCount: 2,
      customAliasCount: 0,
    });
  });

  it('reports browser tabs lost between launches but not tabs the user closed', async () => {
    const tabs = [
      { url: 'https://app.uniswap.org' },
      { url: '', initialUrl: 'https://aave.com' },
      { url: 'about:blank' },
    ];
    checkBrowserTabsOnLoad({
      browserStorePresent: true,
      tabs,
      historyCount: 4,
      bookmarkCount: 1,
    });

    nextLaunch('0.6.95');
    checkBrowserTabsOnLoad({
      browserStorePresent: true,
      tabs: [],
      historyCount: 0,
      bookmarkCount: 0,
    });
    await flushReports();
    expect(reportedIssues()).toEqual(['browser_tabs_dropped_between_launches']);
    expect(
      reportContext('browser_tabs_dropped_between_launches').extra,
    ).toMatchObject({
      previousTabCount: 2,
      tabCount: 0,
      previousAppVersion: '0.6.93',
      historyCount: 0,
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain(
      'uniswap',
    );

    captureException.mockClear();
    recordBrowserTabsChange(tabs);
    recordBrowserTabsChange([]);
    nextLaunch('0.6.95');
    checkBrowserTabsOnLoad({
      browserStorePresent: true,
      tabs: [],
      historyCount: 0,
      bookmarkCount: 0,
    });
    await flushReports();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('captures which watched keys exist before services recreate them', () => {
    appMMKV.set('preference', '{}');
    appMMKV.set('contactBook', '{}');

    expect(captureAppStoragePresence()).toEqual({
      preference: true,
      contactBook: true,
      browser: false,
      dapps: false,
      whitelist: false,
      '@SceneAccounts202512': false,
    });
  });
});
