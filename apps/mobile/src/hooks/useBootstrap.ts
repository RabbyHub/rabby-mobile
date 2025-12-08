import * as React from 'react';
import { atom, useAtom, useSetAtom } from 'jotai';
import {
  customTestnetService,
  keyringService,
  perpsService,
} from '@/core/services';
import { initApis } from '@/core/apis/init';
import { initServices } from '@/core/services/init';
import EntryScriptWeb3 from '@/core/bridges/EntryScriptWeb3';
import { EntryScriptVConsole } from '@/core/bridges/builtInScripts/loadVConsole';
import { JS_LOG_ON_MESSAGE } from '@/core/bridges/builtInScripts/onMessage';
import {
  BROWSER_SCRIPT_BASE,
  JS_GET_WINDOW_INFO_AFTER_LOAD,
  SPA_urlChangeListener,
  JSBridgeHarden,
} from '@rabby-wallet/rn-webview-bridge';
import { sendUserAddressEvent } from '@/core/apis/analytics';
import { loadSecurityChain, useGlobal } from './global';
import {
  useAppUnlocked,
  useSetAppLock,
  useTryUnlockAppWithBuiltinOnTop,
  getTriedUnlock,
} from './useLock';
import { useNavigationReady } from './navigation';
import SplashScreen from 'react-native-splash-screen';
import { useAccounts } from './account';
import { useLoadLockInfo } from '@/hooks/useLock';
import { useBiometrics } from './biometrics';
import { useFetchTokensForAllAccounts } from '@/components/AccountSwitcher/hooks';
// import { browserStateAtom } from './browser/useBrowser';
import { apisSafe } from '@/core/apis/safe';
import { RefLikeObject } from '@/utils/type';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { replace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { setBrowserState } from './browser/useBrowser';

const syncCustomTestChainList = () => {
  try {
    customTestnetService.syncChainList();
  } catch (e) {
    console.error(e);
  }
};

type BootStrapState = {
  couldRender: boolean;
};
const zBootstrapStore = zCreate<BootStrapState>(() => ({
  couldRender: false,
}));
function setBootstrap(valOrFunc: UpdaterOrPartials<BootStrapState>) {
  zBootstrapStore.setState(
    prev => resolveValFromUpdater(prev, valOrFunc).newVal,
  );
}

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

const apiInitializedRef: RefLikeObject<boolean> = { current: false };
const doInitializeApis = async () => {
  if (apiInitializedRef.current) return;
  apiInitializedRef.current = true;

  try {
    await initServices();
    await initApis();
    syncCustomTestChainList();
  } catch (error) {
    console.error('useInitializeAppOnTop::error', error);
    apiInitializedRef.current = false;
  }
};

/**
 * @description only call this hook on the top level component
 */
export function useInitializeAppOnTop() {
  const { isAppUnlocked, setAppLock } = useAppUnlocked();
  // const setBrowserState = useSetAtom(browserStateAtom);

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  React.useEffect(() => {
    const onUnlock = () => {
      console.debug('useBootstrap::onUnlock');
      setAppLock(prev => ({ ...prev, appUnlocked: true }));
      sendUserAddressEvent();

      doInitializeApis();
      fetchAccounts();
      perpsService.unlockAgentWallets();
    };
    const onLock = () => {
      setAppLock(prev => ({ ...prev, appUnlocked: false }));
      fetchAccounts();
      setBrowserState({
        isShowBrowser: false,
        isShowSearch: false,
        isShowManage: false,
        searchText: '',
        searchTabId: '',
        trigger: '',
      });
    };
    keyringService.on('unlock', onUnlock);
    keyringService.on('lock', onLock);

    return () => {
      keyringService.off('unlock', onUnlock);
      keyringService.off('lock', onLock);
    };
  }, [setAppLock, fetchAccounts]);

  const { fetchTop5TokensForAllAccountsOnce } = useFetchTokensForAllAccounts();
  React.useEffect(() => {
    const onUnlock = () => {
      fetchTop5TokensForAllAccountsOnce();
    };
    keyringService.on('unlock', onUnlock);

    return () => {
      keyringService.off('unlock', onUnlock);
    };
  }, [fetchTop5TokensForAllAccountsOnce]);

  React.useEffect(() => {
    const onUnlock = async () => {
      apisSafe.syncAllGnosisNetworks();
      doInitializeApis();

      // const accounts = await keyringService.getAllVisibleAccountsArray();
      // if (!accounts?.length) {
      //   replace(RootNames.StackGetStarted, {
      //     screen: RootNames.GetStartedScreen2024,
      //   });
      // }
    };
    keyringService.on('unlock', onUnlock);

    return () => {
      keyringService.off('unlock', onUnlock);
    };
  }, []);

  return { isAppUnlocked };
}

type LoadEntryScriptsState = {
  inPageWeb3: string;
  vConsole: string;
};
const loadEntryScriptsStore = zCreate<LoadEntryScriptsState>(() => ({
  inPageWeb3: '',
  vConsole: '',
}));
function setEntryScripts(valOrFunc: UpdaterOrPartials<LoadEntryScriptsState>) {
  loadEntryScriptsStore.setState(prev => ({
    ...prev,
    ...resolveValFromUpdater(prev, valOrFunc, { strict: false }).newVal,
  }));
}

export function useJavaScriptBeforeContentLoaded(options?: {
  isTop?: boolean;
}) {
  // const [{ couldRender }] = useAtom(bootstrapAtom);
  const couldRender = zBootstrapStore(s => s.couldRender);
  const inPageWeb3 = loadEntryScriptsStore(s => s.inPageWeb3);
  const vConsole = loadEntryScriptsStore(s => s.vConsole);

  // const [entryScripts, setEntryScripts] = useAtom(loadEntryScriptsAtom);
  const { isTop } = options || {};

  React.useEffect(() => {
    if (!isTop || inPageWeb3) return;

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
  }, [isTop, inPageWeb3]);

  const fullScript = React.useMemo(() => {
    return [
      // DEBUG_IN_PAGE_SCRIPTS.LOAD_BEFORE,
      JSBridgeHarden,
      inPageWeb3,
      BROWSER_SCRIPT_BASE,
      __DEV__ ? JS_GET_WINDOW_INFO_AFTER_LOAD : '',
      SPA_urlChangeListener,
      __DEV__ ? vConsole : '',
      JS_LOG_ON_MESSAGE,
      ';true;',
      // DEBUG_IN_PAGE_SCRIPTS.LOAD_AFTER,
    ]
      .filter(Boolean)
      .join('\n');
  }, [inPageWeb3, vConsole]);

  return {
    entryScriptWeb3Loaded: [
      couldRender,
      !!inPageWeb3,
      // __DEV__ ? !!entryScripts.vConsole : true,
    ].every(x => !!x),
    entryScripts: { inPageWeb3, vConsole },
    fullScript: fullScript,
  };
}

const splashScreenVisibleRef = { current: true };
const hideSplashScreen = (forceHide = false) => {
  if (splashScreenVisibleRef.current || forceHide) {
    SplashScreen.hide();
    splashScreenVisibleRef.current = false;
  }
};

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp({ rabbitCode }: { rabbitCode: string }) {
  // const [{ couldRender }, setBootstrap] = useAtom(bootstrapAtom);
  const couldRender = zBootstrapStore(s => s.couldRender);
  useJavaScriptBeforeContentLoaded({ isTop: true });
  useGlobal();
  useLoadLockInfo({ autoFetch: true });
  const { fetchBiometrics } = useBiometrics({ autoFetch: false });

  const { appNavigationReady } = useNavigationReady();
  React.useEffect(() => {
    if (appNavigationReady) hideSplashScreen(true);
  }, [appNavigationReady]);

  // const { getTriedUnlock } = useTryUnlockAppWithBuiltinOnTop();

  const startedLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (startedLoadRef.current) return;
    startedLoadRef.current = true;

    Promise.allSettled([
      getTriedUnlock(),
      loadSecurityChain({ rabbitCode }),
      fetchBiometrics(),
    ])
      .then(async ([_unlockResult, _securityChain]) => {
        console.debug('useBootstrapApp::sucess', _unlockResult);
        setBootstrap({ couldRender: true });
      })
      .catch(err => {
        startedLoadRef.current = false;
        console.error('useBootstrapApp::error', err);
        setBootstrap({ couldRender: false });
      })
      .finally(() => {
        setTimeout(() => {
          hideSplashScreen(false);
          console.debug(
            'useBootstrapApp:: splash screen hidden due to timeout',
          );
        }, 1e3);
      });
  }, [fetchBiometrics, rabbitCode]);

  return {
    couldRender,
    securityChainOnTop: couldRender ? loadSecurityChain({ rabbitCode }) : null,
  };
}
