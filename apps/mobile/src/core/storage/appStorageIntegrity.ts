import { getVersion } from 'react-native-device-info';

import {
  APP_MMKV_WEAK_KEYS,
  STORAGE_DIAGNOSTICS_MMKV_KEYS,
} from './mmkvConstants';
import { appMMKV, storageDiagnosticsMMKV } from './mmkvInstances';
import { APP_STORE_NAMES } from './storeConstant';

/**
 * Sentry diagnostics for unexpected loss of user data kept in `mmkv.default`,
 * such as wallet aliases and open browser tabs.
 *
 * Reports carry storage key names and counts only. They never include
 * addresses, alias text, URLs or stored values.
 */

export type AppStorageIntegrityIssue =
  /** A stored value exists but is not valid JSON, so it reads as empty. */
  | 'json_parse_failed'
  /** A booted wallet starts without `preference` or `contactBook`. */
  | 'core_store_missing'
  /** A booted wallet starts with accounts but no alias at all. */
  | 'aliases_empty_with_accounts'
  /** Fewer custom aliases than the previous launch recorded. */
  | 'aliases_dropped_between_launches'
  /** One write removed or reset several aliases at once. */
  | 'aliases_bulk_dropped'
  /** No browser tabs although the previous launch recorded some. */
  | 'browser_tabs_dropped_between_launches';

type RuntimeArchitecture = 'new' | 'legacy';

type CountCanary = {
  appVersion: string;
  rnArch: RuntimeArchitecture;
  updatedAt: number;
  count: number;
  totalCount?: number;
};

type CanaryKey =
  (typeof STORAGE_DIAGNOSTICS_MMKV_KEYS)[keyof typeof STORAGE_DIAGNOSTICS_MMKV_KEYS];

type AliasLike = Readonly<{ alias?: string }> | null | undefined;
type AliasMap = Readonly<Record<string, AliasLike>>;
type TabLike =
  | Readonly<{ url?: string; initialUrl?: string }>
  | null
  | undefined;

const WATCHED_APP_STORE_KEYS = [
  APP_STORE_NAMES.preference,
  APP_STORE_NAMES.contactBook,
  APP_STORE_NAMES.browser,
  APP_STORE_NAMES.dapps,
  APP_STORE_NAMES.whitelist,
  APP_MMKV_WEAK_KEYS.SCENE_ACCOUNTS,
] as const;

export type AppStoragePresence = Record<
  (typeof WATCHED_APP_STORE_KEYS)[number],
  boolean
>;

// Default aliases are shortened addresses such as `0x1234ab...cd5678`.
const DEFAULT_ALIAS_PATTERN = /^0x[0-9a-f]{2,8}\.{3}[0-9a-f]{2,8}$/i;
const HTTP_URL_PATTERN = /^https?:\/\//;
const ADDRESS_PATTERN = /0x[0-9a-f]{40}/gi;

const reportedThisSession = new Set<string>();
const lastCanarySignatures = new Map<CanaryKey, string>();
let appVersionCache: string | undefined;

function getAppVersion() {
  if (appVersionCache === undefined) {
    try {
      appVersionCache = getVersion() || 'unknown';
    } catch {
      appVersionCache = 'unknown';
    }
  }
  return appVersionCache;
}

export function getRuntimeArchitecture(): RuntimeArchitecture {
  const runtime = globalThis as typeof globalThis & {
    RN$Bridgeless?: boolean;
    nativeFabricUIManager?: unknown;
  };
  return runtime.RN$Bridgeless === true || runtime.nativeFabricUIManager != null
    ? 'new'
    : 'legacy';
}

function warnInDev(message: string, error?: unknown) {
  if (__DEV__) {
    console.warn(`[AppStorageIntegrity] ${message}`, error);
  }
}

export function hasAppStorageKey(key: string) {
  try {
    return appMMKV.contains(key);
  } catch {
    return false;
  }
}

function getAppStorageKeyCount() {
  try {
    return appMMKV.getAllKeys().length;
  } catch {
    return null;
  }
}

/** Returns false when this issue was already reported for this app version. */
function markReportedForCurrentVersion(dedupeKey: string) {
  try {
    const raw = storageDiagnosticsMMKV.getString(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.REPORTED_ISSUES,
    );
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const reported: Record<string, string> =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : {};
    const version = getAppVersion();
    if (reported[dedupeKey] === version) {
      return false;
    }
    reported[dedupeKey] = version;
    storageDiagnosticsMMKV.set(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.REPORTED_ISSUES,
      JSON.stringify(reported),
    );
  } catch (error) {
    warnInDev('failed to record reported issue', error);
  }
  return true;
}

export function reportAppStorageIntegrityIssue(
  issue: AppStorageIntegrityIssue,
  options: {
    /** Narrows grouping, for example to one storage key. */
    scope?: string;
    /** For conditions that persist across launches. */
    oncePerVersion?: boolean;
    extra?: Record<string, unknown>;
  } = {},
) {
  const { scope = '', oncePerVersion = false, extra } = options;
  const dedupeKey = scope ? `${issue}:${scope}` : issue;
  if (reportedThisSession.has(dedupeKey)) {
    return;
  }
  reportedThisSession.add(dedupeKey);
  if (oncePerVersion && !markReportedForCurrentVersion(dedupeKey)) {
    return;
  }

  const rnArch = getRuntimeArchitecture();
  const context = {
    issue,
    scope: scope || undefined,
    appVersion: getAppVersion(),
    rnArch,
    ...extra,
  };
  // Created here so the stack trace points at the caller.
  const error = new Error(`[AppStorageIntegrity] ${dedupeKey}`);
  warnInDev(dedupeKey, context);

  void import('@sentry/react-native')
    .then(Sentry => {
      Sentry.captureException(error, {
        level: 'warning',
        fingerprint: ['app_storage_integrity', issue, scope],
        tags: {
          app_storage_integrity: issue,
          rn_arch: rnArch,
          ...(scope ? { app_storage_scope: scope } : {}),
        },
        extra: context,
      });
    })
    .catch(() => undefined);
}

/**
 * JSON.parse for persisted values. Returns null for invalid JSON, like the
 * previous `safeParseJSON` call; store services then overwrite the unreadable
 * value with their defaults, so the failure is reported first.
 */
export function parseStoredJsonOrReport<T>(
  raw: string,
  source: { fileId?: string; key: string },
): T | null {
  try {
    return JSON.parse(raw);
  } catch (error) {
    reportAppStorageJsonParseFailure({ ...source, raw, error });
    return null;
  }
}

function reportAppStorageJsonParseFailure(input: {
  fileId?: string;
  key: string;
  raw: string;
  error: unknown;
}) {
  try {
    const { fileId = 'unknown', raw, error } = input;
    const key = input.key.replace(ADDRESS_PATTERN, '0x<address>');
    let replacementCharCount = 0;
    let nulCharCount = 0;
    for (let index = 0; index < raw.length; index += 1) {
      const code = raw.charCodeAt(index);
      if (code === 0xfffd) {
        replacementCharCount += 1;
      } else if (code === 0) {
        nulCharCount += 1;
      }
    }
    const errorMessage = (
      error instanceof Error ? error.message : String(error)
    )
      // Some engines quote part of the input in the message.
      .replace(/(["'`]).*?\1/g, '$1…$1')
      .slice(0, 120);

    reportAppStorageIntegrityIssue('json_parse_failed', {
      scope: `${fileId}/${key}`,
      oncePerVersion: true,
      extra: {
        fileId,
        key,
        rawLength: raw.length,
        firstCharCode: raw.charCodeAt(0),
        lastCharCode: raw.charCodeAt(raw.length - 1),
        replacementCharCount,
        nulCharCount,
        errorMessage,
      },
    });
  } catch (error) {
    warnInDev('failed to report JSON parse failure', error);
  }
}

/** Must run before any store service recreates a missing key. */
export function captureAppStoragePresence(): AppStoragePresence {
  const presence = {} as AppStoragePresence;
  WATCHED_APP_STORE_KEYS.forEach(key => {
    presence[key] = hasAppStorageKey(key);
  });
  return presence;
}

function getMissingStores(presence: AppStoragePresence) {
  return WATCHED_APP_STORE_KEYS.filter(key => !presence[key]);
}

export function countAliases(aliases: AliasMap | null | undefined) {
  let total = 0;
  let custom = 0;
  if (aliases) {
    Object.keys(aliases).forEach(key => {
      total += 1;
      const alias = aliases[key]?.alias?.trim();
      if (
        alias &&
        !DEFAULT_ALIAS_PATTERN.test(alias) &&
        alias.toLowerCase() !== key.toLowerCase()
      ) {
        custom += 1;
      }
    });
  }
  return { total, custom };
}

export function countBrowserTabs(
  tabs: ReadonlyArray<TabLike> | null | undefined,
) {
  if (!tabs) {
    return 0;
  }
  // Same filter BrowserService applies when it restores tabs.
  return tabs.filter(tab =>
    HTTP_URL_PATTERN.test(tab?.url || tab?.initialUrl || ''),
  ).length;
}

function isCountDropped(previous: number, current: number) {
  return previous > 0 && (current === 0 || previous - current >= 2);
}

function getCanarySignature(
  canary: Pick<CountCanary, 'appVersion' | 'rnArch' | 'count' | 'totalCount'>,
) {
  return [
    canary.appVersion,
    canary.rnArch,
    canary.count,
    canary.totalCount ?? '',
  ].join('|');
}

function readCanary(key: CanaryKey): CountCanary | null {
  try {
    const raw = storageDiagnosticsMMKV.getString(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CountCanary> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.count !== 'number'
    ) {
      return null;
    }
    return parsed as CountCanary;
  } catch (error) {
    warnInDev(`failed to read ${key}`, error);
    return null;
  }
}

/** Writes only when the counts, app version or architecture changed. */
function writeCanary(
  key: CanaryKey,
  counts: { count: number; totalCount?: number },
  previous?: CountCanary | null,
) {
  try {
    const canary: CountCanary = {
      appVersion: getAppVersion(),
      rnArch: getRuntimeArchitecture(),
      updatedAt: Date.now(),
      ...counts,
    };
    const signature = getCanarySignature(canary);
    const lastSignature =
      lastCanarySignatures.get(key) ??
      (previous ? getCanarySignature(previous) : undefined);
    if (lastSignature === signature) {
      lastCanarySignatures.set(key, signature);
      return;
    }
    storageDiagnosticsMMKV.set(key, JSON.stringify(canary));
    lastCanarySignatures.set(key, signature);
  } catch (error) {
    warnInDev(`failed to write ${key}`, error);
  }
}

/**
 * Compares the contact book loaded at startup with the presence snapshot and
 * with the counts recorded by the previous launch.
 */
export function checkContactBookAtStartup(input: {
  presence: AppStoragePresence;
  accountAddresses: readonly string[];
  aliases: AliasMap;
}) {
  try {
    const { presence, accountAddresses, aliases } = input;
    const counts = countAliases(aliases);
    const accountCount = accountAddresses.length;
    const missingStores = getMissingStores(presence);
    let appStorageKeyCount: number | null | undefined;
    const getKeyCount = () => {
      if (appStorageKeyCount === undefined) {
        appStorageKeyCount = getAppStorageKeyCount();
      }
      return appStorageKeyCount;
    };

    if (accountCount > 0 && (!presence.preference || !presence.contactBook)) {
      reportAppStorageIntegrityIssue('core_store_missing', {
        oncePerVersion: true,
        extra: {
          accountCount,
          missingStores,
          appStorageKeyCount: getKeyCount(),
        },
      });
    }

    if (accountCount > 0 && counts.total === 0) {
      reportAppStorageIntegrityIssue('aliases_empty_with_accounts', {
        oncePerVersion: true,
        extra: {
          accountCount,
          contactBookPresent: presence.contactBook,
          missingStores,
          appStorageKeyCount: getKeyCount(),
        },
      });
    }

    const previous = readCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY,
    );
    if (previous && isCountDropped(previous.count, counts.custom)) {
      reportAppStorageIntegrityIssue('aliases_dropped_between_launches', {
        extra: {
          previousCustomAliasCount: previous.count,
          customAliasCount: counts.custom,
          previousAliasCount: previous.totalCount,
          aliasCount: counts.total,
          previousAppVersion: previous.appVersion,
          previousRnArch: previous.rnArch,
          previousUpdatedAt: previous.updatedAt,
          accountCount,
          accountsWithoutAlias: accountAddresses.filter(
            address => !aliases[address.toLowerCase()],
          ).length,
          contactBookPresent: presence.contactBook,
          missingStores,
          appStorageKeyCount: getKeyCount(),
        },
      });
    }

    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY,
      { count: counts.custom, totalCount: counts.total },
      previous,
    );
  } catch (error) {
    warnInDev('contact book startup check failed', error);
  }
}

/** Subscribed to every `aliases` write of the contact book. */
export function recordContactBookAliasesChange(
  aliases: AliasMap,
  previousAliases: AliasMap,
) {
  try {
    const counts = countAliases(aliases);
    const previousCounts = countAliases(previousAliases);
    // Removing an address deletes one alias per write.
    if (
      previousCounts.total - counts.total >= 2 ||
      previousCounts.custom - counts.custom >= 2
    ) {
      reportAppStorageIntegrityIssue('aliases_bulk_dropped', {
        extra: {
          previousAliasCount: previousCounts.total,
          aliasCount: counts.total,
          previousCustomAliasCount: previousCounts.custom,
          customAliasCount: counts.custom,
        },
      });
    }
    writeCanary(STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY, {
      count: counts.custom,
      totalCount: counts.total,
    });
  } catch (error) {
    warnInDev('contact book change check failed', error);
  }
}

/** Runs right after BrowserService restored its persisted tabs. */
export function checkBrowserTabsOnLoad(input: {
  browserStorePresent: boolean;
  tabs: ReadonlyArray<TabLike>;
  historyCount: number;
  bookmarkCount: number;
}) {
  try {
    const tabCount = countBrowserTabs(input.tabs);
    const previous = readCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY,
    );
    if (previous && isCountDropped(previous.count, tabCount)) {
      reportAppStorageIntegrityIssue('browser_tabs_dropped_between_launches', {
        extra: {
          previousTabCount: previous.count,
          tabCount,
          previousAppVersion: previous.appVersion,
          previousRnArch: previous.rnArch,
          previousUpdatedAt: previous.updatedAt,
          browserStorePresent: input.browserStorePresent,
          historyCount: input.historyCount,
          bookmarkCount: input.bookmarkCount,
          contactBookPresent: hasAppStorageKey(APP_STORE_NAMES.contactBook),
          appStorageKeyCount: getAppStorageKeyCount(),
        },
      });
    }
    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY,
      { count: tabCount },
      previous,
    );
  } catch (error) {
    warnInDev('browser tabs load check failed', error);
  }
}

/** Subscribed to every `browserTabs` write of BrowserService. */
export function recordBrowserTabsChange(tabs: ReadonlyArray<TabLike>) {
  writeCanary(STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY, {
    count: countBrowserTabs(tabs),
  });
}

export function resetAppStorageIntegrityStateForTests() {
  reportedThisSession.clear();
  lastCanarySignatures.clear();
  appVersionCache = undefined;
}
