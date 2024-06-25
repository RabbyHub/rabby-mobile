import * as React from 'react';
import { atom, useAtom } from 'jotai';
import { keyringService } from '@/core/services';
import { initApis } from '@/core/apis/init';
import { initServices } from '@/core/services/init';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';
import { EntryScriptVConsole } from '@/core/bridges/builtInScripts/loadVConsole';
import { JS_LOG_ON_MESSAGE } from '@/core/bridges/builtInScripts/onMessage';
import { syncChainList } from '@/constant/chains';
import { sleep } from '@/utils/async';
import { SPA_urlChangeListener } from '@rabby-wallet/rn-webview-bridge';
import { sendUserAddressEvent } from '@/core/apis/analytics';
import { loadSecurityChain, useGlobal } from './global';
import { useAppUnlocked, useTryUnlockAppWithBuiltinOnTop } from './useLock';
import { useNavigationReady } from './navigation';
import SplashScreen from 'react-native-splash-screen';
import { useAccounts } from './account';
import { useLoadLockInfo } from '@/hooks/useLock';
import { useBiometrics } from './biometrics';

const bootstrapAtom = atom({
  couldRender: false,
});

const DEBUG_IN_PAGE_SCRIPTS = {
  LOAD_BEFORE: __DEV__
    ? // leave here for debug
      `window.alert('DEBUG_IN_PAGE_LOAD_BEFORE')`
    : ``,
  LOAD_AFTER: __DEV__
    ? // leave here for debug
      `
;(function() {
    setTimeout(function () {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(
        {
          type: 'RabbyContentScript:Debug:LoadLastChunk',
          payload: {
            time: Date.now(),
          }
        }
      ));
    }, 20);
  })();
  `
    : ``,
};

/**
 * @description only call this hook on the top level component
 */
export function useInitializeAppOnTop() {
  const { isAppUnlocked, setAppLock } = useAppUnlocked();

  const apiInitializedRef = React.useRef(false);
  const doInitializeApis = React.useCallback(async () => {
    if (apiInitializedRef.current) return;
    apiInitializedRef.current = true;

    try {
      await initServices();
      await initApis();
      await Promise.race([syncChainList(), sleep(5000)]);
    } catch (error) {
      console.error('useInitializeAppOnTop::', error);
      apiInitializedRef.current = false;
    }
  }, []);

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  React.useEffect(() => {
    const onUnlock = () => {
      console.debug('onUnlock::');
      setAppLock(prev => ({ ...prev, appUnlocked: true }));
      sendUserAddressEvent();

      doInitializeApis();
      fetchAccounts();
    };
    const onLock = () => {
      setAppLock(prev => ({ ...prev, appUnlocked: false }));
      fetchAccounts();
    };
    keyringService.on('unlock', onUnlock);
    keyringService.on('lock', onLock);

    return () => {
      keyringService.off('unlock', onUnlock);
      keyringService.off('lock', onLock);
    };
  }, [setAppLock, doInitializeApis, fetchAccounts]);

  return { isAppUnlocked };
}

const loadEntryScriptsAtom = atom({
  inPageWeb3: '',
  vConsole: '',
});
export function useJavaScriptBeforeContentLoaded(options?: {
  isTop?: boolean;
}) {
  const [{ couldRender }] = useAtom(bootstrapAtom);

  const [entryScripts, setEntryScripts] = useAtom(loadEntryScriptsAtom);
  const { isTop } = options || {};

  React.useEffect(() => {
    if (!isTop || entryScripts.inPageWeb3) return;

    Promise.allSettled([
      EntryScriptWeb3.init(),
      __DEV__ ? EntryScriptVConsole.init() : Promise.resolve(''),
    ]).then(([reqInPageWeb3, reqVConsole]) => {
      const inPageWeb3 =
        reqInPageWeb3.status === 'fulfilled' ? reqInPageWeb3.value : '';
      const vConsole =
        reqVConsole.status === 'fulfilled' ? reqVConsole.value : '';

      setEntryScripts(prev => ({ ...prev, inPageWeb3, vConsole }));
    });
  }, [isTop, entryScripts.inPageWeb3, setEntryScripts]);

  const fullScript = React.useMemo(() => {
    return [
      // DEBUG_IN_PAGE_SCRIPTS.LOAD_BEFORE,
      entryScripts.inPageWeb3,
      SPA_urlChangeListener,
      __DEV__ ? entryScripts.vConsole : '',
      JS_LOG_ON_MESSAGE,
      ';true;',
      // DEBUG_IN_PAGE_SCRIPTS.LOAD_AFTER,
    ]
      .filter(Boolean)
      .join('\n');
  }, [entryScripts.inPageWeb3, entryScripts.vConsole]);

  return {
    entryScriptWeb3Loaded: [
      couldRender,
      !!entryScripts.inPageWeb3,
      // __DEV__ ? !!entryScripts.vConsole : true,
    ].every(x => !!x),
    entryScripts,
    fullScript: fullScript,
  };
}

const splashScreenVisibleRef = { current: true };
const hideSplashScreen = () => {
  if (!splashScreenVisibleRef.current) return;

  SplashScreen.hide();
  splashScreenVisibleRef.current = false;
};

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp({ rabbitCode }: { rabbitCode: string }) {
  const [{ couldRender }, setBootstrap] = useAtom(bootstrapAtom);
  useJavaScriptBeforeContentLoaded({ isTop: true });
  useGlobal();
  useLoadLockInfo({ autoFetch: true });
  useBiometrics({ autoFetch: true });

  const { appNavigationReady } = useNavigationReady();
  React.useEffect(() => {
    if (appNavigationReady) {
      hideSplashScreen();
    }
  }, [appNavigationReady]);

  const { getTriedUnlock } = useTryUnlockAppWithBuiltinOnTop();

  React.useEffect(() => {
    Promise.allSettled([getTriedUnlock(), loadSecurityChain])
      .then(async ([_unlockResult, _securityChain]) => {
        setBootstrap({ couldRender: true });
      })
      .catch(err => {
        console.error('useBootstrapApp::', err);
        setBootstrap({ couldRender: true });
      })
      .finally(() => {
        setTimeout(hideSplashScreen, 1000);
      });
  }, [getTriedUnlock, setBootstrap]);

  return {
    couldRender,
    securityChainOnTop: couldRender ? loadSecurityChain({ rabbitCode }) : null,
  };
}
