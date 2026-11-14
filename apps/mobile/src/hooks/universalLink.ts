import { useEffect, useLayoutEffect } from 'react';
import RNFS from '@rabby-wallet/react-native-fs';
import { Linking } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { t } from 'i18next';
import {
  bindKeyringEvent,
  isKeyringUnlockedSnapshot,
} from '@/core/serviceApi/keyring';
import { urlUtils } from '@rabby-wallet/base-utils';
import { browserApis } from './browser/useBrowser';
import useMount from 'react-use/lib/useMount';
import { toastWithIcon } from '@/components2024/Toast';
import { RcIconInfoForToast } from '@/screens/Unlock/icons';
import {
  getRabbyLockInfo,
  isUnlockSessionValid,
  PasswordStatus,
  setAppLaunchLockEnabled,
} from '@/core/apis/lock';
import { getPwdStatus } from './useLock';
import {
  UL_HOSTNAME,
  UL_MATCH_PREFIX,
  UL_PATH_PREFIX,
  UL_PROTOCOL,
  WALLETCONNECT_REDIRECT_PATH,
} from '@/constant/universalLink';
import type { RefLikeObject } from '@/utils/type';
import {
  markWalletConnectDappRedirectPending,
  pairWalletConnectUri,
  parseWalletConnectUriFromLink,
} from '@/core/walletconnect';
import { isNonPublicProductionEnv } from '@/constant';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated, navigationRef } from '@/utils/navigation';
import { findChain, makeTokenFromChain } from '@/utils/chain';
import { dropAppDataSourceAndQuitApp } from '@/databases/imports';
import {
  abortAllSyncTasks,
  clearDbSyncWritePolicyOverride,
  getDbSyncWritePolicyDebugSnapshot,
  setDbSyncWritePolicyOverride,
  type DbSyncWritePolicyOverride,
} from '@/databases/sync/_task';
import { resetUpdateHistoryTime } from './historyTokenDict';
import type { RegressionScenarioCommand } from '@/devtools/regressionScenarios/contracts';
import {
  handleRegressionScenarioCommand,
  parseRegressionScenarioLink,
  sanitizeLinkForLogging,
} from '@/devtools/regressionScenarios/runtime';
import {
  canResetRootToHome,
  getRabbyGoTargetNestedRoute,
  isAllowedUniversalLinkUrl,
  makeOpenHomeRootState,
  parseOpenDappAction,
  parseOpenHomeAction,
  parseRabbyGoTargetAction,
  type RabbyGoTarget,
} from '@/utils/universalLinkOpenHome';
import { apisHomeTabIndex, UnlockUIManager } from './navigation';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { switchSceneCurrentAccount } from './accountsSwitcher';
import {
  setCurrentKeychainVersion,
  setSensitiveSceneProtectionEnabled,
  type CurrentKeychainVersion,
} from './appSettings';
import { IS_IOS } from '@/core/native/utils';
import { parseKeychainVersionDeepLinkValue } from '@/core/apis/keychainVersionShared';
import RNHelpers from '@/core/native/RNHelpers';
import {
  forceDebugChainStatsFor,
  toggleDebugChainStatsForced,
} from '@/screens/Home/debugChainStats';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';

const nextAppLinkRef = {
  current: '' as string,
};

function getNextAppLink() {
  return nextAppLinkRef.current;
}

function setNextAppLink(linkOrSetter: string | ((prev: string) => string)) {
  if (typeof linkOrSetter === 'function') {
    nextAppLinkRef.current = linkOrSetter(nextAppLinkRef.current);
  } else {
    nextAppLinkRef.current = linkOrSetter || '';
  }
}

type OnParseUrlAndProcessAction = (payload: {
  type:
    | 'open-target'
    | 'open-dapp'
    | 'walletconnect-uri'
    | 'walletconnect-redirect'
    | 'open-testkit-screen'
    | 'clear-app-cache'
    | 'debug-sync-all-history'
    | 'debug-db-sync-policy'
    | 'debug-lending'
    | 'debug-open-target'
    | 'debug-create-address'
    | 'debug-set-language'
    | 'debug-open-screen'
    | 'debug-import-private-key'
    | 'debug-dump-route'
    | 'debug-export-history'
    | 'debug-open-modal'
    | 'debug-inject-approval'
    | 'debug-dump-approval'
    | 'debug-capture-requests'
    | 'debug-disconnect-dapp'
    | 'debug-set-current-account'
    | 'debug-dapp-eval'
    | 'debug-open-bridge-detail'
    | 'debug-open-history-local-detail'
    | 'regression-scenario';
  target?: RabbyGoTarget;
  dappUrl?: string;
  uri?: string;
  testkitScreen?:
    | typeof RootNames.DevCapabilityFile
    | typeof RootNames.DevUIAnimatedTextAndView
    | typeof RootNames.DevUIAutoFitTitlePlayground
    | typeof RootNames.DevUISafeSvgMedia
    | typeof RootNames.DebugLogViewer
    | typeof RootNames.StartupPerformanceLogViewer
    | typeof RootNames.DevDataSQLite
    | typeof RootNames.DevDataKeychain
    | typeof RootNames.DevSwitches;
  testkitParams?: {
    tab?: 'overview' | 'debug';
    appLaunchLock?: boolean;
    sensitiveSceneProtection?: boolean;
    keychainVersion?: CurrentKeychainVersion;
  };
  debugDbSyncPolicy?: {
    resetWritePolicyOverride?: boolean;
    writePolicyOverride?: DbSyncWritePolicyOverride;
  };
  debugLending?: {
    action: 'open' | 'refresh' | 'probe';
    market?: string;
  };
  debugOpenTarget?: DebugOpenTarget;
  debugOpenTargetChain?: string;
  debugOpenTargetTab?: 'seedPhrase' | 'privateKey';
  /** Non-production only: force the app language, e.g. `pt-BR`. */
  debugLanguage?: string;
  /** Non-production only: address seeded by `debug-create-address`. */
  debugAddress?: string;
  /**
   * Non-production only: import private-key accounts through the same API the
   * Import Private Key screen calls, after unlocking with the test password.
   */
  debugPrivateKeyImport?: {
    keys: string[];
    password?: string;
  };
  /** Non-production only: dump the current route's params to the sandbox. */
  debugDumpRoute?: {
    name?: string;
  };
  /** Non-production only: export an address's API history to the sandbox. */
  debugExportHistory?: {
    address?: string;
    chain?: string;
    days?: number;
    pages?: number;
    name?: string;
  };
  /** Non-production only: dump the current approval request to the sandbox. */
  debugDumpApproval?: {
    name?: string;
  };
  /** Non-production only: toggle raw provider-request capture. */
  debugCaptureRequests?: {
    on?: boolean;
    allowAnyApproval?: boolean;
  };
  /** Non-production only: disconnect a dapp origin (broadcasts accountsChanged). */
  debugDisconnectDapp?: {
    origin?: string;
  };
  /** Non-production only: switch the app's current account by address. */
  debugSetCurrentAccount?: {
    address?: string;
  };
  /** Non-production only: inject JavaScript into the active dapp webview. */
  debugDappEval?: {
    code?: string;
  };
  /** Non-production only: open a global bottom-sheet modal by name. */
  debugOpenModal?: {
    modal?: string;
    props?: Record<string, unknown>;
    list?: boolean;
  };
  /** Non-production only: inject an approval request (SignTx / SignTypedData / ...). */
  debugInjectApproval?: {
    component?: string;
    params?: Record<string, unknown>;
    paramsFile?: string;
    parseFile?: string;
    parseCapture?: string;
    origin?: string;
    approvalType?: string;
  };
  /** Non-production only: open BridgeDetail from a real local+remote record. */
  debugOpenBridgeDetail?: {
    address?: string;
    index?: number;
  };
  /** Non-production only: open HistoryLocalDetail from a real local tx group. */
  debugOpenHistoryLocalDetail?: {
    address?: string;
    index?: number;
    prefer?: 'pending' | 'completed';
    /** Seed a synthetic pending local tx when the local store is empty. */
    seed?: boolean;
  };
  debugChainStatsLoading?: boolean;
  debugChainStatsLoadingForMs?: number;
  debugChainStatsLoadingOff?: boolean;
  /** Screen-level test entry: open any navigator-registered screen. */
  debugOpenScreen?: {
    screen?: string;
    params?: Record<string, unknown>;
    /** Read route params from a dumped fixture instead of inline `params`. */
    paramsFile?: string;
    props?: Record<string, unknown>;
    store?: Record<string, unknown>;
    /** Sticky store patch: re-applied whenever the store's producers write. */
    storePin?: Record<string, unknown>;
    storePinClear?: boolean;
    list?: boolean;
    push?: boolean;
  };
  regressionScenarioCommand?: RegressionScenarioCommand | null;
  regressionScenarioError?: string;
}) => void;

// Non-production automation targets that reuse the existing `_cmd` entry
// instead of shipping another debug route.
type DebugOpenTarget =
  | RabbyGoTarget
  | 'tokenDetail'
  | 'tokenMarketDetail'
  | 'chainLoading'
  | 'singleHome'
  | 'homeAssets'
  | 'approvals'
  | 'importSecret'
  | 'importMethods';

const NON_PRODUCTION_TESTKIT_SCREENS = {
  DevCapabilityFile: RootNames.DevCapabilityFile,
  DevUIAnimatedTextAndView: RootNames.DevUIAnimatedTextAndView,
  DevUIAutoFitTitlePlayground: RootNames.DevUIAutoFitTitlePlayground,
  DevUISafeSvgMedia: RootNames.DevUISafeSvgMedia,
  DebugLogViewer: RootNames.DebugLogViewer,
  StartupPerformanceLogViewer: RootNames.StartupPerformanceLogViewer,
  DevDataSQLite: RootNames.DevDataSQLite,
  DevDataKeychain: RootNames.DevDataKeychain,
  DevSwitches: RootNames.DevSwitches,
} as const;

function getRabbyGoTarget(
  urlInfo: NonNullable<ReturnType<typeof urlUtils.safeParseURL>>,
) {
  if (urlInfo.protocol === 'rabby:') {
    return urlInfo.hostname || urlInfo.pathname.replace(/^\/+/, '');
  }

  if (!urlInfo.pathname.startsWith(UL_MATCH_PREFIX)) {
    return '';
  }

  return urlInfo.pathname
    .slice(UL_MATCH_PREFIX.length)
    .replace(/^\/+/, '')
    .split('/')[0];
}

function parseNonProductionTestkitLink(appLink: string) {
  if (!isNonPublicProductionEnv) {
    return null;
  }

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return null;
  }

  const target = getRabbyGoTarget(urlInfo);
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');
  if (target !== 'testkit' && rabbyGoCmd !== 'open-testkit') {
    return null;
  }

  const screenRaw = urlInfo.searchParams.get('screen') || 'DevCapabilityFile';
  const screen =
    NON_PRODUCTION_TESTKIT_SCREENS[
      screenRaw as keyof typeof NON_PRODUCTION_TESTKIT_SCREENS
    ];
  if (!screen) {
    console.warn('[useUniversalLinkOnTop] Unknown testkit screen:', screenRaw);
    return null;
  }

  const tabRaw = urlInfo.searchParams.get('tab');
  const appLaunchLockRaw = urlInfo.searchParams.get('appLaunchLock');
  const appLaunchLock =
    appLaunchLockRaw === 'enabled'
      ? true
      : appLaunchLockRaw === 'disabled'
      ? false
      : undefined;
  const sensitiveSceneProtectionRaw = urlInfo.searchParams.get(
    'sensitiveSceneProtection',
  );
  const sensitiveSceneProtection =
    sensitiveSceneProtectionRaw === 'enabled'
      ? true
      : sensitiveSceneProtectionRaw === 'disabled'
      ? false
      : undefined;
  const keychainVersion = parseKeychainVersionDeepLinkValue(
    urlInfo.searchParams.get('keychainVersion'),
  );

  return {
    type: 'open-testkit-screen',
    testkitScreen: screen,
    testkitParams:
      tabRaw === 'debug' ||
      tabRaw === 'overview' ||
      appLaunchLock !== undefined ||
      sensitiveSceneProtection !== undefined ||
      keychainVersion !== null
        ? {
            ...(tabRaw === 'debug' || tabRaw === 'overview'
              ? { tab: tabRaw }
              : {}),
            ...(appLaunchLock !== undefined ? { appLaunchLock } : {}),
            ...(sensitiveSceneProtection !== undefined
              ? { sensitiveSceneProtection }
              : {}),
            ...(keychainVersion ? { keychainVersion } : {}),
          }
        : undefined,
  } satisfies Parameters<OnParseUrlAndProcessAction>[0];
}

function parseBooleanParam(value: string | null) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseIntegerParam(
  params: URLSearchParams,
  keys: string[],
  options: {
    min: number;
    max: number;
  },
) {
  for (const key of keys) {
    const raw = params.get(key);
    if (!raw) {
      continue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      console.warn('[useUniversalLinkOnTop] Invalid integer param:', {
        key,
        raw,
      });
      continue;
    }

    const normalized = Math.trunc(value);
    if (normalized < options.min || normalized > options.max) {
      console.warn('[useUniversalLinkOnTop] Integer param out of range:', {
        key,
        raw,
        min: options.min,
        max: options.max,
      });
      continue;
    }

    return normalized;
  }

  return undefined;
}

function parseDebugDbSyncPolicyParams(params: URLSearchParams) {
  const writePolicyOverride: DbSyncWritePolicyOverride = {};
  const maxBatchSize = parseIntegerParam(
    params,
    ['batchSize', 'maxBatchSize', 'allHistoryBatchSize'],
    {
      min: 1,
      max: 2000,
    },
  );
  const minDelayBetweenTasks = parseIntegerParam(
    params,
    ['minDelayBetweenTasks', 'minDelay'],
    {
      min: 0,
      max: 60 * 1000,
    },
  );
  const maxDelayBetweenTasks = parseIntegerParam(
    params,
    ['maxDelayBetweenTasks', 'maxDelay', 'delayBetweenTasks'],
    {
      min: 0,
      max: 60 * 1000,
    },
  );

  if (typeof maxBatchSize === 'number') {
    writePolicyOverride.maxBatchSize = maxBatchSize;
  }
  if (typeof minDelayBetweenTasks === 'number') {
    writePolicyOverride.minDelayBetweenTasks = minDelayBetweenTasks;
  }
  if (typeof maxDelayBetweenTasks === 'number') {
    writePolicyOverride.maxDelayBetweenTasks = maxDelayBetweenTasks;
  }

  return {
    resetWritePolicyOverride:
      parseBooleanParam(params.get('resetPolicy')) ||
      parseBooleanParam(params.get('clearPolicy')) ||
      parseBooleanParam(params.get('resetDbSyncPolicy')),
    writePolicyOverride: Object.keys(writePolicyOverride).length
      ? writePolicyOverride
      : undefined,
  };
}

function parseNonProductionMaintenanceLink(appLink: string) {
  if (!isNonPublicProductionEnv) {
    return null;
  }

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return null;
  }

  const target = getRabbyGoTarget(urlInfo);
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');

  if (
    rabbyGoCmd === 'clear-app-cache' ||
    target === 'clear-app-cache' ||
    (target === 'debug' && rabbyGoCmd === 'clear-cache')
  ) {
    return {
      type: 'clear-app-cache',
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  if (
    rabbyGoCmd === 'debug-sync-all-history' ||
    target === 'debug-sync-all-history'
  ) {
    return {
      type: 'debug-sync-all-history',
      debugDbSyncPolicy: parseDebugDbSyncPolicyParams(urlInfo.searchParams),
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  if (
    rabbyGoCmd === 'debug-db-sync-policy' ||
    target === 'debug-db-sync-policy'
  ) {
    return {
      type: 'debug-db-sync-policy',
      debugDbSyncPolicy: parseDebugDbSyncPolicyParams(urlInfo.searchParams),
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  if (rabbyGoCmd === 'debug-lending' || target === 'debug-lending') {
    const action = urlInfo.searchParams.get('action') || 'open';
    if (!['open', 'refresh', 'probe'].includes(action)) {
      console.warn(
        '[useUniversalLinkOnTop] Unknown Lending debug action:',
        action,
      );
      return null;
    }

    return {
      type: 'debug-lending',
      debugLending: {
        action: action as 'open' | 'refresh' | 'probe',
        market: urlInfo.searchParams.get('market') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: open one of the Rabby Go targets from a scripted
  // build. `open-target` itself is a production action, so device automation
  // must use this `_cmd` instead of reusing it.
  if (rabbyGoCmd === 'debug-open-target' || target === 'debug-open-target') {
    const rawTarget = urlInfo.searchParams.get('target');
    const isRabbyGoTarget =
      rawTarget === 'perps' ||
      rawTarget === 'swap' ||
      rawTarget === 'bridge' ||
      rawTarget === 'home';
    const isDebugScreenTarget =
      rawTarget === 'tokenDetail' ||
      rawTarget === 'tokenMarketDetail' ||
      rawTarget === 'chainLoading' ||
      rawTarget === 'singleHome' ||
      rawTarget === 'homeAssets' ||
      rawTarget === 'approvals' ||
      rawTarget === 'importSecret' ||
      rawTarget === 'importMethods';
    if (!isRabbyGoTarget && !isDebugScreenTarget) {
      console.warn(
        '[useUniversalLinkOnTop] Unknown debug-open-target target:',
        rawTarget,
      );
      return null;
    }

    return {
      type: 'debug-open-target',
      debugOpenTarget: rawTarget as DebugOpenTarget,
      debugOpenTargetChain:
        urlInfo.searchParams.get('chain') || urlInfo.searchParams.get('symbol')
          ? urlInfo.searchParams.get('chain') ||
            urlInfo.searchParams.get('symbol') ||
            undefined
          : undefined,
      debugOpenTargetTab:
        urlInfo.searchParams.get('tab') === 'privateKey'
          ? 'privateKey'
          : 'seedPhrase',
      debugChainStatsLoading:
        urlInfo.searchParams.get('chainLoading') === '1' ||
        urlInfo.searchParams.get('chainLoading') === 'true',
      // `chainLoading=3000` pins for 3s then releases, so the skeleton ->
      // loaded transition can be observed.
      debugChainStatsLoadingForMs: (function () {
        const raw = urlInfo.searchParams.get('chainLoading');
        if (!raw) {
          return undefined;
        }
        const ms = Number(raw);
        return Number.isFinite(ms) && ms > 0 ? ms : undefined;
      })(),
      debugChainStatsLoadingOff:
        urlInfo.searchParams.get('chainLoading') === '0' ||
        urlInfo.searchParams.get('chainLoading') === 'false',
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: open HistoryLocalDetail from the address's local
  // transaction groups (the same `getList` the swap history popup uses).
  // `?_cmd=debug-open-history-local-detail&address=0x..&index=0&prefer=pending`
  if (
    rabbyGoCmd === 'debug-open-history-local-detail' ||
    target === 'debug-open-history-local-detail'
  ) {
    const indexRaw = Number(urlInfo.searchParams.get('index') || '0');
    const preferRaw = urlInfo.searchParams.get('prefer');
    return {
      type: 'debug-open-history-local-detail',
      debugOpenHistoryLocalDetail: {
        address: urlInfo.searchParams.get('address') || undefined,
        index: Number.isFinite(indexRaw)
          ? Math.max(0, Math.trunc(indexRaw))
          : 0,
        prefer: preferRaw === 'pending' ? 'pending' : 'completed',
        seed: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('seed') || '').toLowerCase(),
        ),
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: open BridgeDetail from the address's real bridge
  // history (local record + the openapi bridge record for the same tx id).
  // `?_cmd=debug-open-bridge-detail&address=0x..&index=0`
  if (
    rabbyGoCmd === 'debug-open-bridge-detail' ||
    target === 'debug-open-bridge-detail'
  ) {
    const indexRaw = Number(urlInfo.searchParams.get('index') || '0');
    return {
      type: 'debug-open-bridge-detail',
      debugOpenBridgeDetail: {
        address: urlInfo.searchParams.get('address') || undefined,
        index: Number.isFinite(indexRaw)
          ? Math.max(0, Math.trunc(indexRaw))
          : 0,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: capture the current route params so a real flow can
  // be replayed later through `debug-open-screen&paramsFile=`.
  // `?_cmd=debug-dump-route&name=bridge-detail`
  if (rabbyGoCmd === 'debug-dump-route' || target === 'debug-dump-route') {
    return {
      type: 'debug-dump-route',
      debugDumpRoute: {
        name: urlInfo.searchParams.get('name') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: export an address's API history page by page so the
  // host can turn real items into HistoryDetail fixtures.
  // `?_cmd=debug-export-history&address=0x..&chain=eth&days=90&pages=50`
  if (
    rabbyGoCmd === 'debug-export-history' ||
    target === 'debug-export-history'
  ) {
    const daysRaw = Number(urlInfo.searchParams.get('days') || '30');
    const pagesRaw = Number(urlInfo.searchParams.get('pages') || '10');
    return {
      type: 'debug-export-history',
      debugExportHistory: {
        address: urlInfo.searchParams.get('address') || undefined,
        chain: urlInfo.searchParams.get('chain') || undefined,
        days:
          Number.isFinite(daysRaw) && daysRaw > 0
            ? Math.min(365, Math.trunc(daysRaw))
            : 30,
        pages:
          Number.isFinite(pagesRaw) && pagesRaw > 0
            ? Math.min(200, Math.trunc(pagesRaw))
            : 10,
        name: urlInfo.searchParams.get('name') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: toggle raw provider-request capture.
  // `?_cmd=debug-capture-requests&on=1`
  if (
    rabbyGoCmd === 'debug-capture-requests' ||
    target === 'debug-capture-requests'
  ) {
    return {
      type: 'debug-capture-requests',
      debugCaptureRequests: {
        on: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('on') || '').toLowerCase(),
        ),
        allowAnyApproval: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('allowAnyApproval') || '').toLowerCase(),
        ),
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: run JS in the active dapp webview.
  // `?_cmd=debug-dapp-eval&code=<urlencoded js>`
  if (rabbyGoCmd === 'debug-dapp-eval' || target === 'debug-dapp-eval') {
    return {
      type: 'debug-dapp-eval',
      debugDappEval: {
        code: urlInfo.searchParams.get('code') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: switch the app's current account by exact address or
  // by prefix/suffix match. `?_cmd=debug-set-current-account&address=0x5952..3ee7`
  if (
    rabbyGoCmd === 'debug-set-current-account' ||
    target === 'debug-set-current-account'
  ) {
    return {
      type: 'debug-set-current-account',
      debugSetCurrentAccount: {
        address: urlInfo.searchParams.get('address') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: disconnect a dapp origin so the next connect asks for
  // an account again. `?_cmd=debug-disconnect-dapp&origin=https://opensea.io`
  if (
    rabbyGoCmd === 'debug-disconnect-dapp' ||
    target === 'debug-disconnect-dapp'
  ) {
    return {
      type: 'debug-disconnect-dapp',
      debugDisconnectDapp: {
        origin: urlInfo.searchParams.get('origin') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: dump the current approval request so a real dapp
  // request can be turned into a fixture.
  // `?_cmd=debug-dump-approval&name=opensea-sell`
  if (
    rabbyGoCmd === 'debug-dump-approval' ||
    target === 'debug-dump-approval'
  ) {
    return {
      type: 'debug-dump-approval',
      debugDumpApproval: {
        name: urlInfo.searchParams.get('name') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: open a global bottom-sheet modal by name.
  // `?_cmd=debug-open-modal&modal=SIMPLE_CONFIRM&props={"title":"..."}`
  if (rabbyGoCmd === 'debug-open-modal' || target === 'debug-open-modal') {
    const parseProps = () => {
      const raw = urlInfo.searchParams.get('props');
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : undefined;
      } catch {
        console.warn('[debug-open-modal] invalid props JSON');
        return undefined;
      }
    };
    return {
      type: 'debug-open-modal',
      debugOpenModal: {
        modal: urlInfo.searchParams.get('modal') || undefined,
        props: parseProps(),
        list: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('list') || '').toLowerCase(),
        ),
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: inject an approval request exactly like the RPC flow.
  // `?_cmd=debug-inject-approval&component=SignTx[&params=<json>|&paramsFile=<name>]`
  if (
    rabbyGoCmd === 'debug-inject-approval' ||
    target === 'debug-inject-approval'
  ) {
    const parseApprovalParams = () => {
      const raw = urlInfo.searchParams.get('params');
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : undefined;
      } catch {
        console.warn('[debug-inject-approval] invalid params JSON');
        return undefined;
      }
    };
    return {
      type: 'debug-inject-approval',
      debugInjectApproval: {
        component: urlInfo.searchParams.get('component') || undefined,
        params: parseApprovalParams(),
        paramsFile: urlInfo.searchParams.get('paramsFile') || undefined,
        parseFile: urlInfo.searchParams.get('parseFile') || undefined,
        parseCapture: urlInfo.searchParams.get('parseCapture') || undefined,
        origin: urlInfo.searchParams.get('origin') || undefined,
        approvalType: urlInfo.searchParams.get('approvalType') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: open any screen a navigator actually registers,
  // straight from a deeplink. `screen` must exist in the generated registry;
  // the optional JSON `params` / `store` are injected before navigating.
  if (rabbyGoCmd === 'debug-open-screen' || target === 'debug-open-screen') {
    const rawScreen = urlInfo.searchParams.get('screen') || undefined;
    const wantsList = ['1', 'true', 'yes'].includes(
      (urlInfo.searchParams.get('list') || '').toLowerCase(),
    );
    const parseJsonParam = (key: string) => {
      const raw = urlInfo.searchParams.get(key);
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : undefined;
      } catch {
        console.warn(
          `[useUniversalLinkOnTop] debug-open-screen ignored invalid ${key} JSON`,
        );
        return undefined;
      }
    };

    if (!rawScreen && !wantsList) {
      console.warn(
        '[useUniversalLinkOnTop] debug-open-screen requires ?screen=<id> (or ?list=1)',
      );
      return null;
    }

    return {
      type: 'debug-open-screen',
      debugOpenScreen: {
        screen: rawScreen,
        params: parseJsonParam('params'),
        paramsFile: urlInfo.searchParams.get('paramsFile') || undefined,
        props: parseJsonParam('props'),
        store: parseJsonParam('store'),
        storePin: parseJsonParam('storePin'),
        storePinClear: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('storePinClear') || '').toLowerCase(),
        ),
        list: wantsList,
        push: ['1', 'true', 'yes'].includes(
          (urlInfo.searchParams.get('push') || '').toLowerCase(),
        ),
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: force the UI language so layout bugs that only show up
  // with a long translation (QA 1352) can be reproduced without changing the
  // device settings. `?_cmd=debug-set-language&lang=pt-BR`.
  if (rabbyGoCmd === 'debug-set-language' || target === 'debug-set-language') {
    const lang =
      urlInfo.searchParams.get('lang') || urlInfo.searchParams.get('language');
    if (!lang) {
      console.warn('[useUniversalLinkOnTop] debug-set-language needs ?lang=');
      return null;
    }
    return {
      type: 'debug-set-language',
      debugLanguage: lang,
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: seed an empty address so "no assets yet" states can be
  // reproduced without walking the onboarding flow (QA 1197).
  // `?_cmd=debug-create-address&address=0x...`
  if (
    rabbyGoCmd === 'debug-create-address' ||
    target === 'debug-create-address'
  ) {
    const address = urlInfo.searchParams.get('address') || undefined;
    return {
      type: 'debug-create-address',
      debugAddress: address,
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  // Non-production only: import private-key accounts exactly the way the
  // Import Private Key screen does (unlock, then apiPrivateKey.importPrivateKey),
  // so QA state can be rebuilt without tapping through the UI.
  // `?_cmd=debug-import-private-key&keys=<hex>,<hex>&password=...`
  if (
    rabbyGoCmd === 'debug-import-private-key' ||
    target === 'debug-import-private-key'
  ) {
    const rawKeys =
      urlInfo.searchParams.get('keys') || urlInfo.searchParams.get('key') || '';
    const keys = rawKeys
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (keys.length === 0) {
      console.warn(
        '[useUniversalLinkOnTop] debug-import-private-key needs ?keys=<hex>[,<hex>]',
      );
      return null;
    }
    return {
      type: 'debug-import-private-key',
      debugPrivateKeyImport: {
        keys,
        password: urlInfo.searchParams.get('password') || undefined,
      },
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  return null;
}

function parseNonProductionLink(appLink: string) {
  const regressionResult = parseRegressionScenarioLink(appLink);
  if (regressionResult.matched) {
    return {
      type: 'regression-scenario',
      regressionScenarioCommand: regressionResult.command,
      regressionScenarioError: regressionResult.error,
    } satisfies Parameters<OnParseUrlAndProcessAction>[0];
  }

  return (
    parseNonProductionMaintenanceLink(appLink) ||
    parseNonProductionTestkitLink(appLink)
  );
}

function isWalletConnectRedirectLink(appLink: string) {
  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return false;
  }

  if (urlInfo.protocol === 'rabby:') {
    const target = urlInfo.hostname || urlInfo.pathname.replace(/^\/+/, '');
    return target === WALLETCONNECT_REDIRECT_PATH || target === 'wc';
  }

  if (!isAllowedUniversalLinkUrl(urlInfo)) {
    return false;
  }

  if (!urlInfo.pathname.startsWith(UL_MATCH_PREFIX)) {
    return false;
  }

  const target = urlInfo.pathname
    .slice(UL_MATCH_PREFIX.length)
    .replace(/^\/+/, '')
    .split('/')[0];
  return target === WALLETCONNECT_REDIRECT_PATH || target === 'wc';
}

function parseActionAndProcessLink(
  appLink: string,
  onActions?: OnParseUrlAndProcessAction,
) {
  const walletConnectUri = parseWalletConnectUriFromLink(appLink);
  if (walletConnectUri) {
    onActions?.({
      type: 'walletconnect-uri',
      uri: walletConnectUri,
    });
    return;
  }

  if (isWalletConnectRedirectLink(appLink)) {
    onActions?.({
      type: 'walletconnect-redirect',
    });
    return;
  }

  const nonProductionAction = parseNonProductionLink(appLink);
  if (nonProductionAction) {
    onActions?.(nonProductionAction);
    return;
  }

  const targetAction = parseRabbyGoTargetAction(appLink);
  if (targetAction) {
    onActions?.(targetAction);
    return;
  }

  const openHomeAction = parseOpenHomeAction(appLink);
  if (openHomeAction) {
    onActions?.(openHomeAction);
    return;
  }

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo || !isAllowedUniversalLinkUrl(urlInfo)) {
    return;
  }
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');

  if (rabbyGoCmd === 'open-dapp') {
    const dappUrlRaw = urlInfo.searchParams.get('dapp');
    const dappUrl = dappUrlRaw || '';
    if (!dappUrl) {
      console.warn(
        '[useUniversalLinkOnTop] No dapp URL found in link:',
        sanitizeLinkForLogging(appLink),
      );
      return;
    }

    const openDappAction = parseOpenDappAction(dappUrl);
    if (openDappAction.type === 'open-dapp') {
      console.debug('[useUniversalLinkOnTop] Opening dapp URL:', dappUrl);
    }
    onActions?.(openDappAction);
    return;
  }

  if (rabbyGoCmd) {
    return;
  }
}

const toastTip = toastWithIcon(RcIconInfoForToast);

const clearAppCacheFromLinkStateRef = {
  running: false,
};

async function clearAppCacheFromLink() {
  if (clearAppCacheFromLinkStateRef.running) {
    return;
  }

  if (!isKeyringUnlockedSnapshot() && !isUnlockSessionValid()) {
    console.warn(
      '[useUniversalLinkOnTop] clear app cache link ignored before unlock',
    );
    return;
  }

  clearAppCacheFromLinkStateRef.running = true;
  try {
    abortAllSyncTasks('clear-app-cache-link');
    resetUpdateHistoryTime();
    await RNFS.clearSafeSvgCache();
    await dropAppDataSourceAndQuitApp({
      exitDelayMs: 300,
    });
  } catch (error) {
    clearAppCacheFromLinkStateRef.running = false;
    console.error('[useUniversalLinkOnTop] clear app cache failed', error);
  }
}

async function applyDebugDbSyncPolicyFromLink(
  policy?: Parameters<OnParseUrlAndProcessAction>[0]['debugDbSyncPolicy'],
) {
  if (!policy) {
    return;
  }

  if (policy.resetWritePolicyOverride) {
    clearDbSyncWritePolicyOverride('all-history');
  }
  if (policy.writePolicyOverride) {
    setDbSyncWritePolicyOverride('all-history', policy.writePolicyOverride);
  }

  console.info('[useUniversalLinkOnTop] debug db sync policy applied', {
    writePolicy: getDbSyncWritePolicyDebugSnapshot('all-history'),
  });
}

async function debugSyncAllHistoryFromLink(
  policy?: Parameters<OnParseUrlAndProcessAction>[0]['debugDbSyncPolicy'],
) {
  await applyDebugDbSyncPolicyFromLink(policy);

  if (!isKeyringUnlockedSnapshot() && !isUnlockSessionValid()) {
    console.warn(
      '[useUniversalLinkOnTop] debug history all-sync link ignored before unlock',
    );
    return;
  }

  try {
    const { debugResetAndSyncAllHistory } = await import(
      '@/databases/debug/historySyncDebug'
    );
    await debugResetAndSyncAllHistory(policy);
  } catch (error) {
    console.error(
      '[useUniversalLinkOnTop] debug history all-sync failed',
      error,
    );
  }
}

function runWhenNavigationReady(
  run: () => void,
  actionName: string,
  retryCount = 0,
) {
  if (navigationRef.isReady()) {
    run();
    return;
  }

  if (retryCount >= 40) {
    console.warn(
      `[useUniversalLinkOnTop] Navigation is not ready for ${actionName}`,
    );
    return;
  }

  setTimeout(() => {
    runWhenNavigationReady(run, actionName, retryCount + 1);
  }, 100);
}

function dispatchWhenNavigationReady(
  action: ReturnType<typeof StackActions.push>,
  actionName: string,
) {
  runWhenNavigationReady(() => navigationRef.dispatch(action), actionName);
}

function resetExistingHomeFlowToOverview() {
  const rootState = navigationRef.getRootState();
  if (!rootState || !canResetRootToHome(rootState)) {
    return false;
  }

  const activeRootRoute = rootState.routes[rootState.index];
  if (
    rootState.routes.length !== 1 ||
    activeRootRoute?.name !== RootNames.StackRoot ||
    navigationRef.getCurrentRoute()?.name !== RootNames.Home
  ) {
    navigationRef.resetRoot(makeOpenHomeRootState());
  }

  apisHomeTabIndex.setTabIndex(0);
  return true;
}

async function openRabbyGoTarget(target: RabbyGoTarget) {
  if (!resetExistingHomeFlowToOverview()) {
    return;
  }

  const nestedRoute = getRabbyGoTargetNestedRoute(target);
  if (!nestedRoute) {
    return;
  }

  if (target === 'swap' || target === 'bridge') {
    const currentAccount = getFallbackAccountSnapshot();
    if (!currentAccount) {
      return;
    }
    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
  }

  navigationRef.dispatch(
    StackActions.push(RootNames.StackTransaction, nestedRoute),
  );
}

const handleActions: OnParseUrlAndProcessAction = payload => {
  switch (payload.type) {
    case 'open-target': {
      const target = payload.target || 'home';
      runWhenNavigationReady(() => {
        const rootState = navigationRef.getRootState();
        if (!rootState) {
          // The newer @react-navigation typings allow a momentarily missing
          // root state right after the container reports ready. There is
          // nothing to route into (and no unlock state to inspect) yet.
          return;
        }
        const activeRootRoute = rootState.routes[rootState.index];
        if (activeRootRoute?.name === RootNames.Unlock) {
          UnlockUIManager.queueResetNaviOnTopOfHomeWhenUnlock(
            async ({ defaultAction }) => {
              await defaultAction?.();
              await openRabbyGoTarget(target);
            },
            { forceWaitUnlock: true },
          );
          return;
        }

        void openRabbyGoTarget(target);
      }, `open-${target}`);
      break;
    }
    case 'open-dapp':
      if (!payload.dappUrl) {
        return;
      }
      browserApis.openTab(payload.dappUrl, {
        isNewTab: true,
      });
      break;
    case 'walletconnect-uri':
      if (!payload.uri) {
        return;
      }
      pairWalletConnectUri({
        uri: payload.uri,
        source: 'deeplink',
      }).catch(() => {
        // WalletConnectModalHost consumes the pairing error event once.
      });
      break;
    case 'walletconnect-redirect':
      markWalletConnectDappRedirectPending('metadata_redirect');
      break;
    case 'open-testkit-screen':
      if (!payload.testkitScreen) {
        return;
      }
      if (
        isNonPublicProductionEnv &&
        typeof payload.testkitParams?.appLaunchLock === 'boolean'
      ) {
        setAppLaunchLockEnabled(payload.testkitParams.appLaunchLock);
        console.info('[useUniversalLinkOnTop] App Launch Lock set by testkit', {
          enabled: payload.testkitParams.appLaunchLock,
        });
      }
      if (
        isNonPublicProductionEnv &&
        typeof payload.testkitParams?.sensitiveSceneProtection === 'boolean'
      ) {
        setSensitiveSceneProtectionEnabled(
          payload.testkitParams.sensitiveSceneProtection,
        );
        console.info(
          '[useUniversalLinkOnTop] Sensitive Scene Protection set by testkit',
          {
            enabled: payload.testkitParams.sensitiveSceneProtection,
            restartRequired: IS_IOS,
          },
        );
      }
      if (
        isNonPublicProductionEnv &&
        payload.testkitScreen === RootNames.DevDataKeychain &&
        payload.testkitParams?.keychainVersion
      ) {
        const appliedVersion = setCurrentKeychainVersion(
          payload.testkitParams.keychainVersion,
        );
        console.info(
          '[useUniversalLinkOnTop] Keychain version set for next cold start',
          { appliedVersion },
        );
        setTimeout(() => {
          RNHelpers.forceExitApp();
        }, 100);
        return;
      }
      dispatchWhenNavigationReady(
        StackActions.push(RootNames.StackTestkits, {
          screen: payload.testkitScreen,
          params: payload.testkitParams,
        }),
        payload.testkitScreen,
      );
      break;
    case 'clear-app-cache':
      void clearAppCacheFromLink();
      break;
    case 'debug-sync-all-history':
      void debugSyncAllHistoryFromLink(payload.debugDbSyncPolicy);
      break;
    case 'debug-db-sync-policy':
      void applyDebugDbSyncPolicyFromLink(payload.debugDbSyncPolicy);
      break;
    case 'debug-lending':
      if (!isNonPublicProductionEnv || !payload.debugLending) {
        return;
      }
      void import('@/screens/Lending/debugDeepLink')
        .then(module =>
          module.runNonProductionLendingDebugCommand(payload.debugLending!, {
            openLending: () => {
              dispatchWhenNavigationReady(
                StackActions.push(RootNames.StackTransaction, {
                  screen: RootNames.Lending,
                  params: {
                    dappId: 'aave',
                  },
                }),
                RootNames.Lending,
              );
            },
          }),
        )
        .catch(error => {
          console.error(
            '[useUniversalLinkOnTop] Lending debug command failed',
            {
              command: payload.debugLending,
              error,
            },
          );
        });
      break;
    case 'debug-open-target':
      if (!isNonPublicProductionEnv || !payload.debugOpenTarget) {
        return;
      }
      runWhenNavigationReady(() => {
        if (!navigationRef.getRootState()) {
          return;
        }
        const target = payload.debugOpenTarget!;
        if (target === 'tokenDetail') {
          const chain = findChain({
            serverId: payload.debugOpenTargetChain || 'eth',
          });
          if (!chain) {
            console.warn(
              '[useUniversalLinkOnTop] unknown chain for tokenDetail:',
              payload.debugOpenTargetChain,
            );
            return;
          }
          navigateDeprecated(RootNames.TokenDetail, {
            token: makeTokenFromChain(chain),
            isSingleAddress: true,
          } as any);
          return;
        }
        if (target === 'tokenMarketDetail') {
          const chain = findChain({
            serverId: payload.debugOpenTargetChain || 'eth',
          });
          if (!chain) {
            console.warn(
              '[useUniversalLinkOnTop] unknown chain for tokenMarketDetail:',
              payload.debugOpenTargetChain,
            );
            return;
          }
          navigateDeprecated(RootNames.TokenMarketInfo, {
            token: makeTokenFromChain(chain),
          } as any);
          return;
        }
        // Optional modifier on any debug target: pin the chain projection in
        // its "loading, no chains yet" state before navigating (QA 1157).
        if (payload.debugChainStatsLoadingForMs) {
          forceDebugChainStatsFor(payload.debugChainStatsLoadingForMs);
        } else if (payload.debugChainStatsLoading) {
          toggleDebugChainStatsForced(true);
        } else if (payload.debugChainStatsLoadingOff) {
          toggleDebugChainStatsForced(false);
        }
        if (target === 'homeAssets') {
          apisHomeTabIndex.setTabIndex(1, true);
          return;
        }
        if (target === 'singleHome') {
          const account = getFallbackAccountSnapshot();
          if (!account) {
            return;
          }
          apisSingleHome.navigateToSingleHome(account as any);
          return;
        }
        if (target === 'chainLoading') {
          const forced = toggleDebugChainStatsForced();
          console.log(
            '[debug-open-target] chain selector loading forced:',
            forced,
          );
          return;
        }
        if (target === 'approvals') {
          const account = getFallbackAccountSnapshot();
          if (!account) {
            return;
          }
          navigateDeprecated(RootNames.StackTransaction, {
            screen: RootNames.Approvals,
            params: { account },
          } as any);
          return;
        }
        if (target === 'importSecret') {
          navigateDeprecated(RootNames.ImportSecret, {
            initialTab: payload.debugOpenTargetTab,
          } as any);
          return;
        }
        if (target === 'importMethods') {
          navigateDeprecated(RootNames.StackAddress, {
            screen: RootNames.ImportMethods,
            params: {},
          } as any);
          return;
        }
        void openRabbyGoTarget(target);
      }, `debug-open-${payload.debugOpenTarget}`);
      break;
    case 'debug-open-screen':
      if (!isNonPublicProductionEnv || !payload.debugOpenScreen) {
        return;
      }
      void import('@/devtools/screenRegistry')
        .then(async module => {
          const request = payload.debugOpenScreen!;
          if (request.list) {
            console.log(
              '[debug-open-screen] registered screens:',
              JSON.stringify(module.listRegisteredScreens()),
            );
            if (!request.screen) {
              return;
            }
          }
          if (!request.screen) {
            return;
          }
          const opened = await module.openScreenForDebug({
            screen: request.screen,
            params: request.params,
            paramsFile: request.paramsFile,
            props: request.props,
            store: request.store,
            storePin: request.storePin,
            storePinClear: request.storePinClear,
            push: request.push,
          });
          console.log(
            `[debug-open-screen] screen=${request.screen} opened=${opened}`,
          );
        })
        .catch(error => {
          console.error('[debug-open-screen] failed', error);
        });
      break;
    case 'debug-set-language':
      if (!isNonPublicProductionEnv || !payload.debugLanguage) {
        return;
      }
      void import('@/hooks/lang').then(({ setAppLanguage }) =>
        setAppLanguage(payload.debugLanguage!),
      );
      break;
    case 'debug-open-history-local-detail':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [
            { transactionHistoryServiceApi },
            { getSelectedBalanceAddressesSnapshot },
            { naviPush },
            { RootNames },
            { HistoryItemCateType },
            { toast },
          ] = await Promise.all([
            import('@/core/serviceApi/transactionHistory'),
            import('@/store/balance'),
            import('@/utils/navigation'),
            import('@/constant/layout'),
            import('@/types/history'),
            import('@/components2024/Toast'),
          ]);
          const address = (
            payload.debugOpenHistoryLocalDetail?.address ||
            getSelectedBalanceAddressesSnapshot()[0] ||
            ''
          ).toLowerCase();
          if (!address) {
            throw new Error('no address available');
          }
          let { pendings, completeds } =
            await transactionHistoryServiceApi.getList(address);
          if (
            pendings.length === 0 &&
            completeds.length === 0 &&
            payload.debugOpenHistoryLocalDetail?.seed
          ) {
            // A locally-submitted transaction only exists after this install
            // sends something. Seed the real store shape so the screen can be
            // exercised without spending gas; it stays in the local store until
            // the app data is cleared.
            const nonce = Math.floor(Date.now() / 1000) % 100000;
            const random = Math.random().toString(16).slice(2).padEnd(64, '0');
            const seedTx = {
              address,
              chainId: 1,
              nonce,
              rawTx: {
                chainId: 1,
                from: address,
                to: '0x000000000000000000000000000000000000dEaD',
                value: '0x0',
                nonce: `0x${nonce.toString(16)}`,
                gasPrice: '0x3b9aca00',
                gas: '0x5208',
                data: '0x',
              },
              createdAt: Date.now(),
              hash: `0x${random}`,
              reqId: `debug-${Date.now()}`,
              isPending: true,
              gasTokenSymbol: 'ETH',
              gasUSDValue: 0.01,
              gasTokenCount: 0.0001,
            } as never;
            transactionHistoryServiceApi.setStore(draft => [...draft, seedTx]);
            ({ pendings, completeds } =
              await transactionHistoryServiceApi.getList(address));
            console.log(
              '[debug-open-history-local-detail] seeded pending tx',
              JSON.stringify({ address, nonce }),
            );
          }
          const list =
            payload.debugOpenHistoryLocalDetail?.prefer === 'pending'
              ? [...pendings, ...completeds]
              : [...completeds, ...pendings];
          const data = list[payload.debugOpenHistoryLocalDetail?.index ?? 0];
          if (!data) {
            throw new Error(
              `no local tx groups (pending=${pendings.length}, completed=${completeds.length})`,
            );
          }
          naviPush(RootNames.StackTransaction, {
            screen: RootNames.HistoryLocalDetail,
            params: {
              isForMultipleAddress: false,
              data,
              type: HistoryItemCateType.Swap,
              title: 'Transactions',
            },
          });
          console.log(
            '[debug-open-history-local-detail] opened',
            JSON.stringify({
              address,
              pending: pendings.length,
              completed: completeds.length,
              isPending: (data as { isPending?: boolean }).isPending,
            }),
          );
        } catch (error) {
          console.warn('[debug-open-history-local-detail] failed', error);
          const { toast } = await import('@/components2024/Toast');
          toast.show(`open-history-local-detail failed: ${String(error)}`);
        }
      })();
      break;
    case 'debug-open-bridge-detail':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [
            { transactionHistoryServiceApi },
            { getSelectedBalanceAddressesSnapshot },
            { openapi },
            bridgeHistoryUtils,
            { openBridgeDetail },
            { toast },
          ] = await Promise.all([
            import('@/core/serviceApi/transactionHistory'),
            import('@/store/balance'),
            import('@/core/request'),
            import('@/screens/Transaction/utils/bridgeHistory'),
            import('@/screens/Bridge/utils/navigation'),
            import('@/components2024/Toast'),
          ]);

          const address = (
            payload.debugOpenBridgeDetail?.address ||
            getSelectedBalanceAddressesSnapshot()[0] ||
            ''
          ).toLowerCase();
          if (!address) {
            throw new Error('no address available');
          }
          const locals = (await transactionHistoryServiceApi.getBridgeTxHistory(
            address,
          )) as Array<{
            hash: string;
            fromToken?: { chain?: string };
            fromChainId?: number;
          }>;
          const local = locals[payload.debugOpenBridgeDetail?.index ?? 0];

          // Indexed bridge rows live in the history DB, not in the local
          // pending-tx store; fall back to `cate_id === 'bridge'` rows there.
          let candidates: Array<{ hash: string; chain: string }> = local
            ? [{ hash: local.hash, chain: local.fromToken?.chain || '' }]
            : [];
          if (candidates.length === 0) {
            const { HistoryItemEntity } = await import(
              '@/databases/entities/historyItem'
            );
            const page = await HistoryItemEntity.getHistoryItemsPaginated(
              [address],
              { pageSize: 200 },
            );
            // Bridge rows are not stored with `cate_id === 'bridge'`; the
            // bridge lookup resolves them from the tx id, so probe every recent
            // row and let the bridge API decide which ones are bridges.
            candidates = page.items
              .filter(item => !!item.txHash)
              .slice(0, 100)
              .map(item => ({ hash: item.txHash, chain: item.chain }));
          }
          if (candidates.length === 0) {
            throw new Error(
              `no bridge history rows (local=${locals.length}) for ${address}`,
            );
          }

          // The API caps `from_tx_ids`; probe recent hashes in small batches and
          // stop at the first record that resolves to a bridge.
          const hashes = [
            ...new Set(candidates.map(item => item.hash.toLowerCase())),
          ];
          const BATCH = 10;
          let history: Record<string, unknown> | undefined;
          for (let start = 0; start < hashes.length; start += BATCH) {
            const batch = hashes.slice(start, start + BATCH);
            const { data } = await openapi.request.post<{
              history_list?: Array<Record<string, unknown>>;
            }>('/v1/bridge/history_list_by_tx_ids', {
              from_tx_ids: batch,
            });
            const list = Array.isArray(data?.history_list)
              ? data!.history_list
              : [];
            const found = list.find(item =>
              candidates.some(
                candidate =>
                  bridgeHistoryUtils.bridgeSourceKey(item as never) ===
                  bridgeHistoryUtils.historyTxKey(
                    candidate.chain,
                    candidate.hash,
                  ),
              ),
            );
            if (found) {
              history = found;
              break;
            }
          }
          if (!history) {
            throw new Error(
              `bridge history API returned nothing (candidates=${candidates.length})`,
            );
          }
          openBridgeDetail({
            address,
            history: history as never,
            local: local as never,
          });
          console.log(
            '[debug-open-bridge-detail] opened',
            JSON.stringify({
              address,
              candidates: candidates.length,
              chain: candidates[0]?.chain,
              hasHistory: true,
            }),
          );
        } catch (error) {
          console.warn('[debug-open-bridge-detail] failed', error);
          const { toast } = await import('@/components2024/Toast');
          toast.show(`open-bridge-detail failed: ${String(error)}`);
        }
      })();
      break;
    case 'debug-dump-route':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [{ getLatestNavigationName }, { navigationRef }] =
            await Promise.all([
              import('@/utils/navigation'),
              import('@/utils/navigation'),
            ]);
          const currentRoute = navigationRef.getCurrentRoute();
          const { dumpRouteParams } = await import(
            '@/devtools/screenRegistry/routeFixtures'
          );
          await dumpRouteParams(
            currentRoute?.name || getLatestNavigationName(),
            currentRoute?.params as Record<string, unknown> | undefined,
            payload.debugDumpRoute?.name,
          );
        } catch (error) {
          console.warn(
            '[useUniversalLinkOnTop] debug-dump-route failed',
            error,
          );
        }
      })();
      break;
    case 'debug-export-history':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [
            { openapi },
            { getSelectedBalanceAddressesSnapshot },
            { DocumentDirectoryPath, mkdir, writeFile },
            { txResultToToHistoryDisplayItem },
          ] = await Promise.all([
            import('@/core/request'),
            import('@/store/balance'),
            import('@rabby-wallet/react-native-fs'),
            import('@/utils/transaction'),
          ]);
          const address = (
            payload.debugExportHistory?.address ||
            getSelectedBalanceAddressesSnapshot()[0] ||
            ''
          ).toLowerCase();
          if (!address) {
            throw new Error('no address available');
          }
          const chain = payload.debugExportHistory?.chain;
          const days = payload.debugExportHistory?.days ?? 30;
          const maxPages = payload.debugExportHistory?.pages ?? 10;
          const pageCount = 20;
          const until = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
          const historyList: Record<string, any>[] = [];
          const tokenDict: Record<string, any> = {};
          const projectDict: Record<string, any> = {};
          const cateDict: Record<string, any> = {};
          const seen = new Set<string>();
          let startTime = 0;
          for (let page = 0; page < maxPages; page++) {
            const res = (await openapi.listTxHistory({
              id: address,
              ...(chain ? { chain_id: chain } : {}),
              start_time: startTime,
              page_count: pageCount,
            })) as any;
            const list: Record<string, any>[] = res?.history_list ?? [];
            Object.assign(tokenDict, res?.token_dict ?? {});
            Object.assign(projectDict, res?.project_dict ?? {});
            Object.assign(cateDict, res?.cate_dict ?? {});
            for (const item of list) {
              const key = String(item?.id ?? '');
              if (!key || seen.has(key)) {
                continue;
              }
              seen.add(key);
              historyList.push(item);
            }
            const lastItem = list[list.length - 1];
            if (!lastItem?.time_at || lastItem.time_at < until) {
              break;
            }
            if (lastItem.time_at === startTime) {
              break;
            }
            startTime = lastItem.time_at;
            if (list.length < pageCount) {
              break;
            }
          }
          const displayItems = txResultToToHistoryDisplayItem({
            address,
            res: {
              history_list: historyList,
              token_dict: tokenDict,
              project_dict: projectDict,
              cate_dict: cateDict,
            } as any,
            pinedQueue: [],
            customTxItemsMap: {},
            transactions: [],
          });
          const dir = `${DocumentDirectoryPath}/screen-registry-fixtures`;
          await mkdir(dir);
          const fileName = (
            payload.debugExportHistory?.name ||
            `history-export-${address.slice(-6)}`
          )
            .replace(/[^\w.-]/g, '_')
            .slice(0, 80);
          const filePath = `${dir}/${fileName}.json`;
          await writeFile(
            filePath,
            JSON.stringify(
              {
                address,
                chain: chain ?? null,
                days,
                fetchedAt: Date.now(),
                count: displayItems.length,
                items: displayItems,
              },
              null,
              2,
            ),
            'utf8',
          );
          const histogram: Record<string, number> = {};
          for (const item of displayItems) {
            const key = String(
              (item as any)?.history_type ?? item?.historyType ?? 'unknown',
            );
            histogram[key] = (histogram[key] ?? 0) + 1;
          }
          console.log(
            `[debug-export-history] ${displayItems.length} items -> ${fileName}.json`,
            histogram,
          );
        } catch (error) {
          console.warn('[debug-export-history] failed', error);
        }
      })();
      break;
    case 'debug-capture-requests':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const { setRequestCaptureEnabled, setAllowAnyApproval } =
            await import('@/devtools/screenRegistry/requestCapture');
          const on = payload.debugCaptureRequests?.on ?? false;
          setRequestCaptureEnabled(on);
          setAllowAnyApproval(
            payload.debugCaptureRequests?.allowAnyApproval ?? false,
          );
          console.log(
            '[debug-capture-requests]',
            on ? 'enabled' : 'disabled',
            'allowAnyApproval=',
            payload.debugCaptureRequests?.allowAnyApproval ?? false,
          );
        } catch (error) {
          console.warn('[debug-capture-requests] failed', error);
        }
      })();
      break;
    case 'debug-dapp-eval':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const { emitBrowserEval } = await import(
            '@/devtools/screenRegistry/browserEval'
          );
          const code = payload.debugDappEval?.code;
          if (!code) {
            throw new Error('missing code');
          }
          emitBrowserEval(code);
          console.log('[debug-dapp-eval] dispatched');
        } catch (error) {
          console.warn('[debug-dapp-eval] failed', error);
        }
      })();
      break;
    case 'debug-set-current-account':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [{ getAllAccountsToDisplay }, { setCurrentAccount }] =
            await Promise.all([
              import('@/core/apis/account'),
              import('@/core/serviceApi/preference'),
            ]);
          const input = (payload.debugSetCurrentAccount?.address || '')
            .toLowerCase()
            .trim();
          if (!input) {
            throw new Error('missing address');
          }
          const accounts = await getAllAccountsToDisplay();
          const match = accounts.find(account => {
            const address = String(account.address || '').toLowerCase();
            if (address === input) {
              return true;
            }
            const [prefix, suffix] = input.split('...');
            return Boolean(
              prefix &&
                suffix &&
                address.startsWith(prefix) &&
                address.endsWith(suffix),
            );
          });
          if (!match) {
            console.warn(
              '[debug-set-current-account] available',
              accounts
                .map(account => `${account.address}:${account.brandName}`)
                .join(', '),
            );
            throw new Error(`account not found: ${input}`);
          }
          await setCurrentAccount(match as any);
          console.log(
            '[debug-set-current-account] set',
            match.address,
            match.brandName,
          );
        } catch (error) {
          console.warn('[debug-set-current-account] failed', error);
        }
      })();
      break;
    case 'debug-disconnect-dapp':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const { removeDapp } = await import('@/core/apis/dapp');
          const origin = payload.debugDisconnectDapp?.origin;
          if (!origin) {
            throw new Error('missing origin');
          }
          await removeDapp(origin);
          console.log('[debug-disconnect-dapp] removed', origin);
        } catch (error) {
          console.warn('[debug-disconnect-dapp] failed', error);
        }
      })();
      break;
    case 'debug-dump-approval':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [
            { notificationServiceApi },
            { DocumentDirectoryPath, mkdir, writeFile },
          ] = await Promise.all([
            import('@/core/serviceApi/notification'),
            import('@rabby-wallet/react-native-fs'),
          ]);
          const approval = await notificationServiceApi.getApproval();
          if (!approval) {
            console.warn('[debug-dump-approval] no current approval');
            return;
          }
          const data = (approval as any).data;
          const name = (
            payload.debugDumpApproval?.name ||
            `approval-${data?.approvalComponent || 'unknown'}`
          )
            .replace(/[^\w.-]/g, '_')
            .slice(0, 80);
          const dir = `${DocumentDirectoryPath}/screen-registry-fixtures`;
          await mkdir(dir);
          await writeFile(
            `${dir}/${name}.json`,
            JSON.stringify(
              {
                capturedAt: Date.now(),
                approvalComponent: data?.approvalComponent,
                origin: data?.origin,
                approvalType: data?.approvalType,
                params: data?.params,
              },
              null,
              2,
            ),
            'utf8',
          );
          console.log(
            '[debug-dump-approval] wrote',
            name,
            data?.approvalComponent,
            data?.origin,
          );
        } catch (error) {
          console.warn('[debug-dump-approval] failed', error);
        }
      })();
      break;
    case 'debug-open-modal':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const { createGlobalBottomSheetModal2024 } = await import(
            '@/components2024/GlobalBottomSheetModal'
          );
          const { MODAL_CONFIGS } = await import(
            '@/components2024/GlobalBottomSheetModal/utils'
          );
          if (payload.debugOpenModal?.list) {
            const list = Object.entries(MODAL_CONFIGS).map(
              ([modalName, cfg]) => ({
                name: modalName,
                snapPoints: (cfg as any)?.snapPoints,
              }),
            );
            console.log(
              `[debug-open-modal] ${list.length} modals`,
              list.map(item => item.name).join(', '),
            );
            const { DocumentDirectoryPath, mkdir, writeFile } = await import(
              '@rabby-wallet/react-native-fs'
            );
            const dir = `${DocumentDirectoryPath}/screen-registry-fixtures`;
            await mkdir(dir);
            await writeFile(
              `${dir}/modals.json`,
              JSON.stringify(list, null, 2),
              'utf8',
            );
            return;
          }
          const name = payload.debugOpenModal?.modal;
          if (!name) {
            throw new Error('missing modal name');
          }
          if (!(name in MODAL_CONFIGS)) {
            console.warn(
              '[debug-open-modal] unknown modal',
              name,
              'available:',
              Object.keys(MODAL_CONFIGS).join(', '),
            );
            return;
          }
          const id = createGlobalBottomSheetModal2024({
            name: name as any,
            ...(payload.debugOpenModal?.props ?? {}),
          });
          console.log('[debug-open-modal] opened', name, id);
        } catch (error) {
          console.warn('[debug-open-modal] failed', error);
        }
      })();
      break;
    case 'debug-inject-approval':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          const [
            { notificationServiceApi, unlockNotificationSync },
            { getFallbackAccountSnapshot },
            { getSelectedBalanceAddressesSnapshot },
            { INTERNAL_REQUEST_ORIGIN },
            { readRouteFixture, getRouteFixturePath },
            { readFile },
            {
              setApprovalParseOverride,
              clearApprovalParseOverride,
              setApprovalParseCapture,
            },
          ] = await Promise.all([
            import('@/core/serviceApi/notification'),
            import('@/core/serviceApi/preference'),
            import('@/store/balance'),
            import('@/constant'),
            import('@/devtools/screenRegistry/routeFixtures'),
            import('@rabby-wallet/react-native-fs'),
            import('@/devtools/screenRegistry/approvalParseOverride'),
          ]);
          const fallbackAccount = getFallbackAccountSnapshot();
          const address = (
            (payload.debugInjectApproval as any)?.address ||
            fallbackAccount?.address ||
            getSelectedBalanceAddressesSnapshot()[0] ||
            ''
          ).toLowerCase();
          if (!address) {
            throw new Error('no account available');
          }
          const account = fallbackAccount || {
            address,
            type: 'Simple Key Pair',
            brandName: 'Simple Key Pair',
            aliasName: '',
          };
          let params = payload.debugInjectApproval?.params as
            | Record<string, unknown>
            | undefined;
          if (!params && payload.debugInjectApproval?.paramsFile) {
            params = await readRouteFixture(
              payload.debugInjectApproval.paramsFile,
            );
          }
          if (!params) {
            const component =
              payload.debugInjectApproval?.component ?? 'SignTx';
            const session = { origin: INTERNAL_REQUEST_ORIGIN };
            if (component === 'SignText') {
              // "Hello, Rabby!" as hex; SignText decodes hex2Text(data[0]).
              params = {
                data: ['0x48656c6c6f2c20526162627921', address],
                session,
                requestContext: { chainId: 1 },
              };
            } else if (component === 'SignTypedData') {
              const typedData = {
                types: {
                  EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' },
                  ],
                  Person: [
                    { name: 'name', type: 'string' },
                    { name: 'wallet', type: 'address' },
                  ],
                  Mail: [
                    { name: 'from', type: 'Person' },
                    { name: 'to', type: 'Person' },
                    { name: 'contents', type: 'string' },
                  ],
                },
                primaryType: 'Mail',
                domain: {
                  name: 'Rabby Debug',
                  version: '1',
                  chainId: 1,
                  verifyingContract:
                    '0x0000000000000000000000000000000000000000',
                },
                message: {
                  from: { name: 'Alice', wallet: address },
                  to: { name: 'Bob', wallet: address },
                  contents: 'Hello from the debug harness',
                },
              };
              params = {
                data: [address, JSON.stringify(typedData)],
                session,
                method: 'eth_signTypedData_v4',
                requestContext: { chainId: 1 },
              };
            } else if (component === 'Connect') {
              params = {
                icon: 'https://app.uniswap.org/favicon.png',
                origin: 'https://app.uniswap.org',
              };
            } else if (component === 'AddChain') {
              params = {
                data: [
                  {
                    chainId: '0x1',
                    chainName: 'Rabby Debug Chain',
                    rpcUrls: ['https://eth.llamarpc.com'],
                    nativeCurrency: {
                      name: 'Ether',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    blockExplorerUrls: ['https://etherscan.io'],
                  },
                ],
                session,
              };
            } else if (component === 'AddAsset') {
              params = {
                data: {
                  type: 'ERC20',
                  options: {
                    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                    symbol: 'USDT',
                    decimals: 6,
                    image: '',
                  },
                },
                session,
                requestContext: { chainId: 1 },
              };
            } else {
              params = {
                data: [
                  {
                    from: address,
                    to: '0x000000000000000000000000000000000000dEaD',
                    value: '0x0',
                    data: '0x',
                    chainId: 1,
                    gas: '0x5208',
                    gasPrice: '0x3b9aca00',
                  },
                ],
                session,
                requestContext: { chainId: 1 },
              };
            }
          }
          if (payload.debugInjectApproval?.parseFile) {
            const raw = await readFile(
              getRouteFixturePath(payload.debugInjectApproval.parseFile),
              'utf8',
            );
            const parsed = JSON.parse(raw);
            setApprovalParseOverride({
              typedDataKey: parsed.typedDataKey,
              response: parsed.response,
            });
            console.log(
              '[debug-inject-approval] parse override set',
              payload.debugInjectApproval.parseFile,
            );
          } else {
            clearApprovalParseOverride();
          }
          if (payload.debugInjectApproval?.parseCapture) {
            setApprovalParseCapture(payload.debugInjectApproval.parseCapture);
          }
          // Recover from a stale modal handle left by a previous dismissal.
          try {
            await notificationServiceApi.clear();
          } catch {
            // ignore
          }
          // The notification service locks itself when a window opens and only
          // the rpc flow unlocks it. A direct injection must do the same.
          unlockNotificationSync();
          const result = await notificationServiceApi.requestApproval({
            approvalComponent:
              payload.debugInjectApproval?.component ?? 'SignTx',
            params,
            account: account as any,
            origin:
              payload.debugInjectApproval?.origin ?? INTERNAL_REQUEST_ORIGIN,
            approvalType:
              payload.debugInjectApproval?.approvalType ??
              payload.debugInjectApproval?.component ??
              'SignTx',
          } as any);
          unlockNotificationSync();
          console.log('[debug-inject-approval] resolved', result);
        } catch (error) {
          try {
            const { unlockNotificationSync: unlock } = await import(
              '@/core/serviceApi/notification'
            );
            unlock();
          } catch {
            // ignore
          }
          console.warn('[debug-inject-approval] failed', error);
        }
      })();
      break;
    case 'debug-import-private-key':
      if (
        !isNonPublicProductionEnv ||
        !payload.debugPrivateKeyImport?.keys.length
      ) {
        return;
      }
      void (async () => {
        const imported: Array<{ address: string; label?: string }> = [];
        try {
          const [{ verifyPasswordOrUnlock }, { importPrivateKey }, { toast }] =
            await Promise.all([
              import('@/core/apis/lock'),
              import('@/core/apis/privateKey'),
              import('@/components2024/Toast'),
            ]);
          const { REGRESSION_DEFAULT_PASSWORD } = await import(
            '@/devtools/regressionScenarios/credentials.nonprod'
          );
          // The import API is guarded by ensureWalletUnlocked(); unlocking with
          // the regression password first keeps the flow headless.
          await verifyPasswordOrUnlock(
            payload.debugPrivateKeyImport!.password ||
              REGRESSION_DEFAULT_PASSWORD,
          );
          for (const key of payload.debugPrivateKeyImport!.keys) {
            const accounts = await importPrivateKey(key);
            const address = accounts?.[0]?.address || '';
            imported.push({ address });
            console.log('[debug-import-private-key] imported', address);
          }
          toast.success(
            `debug import: ${imported.length} private-key account(s)`,
          );
        } catch (error) {
          console.warn(
            '[useUniversalLinkOnTop] debug-import-private-key failed',
            imported.length,
            String(error),
          );
          const { toast } = await import('@/components2024/Toast');
          toast.show(
            `import-private-key failed after ${imported.length}: ${String(
              error,
            )}`,
          );
        }
      })();
      break;
    case 'debug-create-address':
      if (!isNonPublicProductionEnv) {
        return;
      }
      void (async () => {
        try {
          // Same data mutations as the onboarding UI, in the same order:
          // the create-seed-phrase page prepares the wallet, then the
          // set-password / create-address pages submit it (password, keyring,
          // persisted accounts, backup reminder). No direct keyring shortcut.
          const { prepareWalletCreation, completeWalletCreation } =
            await import('@/hooks/address/useSetupWallet');
          const { REGRESSION_DEFAULT_PASSWORD } = await import(
            '@/devtools/regressionScenarios/credentials.nonprod'
          );
          const { toast } = await import('@/components2024/Toast');
          const { default: accountStore } = await import('@/store/account');

          const prepared = await prepareWalletCreation({ mode: 'create' });
          // `PasswordFormValues` differs between stacks (develop still has
          // `checked`, tmp carries `enableDataAnalysis`); pass the fields the
          // submit path reads and let the call site stay version-agnostic.
          await completeWalletCreation(prepared, {
            password: REGRESSION_DEFAULT_PASSWORD,
            confirmPassword: REGRESSION_DEFAULT_PASSWORD,
            checked: true,
            enableBiometrics: false,
          } as any);
          await accountStore.fetchAccounts({ force: true });
          toast.success(`debug address created: ${prepared.address || ''}`);
          apisHomeTabIndex.setTabIndex(1, true);
        } catch (error) {
          console.warn(
            '[useUniversalLinkOnTop] debug-create-address failed',
            error,
          );
          const { Alert } = await import('react-native');
          Alert.alert('debug-create-address failed', String(error));
          const { toast } = await import('@/components2024/Toast');
          toast.show(`create-address failed: ${String(error)}`);
        }
      })();
      break;
    case 'regression-scenario':
      handleRegressionScenarioCommand(
        payload.regressionScenarioCommand ?? null,
        payload.regressionScenarioError,
      );
      break;
  }
};

const hideToastRef: RefLikeObject<() => void | null> = { current: () => null };
const handleAppLink = async (url: string, isInit = false) => {
  const nonProductionAction = parseNonProductionLink(url);
  if (nonProductionAction) {
    handleActions(nonProductionAction);
    setNextAppLink('');
    return;
  }

  if (isKeyringUnlockedSnapshot() || isUnlockSessionValid()) {
    // Parse the link when the wallet is fully unlocked or in a valid post-unlock session.
    parseActionAndProcessLink(url, handleActions);
    setNextAppLink('');
  } else if (
    getPwdStatus() === PasswordStatus.UseBuiltIn ||
    (await getRabbyLockInfo()).isUseBuiltInPwd
  ) {
    hideToastRef.current = toastTip(
      t('page.universalLink.error.setupWalletFirst'),
      {
        duration: 3000,
        hideOnPress: true,
      },
    );
    setNextAppLink('');
  } else {
    if (isInit) {
      setNextAppLink(prev => prev || url);
    } else {
      setNextAppLink(url);
    }
  }
};

export function useUniversalLinkOnTop() {
  useMount(() => {
    Linking.getInitialURL().then(url => {
      if (url) {
        console.debug(
          '[useUniversalLinkOnTop] Initial URL:',
          sanitizeLinkForLogging(url),
        );
        handleAppLink(url, true);
      }
    });
  });

  useEffect(() => {
    const subscription = Linking.addEventListener('url', event => {
      console.debug(
        '[useUniversalLinkOnTop] App Link:',
        sanitizeLinkForLogging(event.url),
      );
      handleAppLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useLayoutEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const onUnlock = () => {
      hideToastRef.current?.();
      const nextAppLink = getNextAppLink();
      if (nextAppLink) {
        setNextAppLink(''); // Clear the link after handling
        parseActionAndProcessLink(nextAppLink, handleActions);
      }
    };

    void bindKeyringEvent('unlock', onUnlock)
      .then(nextCleanup => {
        if (disposed) {
          nextCleanup();
          return;
        }

        cleanup = nextCleanup;
      })
      .catch(console.error);

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
}
