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
 * Each report sends only fields that separate the suspected causes: the
 * whole file lost, one value unreadable, a code path overwriting it, or a
 * loss tied to an app upgrade or architecture switch. App version and device
 * come with every Sentry event. Addresses, alias text, URLs and stored
 * values are never sent.
 */

export type AppStorageIntegrityIssue =
  /** A stored value exists but is not valid JSON, so it reads as empty. */
  | 'json_parse_failed'
  /** A booted wallet starts without `preference` or `contactBook`. */
  | 'core_store_missing'
  /** Fewer custom aliases than the previous launch recorded. */
  | 'aliases_dropped_between_launches'
  /** One write removed or reset several aliases at once. */
  | 'aliases_bulk_dropped'
  /** Fewer browser tabs than the previous launch recorded. */
  | 'browser_tabs_dropped_between_launches';

type RuntimeArchitecture = 'new' | 'legacy';

type CountCanary = {
  appVersion: string;
  rnArch: RuntimeArchitecture;
  count: number;
};

type CanaryKey =
  | typeof STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY
  | typeof STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY;

// Persisted data can have any shape, so every reader below checks types.
type AliasLike = Readonly<{ alias?: unknown }> | null | undefined;
type AliasMap = Readonly<Record<string, AliasLike>>;
type TabLike =
  | Readonly<{ url?: unknown; initialUrl?: unknown }>
  | null
  | undefined;
type BrowserTabsLike =
  | Readonly<{ tabs?: ReadonlyArray<TabLike> | null }>
  | null
  | undefined;
type EntityStateLike = Readonly<{ ids?: ReadonlyArray<unknown> }> | null;
type BrowserStoreLike = Readonly<{
  browserTabs?: BrowserTabsLike;
  browserHistory?: EntityStateLike;
  browserBookmarks?: EntityStateLike;
}>;

const WATCHED_APP_STORE_KEYS = [
  APP_STORE_NAMES.preference,
  APP_STORE_NAMES.contactBook,
  APP_STORE_NAMES.browser,
  APP_STORE_NAMES.dapps,
  APP_STORE_NAMES.whitelist,
  APP_MMKV_WEAK_KEYS.SCENE_ACCOUNTS,
] as const;

type WatchedAppStoreKey = (typeof WATCHED_APP_STORE_KEYS)[number];

type AppStorageStartupSnapshot = {
  missingStores: WatchedAppStoreKey[];
  /** Only read when something is missing, to tell a lost file from one lost key. */
  appStorageKeyCount?: number;
};

// Default aliases are shortened addresses such as `0x1234ab...cd5678`.
const DEFAULT_ALIAS_PATTERN = /^0x[0-9a-f]{2,8}\.{3}[0-9a-f]{2,8}$/i;
const HTTP_URL_PATTERN = /^https?:\/\//;
const ADDRESS_PATTERN = /0x[0-9a-f]{40}/gi;
const JSON_EDGE_CHARS = new Set(['{', '}', '[', ']', '"']);

const reportedThisSession = new Set<string>();
const lastCanarySignatures = new Map<CanaryKey, string>();
let startupSnapshot: AppStorageStartupSnapshot | undefined;
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

function getRuntimeArchitecture(): RuntimeArchitecture {
  const runtime = globalThis as typeof globalThis & {
    RN$Bridgeless?: boolean;
    nativeFabricUIManager?: unknown;
  };
  return runtime.RN$Bridgeless === true || runtime.nativeFabricUIManager != null
    ? 'new'
    : 'legacy';
}

/** For failures inside these diagnostics. */
function warnInDev(message: string, detail?: unknown) {
  if (__DEV__) {
    console.warn(`[AppStorageIntegrity] ${message}`, detail);
  }
}

/** For the reports themselves, kept out of the dev warning overlay. */
function logReportInDev(message: string, detail?: unknown) {
  if (__DEV__) {
    console.debug(`[AppStorageIntegrity] ${message}`, detail);
  }
}

function hasAppStorageKey(key: string) {
  try {
    return appMMKV.contains(key);
  } catch {
    return false;
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

function getDedupeKey(issue: AppStorageIntegrityIssue, scope: string) {
  return scope ? `${issue}:${scope}` : issue;
}

function reportAppStorageIntegrityIssue(
  issue: AppStorageIntegrityIssue,
  options: {
    /** Narrows grouping, for example to one storage key. */
    scope?: string;
    /** For conditions that persist across launches. */
    oncePerVersion?: boolean;
    extra: Record<string, unknown>;
  },
) {
  const { scope = '', oncePerVersion = false, extra } = options;
  const dedupeKey = getDedupeKey(issue, scope);
  if (reportedThisSession.has(dedupeKey)) {
    return;
  }
  reportedThisSession.add(dedupeKey);
  if (oncePerVersion && !markReportedForCurrentVersion(dedupeKey)) {
    return;
  }

  const rnArch = getRuntimeArchitecture();
  // Created here so the stack trace points at the caller.
  const error = new Error(`[AppStorageIntegrity] ${dedupeKey}`);
  logReportInDev(dedupeKey, extra);

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
        extra,
      });
    })
    .catch(() => undefined);
}

/**
 * Records which watched keys exist before any store service recreates a
 * missing one. Taken once per launch; later calls return the first result.
 */
export function captureAppStorageStartupSnapshot(): AppStorageStartupSnapshot {
  if (!startupSnapshot) {
    const missingStores = WATCHED_APP_STORE_KEYS.filter(
      key => !hasAppStorageKey(key),
    );
    startupSnapshot = { missingStores };
    if (missingStores.length) {
      try {
        startupSnapshot.appStorageKeyCount = appMMKV.getAllKeys().length;
      } catch (error) {
        warnInDev('failed to count app storage keys', error);
      }
    }
  }
  return startupSnapshot;
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
  } catch {
    reportJsonParseFailure(raw, source);
    return null;
  }
}

function describeEdgeChar(char: string | undefined) {
  return char !== undefined && JSON_EDGE_CHARS.has(char) ? char : 'other';
}

function reportJsonParseFailure(
  raw: string,
  source: { fileId?: string; key: string },
) {
  try {
    const fileId = source.fileId || 'unknown';
    const key = String(source.key).replace(ADDRESS_PATTERN, '0x<address>');
    const scope = `${fileId}/${key}`;
    // Checked before the scan below, which reads the whole value.
    if (reportedThisSession.has(getDedupeKey('json_parse_failed', scope))) {
      return;
    }
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

    reportAppStorageIntegrityIssue('json_parse_failed', {
      scope,
      oncePerVersion: true,
      extra: {
        // Truncation shows as a missing closing char, double encoding as a
        // leading quote, and a length near a page size as a file-level issue.
        rawLength: raw.length,
        firstChar: describeEdgeChar(raw[0]),
        lastChar: describeEdgeChar(raw[raw.length - 1]),
        // Bytes that were not valid UTF-8 when read back.
        replacementCharCount,
        // Zero-filled regions point at file corruption.
        nulCharCount,
      },
    });
  } catch (error) {
    warnInDev('failed to report JSON parse failure', error);
  }
}

export function countAliases(aliases: AliasMap | null | undefined) {
  let total = 0;
  let custom = 0;
  if (aliases && typeof aliases === 'object') {
    Object.keys(aliases).forEach(key => {
      total += 1;
      const rawAlias = aliases[key]?.alias;
      const alias = typeof rawAlias === 'string' ? rawAlias.trim() : '';
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

function countBrowserTabs(tabs: unknown) {
  if (!Array.isArray(tabs)) {
    return 0;
  }
  // Same filter BrowserService applies when it restores tabs.
  return tabs.filter((tab: TabLike) => {
    const url = tab?.url || tab?.initialUrl;
    return typeof url === 'string' && HTTP_URL_PATTERN.test(url);
  }).length;
}

function countEntityIds(state: EntityStateLike | undefined) {
  const ids = state?.ids;
  return Array.isArray(ids) ? ids.length : 0;
}

function isCountDropped(previous: number, current: number) {
  return previous > 0 && (current === 0 || previous - current >= 2);
}

function getCanarySignature(canary: CountCanary) {
  return [canary.appVersion, canary.rnArch, canary.count].join('|');
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

/** Writes only when the count, app version or architecture changed. */
function writeCanary(
  key: CanaryKey,
  count: number,
  previous?: CountCanary | null,
) {
  try {
    const canary: CountCanary = {
      appVersion: getAppVersion(),
      rnArch: getRuntimeArchitecture(),
      count,
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
 * Checks the contact book loaded at startup against the startup snapshot and
 * the custom alias count recorded by the previous launch.
 */
export function checkContactBookAtStartup(input: {
  /** The keyring was set up before, so this is not a first launch. */
  isBootedWallet: boolean;
  aliases: AliasMap;
}) {
  try {
    const snapshot = captureAppStorageStartupSnapshot();
    const counts = countAliases(input.aliases);

    if (
      input.isBootedWallet &&
      (snapshot.missingStores.includes(APP_STORE_NAMES.preference) ||
        snapshot.missingStores.includes(APP_STORE_NAMES.contactBook))
    ) {
      reportAppStorageIntegrityIssue('core_store_missing', {
        oncePerVersion: true,
        extra: { ...snapshot },
      });
    }

    // An empty contact book alone is not reported: creating a seed phrase
    // from the add-address sheet or syncing from the extension can leave
    // accounts without aliases, and the UI then shows shortened addresses.
    const previous = readCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY,
    );
    if (previous && isCountDropped(previous.count, counts.custom)) {
      reportAppStorageIntegrityIssue('aliases_dropped_between_launches', {
        extra: {
          previousAppVersion: previous.appVersion,
          previousRnArch: previous.rnArch,
          // 0 and partial losses point at different causes.
          customAliasCount: counts.custom,
          // 0: the store was emptied. Above 0: names were reset to defaults.
          aliasCount: counts.total,
          ...snapshot,
        },
      });
    }

    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY,
      counts.custom,
      previous,
    );
  } catch (error) {
    warnInDev('contact book startup check failed', error);
  }
}

/**
 * Subscribed to every `aliases` write of the contact book. Runs inside the
 * store update, so it must never throw.
 */
export function recordContactBookAliasesChange(
  aliases: AliasMap,
  previousAliases: AliasMap,
) {
  try {
    const counts = countAliases(aliases);
    const previousCounts = countAliases(previousAliases);
    const removedAliasCount = previousCounts.total - counts.total;
    const removedCustomAliasCount = previousCounts.custom - counts.custom;
    // Removing an address deletes one alias per write.
    if (removedAliasCount >= 2 || removedCustomAliasCount >= 2) {
      // The stack trace shows which code made the write.
      reportAppStorageIntegrityIssue('aliases_bulk_dropped', {
        extra: {
          // Above 0: entries deleted. 0 with custom names lost: overwritten.
          removedAliasCount,
          removedCustomAliasCount,
        },
      });
    }
    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.CONTACT_BOOK_CANARY,
      counts.custom,
    );
  } catch (error) {
    warnInDev('contact book change check failed', error);
  }
}

/** Runs right after BrowserService restored its persisted tabs. */
export function checkBrowserTabsOnLoad(store: BrowserStoreLike) {
  try {
    const tabCount = countBrowserTabs(store.browserTabs?.tabs);
    const previous = readCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY,
    );
    if (previous && isCountDropped(previous.count, tabCount)) {
      reportAppStorageIntegrityIssue('browser_tabs_dropped_between_launches', {
        extra: {
          previousAppVersion: previous.appVersion,
          previousRnArch: previous.rnArch,
          // A partial loss points at tab restore logic, not storage.
          tabCount,
          // Kept history or bookmarks mean only the tabs were cleared.
          historyCount: countEntityIds(store.browserHistory),
          bookmarkCount: countEntityIds(store.browserBookmarks),
          ...captureAppStorageStartupSnapshot(),
        },
      });
    }
    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY,
      tabCount,
      previous,
    );
  } catch (error) {
    warnInDev('browser tabs load check failed', error);
  }
}

/**
 * Subscribed to every `browserTabs` write of BrowserService. Runs inside the
 * store update, so it must never throw.
 */
export function recordBrowserTabsChange(browserTabs: BrowserTabsLike) {
  try {
    writeCanary(
      STORAGE_DIAGNOSTICS_MMKV_KEYS.BROWSER_TABS_CANARY,
      countBrowserTabs(browserTabs?.tabs),
    );
  } catch (error) {
    warnInDev('browser tabs change check failed', error);
  }
}

export function resetAppStorageIntegrityStateForTests() {
  reportedThisSession.clear();
  lastCanarySignatures.clear();
  startupSnapshot = undefined;
  appVersionCache = undefined;
}
