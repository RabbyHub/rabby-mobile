import { useEffect, useLayoutEffect } from 'react';
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
} from '@/core/apis/lock';
import { getPwdStatus } from './useLock';
import {
  ALLOWED_UL_DOMAINS,
  UL_MATCH_PREFIX,
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
import { navigationRef } from '@/utils/navigation';
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
    | 'open-dapp'
    | 'walletconnect-uri'
    | 'walletconnect-redirect'
    | 'open-testkit-screen'
    | 'clear-app-cache'
    | 'debug-sync-all-history'
    | 'debug-db-sync-policy'
    | 'debug-lending'
    | 'regression-scenario';
  dappUrl?: string;
  uri?: string;
  testkitScreen?:
    | typeof RootNames.DevCapabilityFile
    | typeof RootNames.DevUIAnimatedTextAndView
    | typeof RootNames.DebugLogViewer
    | typeof RootNames.StartupPerformanceLogViewer
    | typeof RootNames.DevDataSQLite
    | typeof RootNames.DevSwitches;
  testkitParams?: {
    tab?: 'overview' | 'debug';
  };
  debugDbSyncPolicy?: {
    resetWritePolicyOverride?: boolean;
    writePolicyOverride?: DbSyncWritePolicyOverride;
  };
  debugLending?: {
    action: 'open' | 'refresh' | 'probe';
    market?: string;
  };
  regressionScenarioCommand?: RegressionScenarioCommand | null;
  regressionScenarioError?: string;
}) => void;

const NON_PRODUCTION_TESTKIT_SCREENS = {
  DevCapabilityFile: RootNames.DevCapabilityFile,
  DevUIAnimatedTextAndView: RootNames.DevUIAnimatedTextAndView,
  DebugLogViewer: RootNames.DebugLogViewer,
  StartupPerformanceLogViewer: RootNames.StartupPerformanceLogViewer,
  DevDataSQLite: RootNames.DevDataSQLite,
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

  return {
    type: 'open-testkit-screen',
    testkitScreen: screen,
    testkitParams:
      tabRaw === 'debug' || tabRaw === 'overview' ? { tab: tabRaw } : undefined,
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

  if (!ALLOWED_UL_DOMAINS.some(domain => appLink.startsWith(domain))) {
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

  if (!ALLOWED_UL_DOMAINS.some(domain => appLink.startsWith(domain))) {
    return;
  }

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return;
  }
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');
  if (!rabbyGoCmd) {
    return;
  }

  if (rabbyGoCmd === 'open-dapp') {
    const dappUrlRaw = urlInfo.searchParams.get('dapp');
    const dappUrl = dappUrlRaw ? decodeURIComponent(dappUrlRaw) : '';
    if (!dappUrl) {
      console.warn(
        '[useUniversalLinkOnTop] No dapp URL found in link:',
        sanitizeLinkForLogging(appLink),
      );
      return;
    }

    console.debug('[useUniversalLinkOnTop] Opening dapp URL:', dappUrl);
    onActions?.({
      type: 'open-dapp',
      dappUrl,
    });
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

function dispatchWhenNavigationReady(
  action: ReturnType<typeof StackActions.push>,
  actionName: string,
  retryCount = 0,
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(action);
    return;
  }

  if (retryCount >= 40) {
    console.warn(
      `[useUniversalLinkOnTop] Navigation is not ready for ${actionName}`,
    );
    return;
  }

  setTimeout(() => {
    dispatchWhenNavigationReady(action, actionName, retryCount + 1);
  }, 100);
}

const handleActions: OnParseUrlAndProcessAction = payload => {
  switch (payload.type) {
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
