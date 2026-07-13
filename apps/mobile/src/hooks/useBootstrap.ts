import * as React from 'react';
import { bindKeyringEventAfterRegistration } from '@/core/serviceApi/keyring';
import { initCoreServices } from '@/core/serviceApi/init';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { customTestnetServiceApi } from '@/core/serviceApi/customTestnet';
import { initApis } from '@/core/apis/init';
import { sendUserAddressEvent } from '@/core/apis/analytics';
import { apisLock, apisPerps } from '@/core/apis';
import { loadSecurityChain } from './global';
import {
  getBootstrapAccountFlags,
  getTriedUnlock,
  loadBootstrapAppLockState,
  storeApiLock,
} from './useLock';
import SplashScreen from 'react-native-splash-screen';
import { storeApisBiometrics } from './biometrics';
import { apisPerpsStore } from './perps/usePerpsStore';
// import { browserStateAtom } from './browser/useBrowser';
import { apisSafe } from '@/core/apis/safe';
import type { RefLikeObject } from '@/utils/type';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater, runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { replace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { setBrowserState } from './browser/useBrowser';
import { perfEvents } from '@/core/utils/perf';
import { runAfterHomePostStartupReady } from '@/core/utils/homeStartupReady';
import {
  beginAndroidAsyncTrace,
  beginAndroidTraceSection,
  endAndroidAsyncTrace,
  endAndroidTraceSection,
  nextAndroidTraceCookie,
  traceAndroidInstant,
} from '@/core/utils/androidTrace';

const syncCustomTestChainList = () => {
  customTestnetServiceApi.syncChainList().catch(e => {
    console.error(e);
  });
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

const WEBVIEW_BEFORE_CONTENT_LOADED_BUILTIN_SCRIPT_IDS = [
  'rabby-jsbridge-harden',
  'rabby-inpage-web3',
  'rabby-browser-script-base',
  ...(__DEV__ ? ['rabby-dev-window-info-after-load'] : []),
  'rabby-spa-url-change-listener',
  ...(__DEV__
    ? [
        'rabby-dev-vconsole',
        'rabby-dev-vconsole-init',
        'rabby-dev-log-on-message',
      ]
    : []),
  'rabby-return-true',
];

const WEBVIEW_DOCUMENT_END_BUILTIN_SCRIPT_IDS = [
  'rabby-android-patch-anchor-target',
];

const apiInitializedRef: RefLikeObject<boolean> = { current: false };
const doInitializeApis = async () => {
  if (apiInitializedRef.current) return;
  apiInitializedRef.current = true;

  try {
    await initCoreServices();
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
      traceAndroidInstant('global_task.wallet_auth_unlocked.start', {
        source: 'useBootstrap',
      });
      console.debug('useBootstrap::onUnlock');
      storeApiLock.setAppLock(prev => ({
        ...prev,
        appUnlocked: true,
        isUnlockSessionValid: apisLock.isUnlockSessionValid(),
      }));
      traceAndroidInstant('global_task.wallet_auth_unlocked.end', {
        source: 'useBootstrap',
      });
    };
    const onUnlockUIReady = () => {
      traceAndroidInstant('global_task.post_unlock_ui_ready.start', {
        source: 'useBootstrap',
      });
      sendUserAddressEvent();

      doInitializeApis();
      getBootstrapAccountFlags().then(accountFlags => {
        storeApiLock.setAppLock(prev => ({
          ...prev,
          appUnlocked: true,
          isUnlockSessionValid: apisLock.isUnlockSessionValid(),
          ...accountFlags,
        }));
      });
      void perpsServiceApi.unlockAgentWallets();
      traceAndroidInstant('global_task.post_unlock_ui_ready.end', {
        source: 'useBootstrap',
      });
    };
    const onLock = () => {
      storeApiLock.setAppLock(prev => ({
        ...prev,
        appUnlocked: false,
        isUnlockSessionValid: apisLock.isUnlockSessionValid(),
      }));
      getBootstrapAccountFlags().then(accountFlags => {
        storeApiLock.setAppLock(prev => ({
          ...prev,
          appUnlocked: false,
          isUnlockSessionValid: apisLock.isUnlockSessionValid(),
          ...accountFlags,
        }));
      });
      setBrowserState({
        isShowBrowser: false,
        isShowSearch: false,
        isShowManage: false,
        searchText: '',
        searchTabId: '',
        trigger: '',
      });
      void perpsServiceApi.lockAgentWallets();
      apisPerpsStore.logout();
      apisPerps.destroyPerpsSDK();
    };
    const sub = perfEvents.subscribe('WALLET_AUTH_UNLOCKED', onUnlock);
    const subUIReady = perfEvents.subscribe(
      'POST_UNLOCK_UI_READY',
      onUnlockUIReady,
    );
    const removeLockListener = bindKeyringEventAfterRegistration(
      'lock',
      onLock,
    );

    return () => {
      sub.remove();
      subUIReady.remove();
      removeLockListener();
    };
  }, []);

  React.useEffect(() => {
    const onUnlock = async () => {
      apisSafe.syncAllGnosisNetworks();
      doInitializeApis();
    };
    const sub = perfEvents.subscribe('POST_UNLOCK_UI_READY', onUnlock);

    return () => {
      sub.remove();
    };
  }, []);
}

export function subscribeUnlockToFetchAccounts() {
  perfEvents.subscribe('POST_UNLOCK_UI_READY', async () => {
    const accountFlags = await getBootstrapAccountFlags();
    if (!accountFlags.hasVisibleAccounts) {
      replace(RootNames.StackGetStarted, {
        screen: RootNames.GetStarted,
      });
    }
  });
}

export async function loadJavaScriptBeforeContentLoadedOnBoot() {
  return Promise.resolve();
}

export function useJavaScriptBeforeContentLoaded() {
  const entryScriptWeb3Loaded = zBootstrapStore(s => !!s.couldRender);

  return {
    entryScriptWeb3Loaded,
    beforeContentLoadedBuiltinScriptIds:
      WEBVIEW_BEFORE_CONTENT_LOADED_BUILTIN_SCRIPT_IDS,
    documentEndBuiltinScriptIds: WEBVIEW_DOCUMENT_END_BUILTIN_SCRIPT_IDS,
  };
}

const splashScreenVisibleRef = { current: true };
const hideSplashScreen = (forceHide = false) => {
  if (splashScreenVisibleRef.current || forceHide) {
    traceAndroidInstant('bootstrap.splash.hide', {
      forceHide,
    });
    SplashScreen.hide();
    splashScreenVisibleRef.current = false;
  }
};

runStartupTask(() => {
  const sub = perfEvents.subscribe('APP_NAVIGATION_READY', () => {
    hideSplashScreen(true);
    sub.remove();
  });
}, STARTUP_TASKS.bootstrapHideSplashOnNavigationReady);

const postRenderBootstrapWarmupsStateRef = {
  started: false,
};

function schedulePostRenderBootstrapWarmups(reason: string) {
  if (postRenderBootstrapWarmupsStateRef.started) {
    return;
  }

  postRenderBootstrapWarmupsStateRef.started = true;

  requestAnimationFrame(() => {
    setTimeout(() => {
      runAfterHomePostStartupReady(
        () => {
          Promise.allSettled([
            getTriedUnlock(),
            storeApisBiometrics.fetchBiometrics(),
          ]).then(results => {
            results.forEach(result => {
              if (result.status === 'rejected') {
                console.error(
                  `schedulePostRenderBootstrapWarmups::${reason}`,
                  result.reason,
                );
              }
            });
          });
        },
        {
          fallbackMs: 5000,
          label: 'bootstrap_post_render_warmups',
        },
      );
    }, 120);
  });
}

/**
 * @description only call this hook on the top level component
 */
export function useBootstrapApp({ rabbitCode }: { rabbitCode: string }) {
  const startedLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (!rabbitCode) return;
    if (startedLoadRef.current) return;
    startedLoadRef.current = true;

    const bootstrapTraceCookie = nextAndroidTraceCookie();
    const lockStateTraceCookie = nextAndroidTraceCookie();
    beginAndroidAsyncTrace('bootstrap.useBootstrapApp', bootstrapTraceCookie);
    beginAndroidAsyncTrace(
      'bootstrap.loadBootstrapAppLockState',
      lockStateTraceCookie,
    );
    const lockStatePromise = loadBootstrapAppLockState().finally(() => {
      endAndroidAsyncTrace(
        'bootstrap.loadBootstrapAppLockState',
        lockStateTraceCookie,
      );
    });
    const didTraceSecurityChain = beginAndroidTraceSection(
      'bootstrap.loadSecurityChain',
    );
    let securityChainResult:
      | ReturnType<typeof loadSecurityChain>
      | Promise<never>;
    try {
      securityChainResult = loadSecurityChain({ rabbitCode });
    } catch (error) {
      securityChainResult = Promise.reject(error);
    } finally {
      if (didTraceSecurityChain) {
        endAndroidTraceSection();
      }
    }

    Promise.allSettled([lockStatePromise, securityChainResult])
      .then(async ([_initialLockResult, _securityChain]) => {
        const initialLockState =
          _initialLockResult.status === 'fulfilled'
            ? _initialLockResult.value
            : null;
        const shouldWaitAutoUnlock =
          _initialLockResult.status !== 'fulfilled' ||
          (!initialLockState?.appUnlocked &&
            !initialLockState?.isUnlockSessionValid);
        const unlockResult = shouldWaitAutoUnlock
          ? await Promise.allSettled([getTriedUnlock()]).then(
              ([result]) => result,
            )
          : null;

        console.debug('useBootstrapApp::sucess', {
          initialLockStatus: _initialLockResult.status,
          securityChainStatus: _securityChain.status,
          unlockStatus: unlockResult?.status ?? 'deferred',
          shouldWaitAutoUnlock,
        });
        traceAndroidInstant('bootstrap.couldRender.set_true', {
          initialLockStatus: _initialLockResult.status,
          securityChainStatus: _securityChain.status,
          unlockStatus: unlockResult?.status ?? 'deferred',
          shouldWaitAutoUnlock,
        });
        setBootstrap({ couldRender: true });

        if (shouldWaitAutoUnlock) {
          setTimeout(() => {
            storeApisBiometrics.fetchBiometrics().catch(error => {
              console.error('fetchBiometrics::postRender::error', error);
            });
          }, 0);
        } else {
          schedulePostRenderBootstrapWarmups('bootstrap_could_render');
        }
      })
      .catch(err => {
        startedLoadRef.current = false;
        console.error('useBootstrapApp::error', err);
        setBootstrap({ couldRender: false });
      })
      .finally(() => {
        endAndroidAsyncTrace('bootstrap.useBootstrapApp', bootstrapTraceCookie);
        setTimeout(() => {
          hideSplashScreen(false);
          console.debug(
            'useBootstrapApp:: splash screen hidden due to timeout',
          );
        }, 3e3);
      });
  }, [rabbitCode]);
}

export function useAppCouldRender() {
  const couldRender = zBootstrapStore(s => s.couldRender);

  return {
    couldRender,
  };
}
