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
  debugChainStatsLoading?: boolean;
  debugChainStatsLoadingForMs?: number;
  debugChainStatsLoadingOff?: boolean;
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
    case 'debug-set-language':
      if (!isNonPublicProductionEnv || !payload.debugLanguage) {
        return;
      }
      void import('@/hooks/lang').then(({ setAppLanguage }) =>
        setAppLanguage(payload.debugLanguage!),
      );
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
