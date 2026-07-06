import { useEffect, useLayoutEffect } from 'react';
import { Linking } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { t } from 'i18next';
import { keyringService } from '@/core/services';
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
import { RefLikeObject } from '@/utils/type';
import {
  markWalletConnectDappRedirectPending,
  pairWalletConnectUri,
  parseWalletConnectUriFromLink,
} from '@/core/walletconnect';
import { isNonPublicProductionEnv } from '@/constant';
import { RootNames } from '@/constant/layout';
import { navigationRef } from '@/utils/navigation';

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
    | 'open-testkit-screen';
  dappUrl?: string;
  uri?: string;
  testkitScreen?:
    | typeof RootNames.DevCapabilityFile
    | typeof RootNames.DebugLogViewer
    | typeof RootNames.DevDataSQLite;
  testkitParams?: {
    tab?: 'overview' | 'debug';
  };
}) => void;

const NON_PRODUCTION_TESTKIT_SCREENS = {
  DevCapabilityFile: RootNames.DevCapabilityFile,
  DebugLogViewer: RootNames.DebugLogViewer,
  DevDataSQLite: RootNames.DevDataSQLite,
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

  const testkitAction = parseNonProductionTestkitLink(appLink);
  if (testkitAction) {
    onActions?.(testkitAction);
    return;
  }

  if (!ALLOWED_UL_DOMAINS.some(domain => appLink.startsWith(domain))) return;

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) return;
  const rabbyGoCmd = urlInfo.searchParams.get('_cmd');
  if (!rabbyGoCmd) return;

  if (rabbyGoCmd === 'open-dapp') {
    const dappUrlRaw = urlInfo.searchParams.get('dapp');
    const dappUrl = dappUrlRaw ? decodeURIComponent(dappUrlRaw) : '';
    if (!dappUrl) {
      console.warn(
        '[useUniversalLinkOnTop] No dapp URL found in link:',
        appLink,
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
  }
};

const hideToastRef: RefLikeObject<() => void | null> = { current: () => null };
const handleAppLink = async (url: string, isInit = false) => {
  const testkitAction = parseNonProductionTestkitLink(url);
  if (testkitAction) {
    handleActions(testkitAction);
    setNextAppLink('');
    return;
  }

  if (keyringService.isUnlocked() || isUnlockSessionValid()) {
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
        console.debug('[useUniversalLinkOnTop] Initial URL:', url);
        handleAppLink(url, true);
      }
    });
  });

  useEffect(() => {
    const subscription = Linking.addEventListener('url', event => {
      console.debug('[useUniversalLinkOnTop] App Link:', event.url);
      handleAppLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useLayoutEffect(() => {
    const onUnlock = () => {
      hideToastRef.current?.();
      const nextAppLink = getNextAppLink();
      if (nextAppLink) {
        setNextAppLink(''); // Clear the link after handling
        parseActionAndProcessLink(nextAppLink, handleActions);
      }
    };
    keyringService.on('unlock', onUnlock);

    return () => {
      keyringService.off('unlock', onUnlock);
    };
  }, []);
}
