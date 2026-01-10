import * as React from 'react';
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
import { loadSecurityChain } from './global';
import { getTriedUnlock, storeApiLock } from './useLock';
import SplashScreen from 'react-native-splash-screen';
import { storeApiAccounts } from './account';
import { storeApisBiometrics } from './biometrics';
// import { browserStateAtom } from './browser/useBrowser';
import { apisSafe } from '@/core/apis/safe';
import { RefLikeObject } from '@/utils/type';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { replace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { setBrowserState } from './browser/useBrowser';
import { perfEvents } from '@/core/utils/perf';

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
  React.useEffect(() => {
    const onUnlock = () => {
      console.debug('useBootstrap::onUnlock');
      storeApiLock.setAppLock(prev => ({ ...prev, appUnlocked: true }));
      sendUserAddressEvent();

      doInitializeApis();
      storeApiAccounts.fetchAccounts();
      perpsService.unlockAgentWallets();
    };
    const onLock = () => {
      storeApiLock.setAppLock(prev => ({ ...prev, appUnlocked: false }));
      storeApiAccounts.fetchAccounts();
      setBrowserState({
        isShowBrowser: false,
        isShowSearch: false,
        isShowManage: false,
        searchText: '',
        searchTabId: '',
        trigger: '',
      });
    };
    const sub = perfEvents.subscribe('USER_MANUALLY_UNLOCK', onUnlock);
    keyringService.on('lock', onLock);

    return () => {
      sub.remove();
      keyringService.off('lock', onLock);
    };
  }, []);

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
    const sub = perfEvents.subscribe('USER_MANUALLY_UNLOCK', onUnlock);

    return () => {
      sub.remove();
    };
  }, []);
}

export function subscribeUnlockToFetchAccounts() {
  perfEvents.subscribe('USER_MANUALLY_UNLOCK', async () => {
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStartedScreen2024,
      });
    }
  });
}

type LoadEntryScriptsState = {
  inPageWeb3: string;
  vConsole: string;
  fullScript: string;
};
const loadEntryScriptsStore = zCreate<LoadEntryScriptsState>(() => ({
  inPageWeb3: '',
  vConsole: '',
  fullScript: '',
}));
function setEntryScripts(valOrFunc: UpdaterOrPartials<LoadEntryScriptsState>) {
  loadEntryScriptsStore.setState(prev => ({
    ...prev,
    ...resolveValFromUpdater(prev, valOrFunc, { strict: false }).newVal,
  }));
}

export async function loadJavaScriptBeforeContentLoadedOnBoot() {
  return Promise.allSettled([
    EntryScriptWeb3.init(),
    __DEV__ ? EntryScriptVConsole.init() : Promise.resolve(''),
  ]).then(([reqInPageWeb3, reqVConsole]) => {
    const inPageWeb3 =
      reqInPageWeb3.status === 'fulfilled' ? reqInPageWeb3.value : '';
    const vConsole =
      reqVConsole.status === 'fulfilled' ? reqVConsole.value : '';

    setEntryScripts(prev => ({
      ...prev,
      inPageWeb3,
      vConsole,
      fullScript: getFullScript({ inPageWeb3, vConsole }),
    }));
  });
}

function getFullScript({
  inPageWeb3,
  vConsole,
}: {
  inPageWeb3: string;
  vConsole: string;
}) {
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
}

export function useJavaScriptBeforeContentLoaded() {
  const inPageWeb3 = loadEntryScriptsStore(s => s.inPageWeb3);
  const fullScript = loadEntryScriptsStore(s => s.fullScript);
  const entryScriptWeb3Loaded = zBootstrapStore(s =>
    [
      s.couldRender,
      !!inPageWeb3,
      // __DEV__ ? !!entryScripts.vConsole : true,
    ].every(x => !!x),
  );

  return {
    entryScriptWeb3Loaded,
    entryScripts: {
      inPageWeb3,
      // vConsole
    },
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

runIIFEFunc(() => {
  const sub = perfEvents.subscribe('APP_NAVIGATION_READY', () => {
    hideSplashScreen(true);
    sub.remove();
  });
});

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp({ rabbitCode }: { rabbitCode: string }) {
  const startedLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (!rabbitCode) return;
    if (startedLoadRef.current) return;
    startedLoadRef.current = true;

    Promise.allSettled([
      getTriedUnlock(),
      loadSecurityChain({ rabbitCode }),
      storeApisBiometrics.fetchBiometrics(),
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
  }, [rabbitCode]);
}

export function useAppCouldRender() {
  const couldRender = zBootstrapStore(s => s.couldRender);

  return {
    couldRender,
  };
}
