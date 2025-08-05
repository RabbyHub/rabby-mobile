import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { t } from 'i18next';
import { keyringService } from '@/core/services';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useBrowser } from './browser/useBrowser';
import useMount from 'react-use/lib/useMount';
import { toastIndicator, toastWithIcon } from '@/components/Toast';
import { RcIconInfoForToast } from '@/screens/Unlock/icons';
import { getRabbyLockInfo, PasswordStatus } from '@/core/apis/lock';
import { usePasswordStatus } from './useLock';

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
  type: 'open-dapp';
  dappUrl: string;
}) => void;
function parseActionAndProcessLink(
  appLink: string,
  onActions?: OnParseUrlAndProcessAction,
) {
  if (!appLink.startsWith('https://go.rabby.io')) return;

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) return;

  if (urlInfo.pathname === '/mobile/open-dapp') {
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

export function useUniversalLinkOnTop() {
  const { openTab } = useBrowser();

  const handleActions = useCallback<OnParseUrlAndProcessAction>(
    payload => {
      switch (payload.type) {
        case 'open-dapp':
          openTab(payload.dappUrl);
          break;
      }
    },
    [openTab],
  );

  const { pwdStatus } = usePasswordStatus();

  const hideToastRef = useRef<() => void>(() => {});
  const handleAppLink = useCallback(
    async (url: string, isInit = false) => {
      if (keyringService.isUnlocked()) {
        // just parse the link if app is unlocked
        parseActionAndProcessLink(url, handleActions);
        setNextAppLink('');
      } else if (
        pwdStatus === PasswordStatus.UseBuiltIn ||
        (await getRabbyLockInfo()).isUseBuiltInPwd
      ) {
        toastTip(t('page.universalLink.error.setupWalletFirst'), {
          duration: 3000,
          hideOnPress: true,
        });
        setNextAppLink('');
      } else {
        // notify trigger unlock request here
        hideToastRef.current = toastIndicator(
          t('page.universalLink.error.unlockWalletFirst'),
          {
            duration: 30000,
            hideOnPress: false,
            isTop: true,
          },
        );

        if (isInit) {
          setNextAppLink(prev => prev || url);
        } else {
          setNextAppLink(url);
        }
      }
    },
    [pwdStatus, handleActions],
  );

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
  }, [handleAppLink]);

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
  }, [handleActions]);
}
