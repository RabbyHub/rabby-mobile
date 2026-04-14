import {
  loadJavaScriptBeforeContentLoadedOnBoot,
  subscribeUnlockToFetchAccounts,
} from './hooks/useBootstrap';

import { runIIFEFunc } from './core/utils/store';
import { startSubscribeLangChange } from './hooks/lang';
import { connectPushServerOnBootstrap } from './core/notifications';

import { startManageAccountStoreLifecycle } from './hooks/account';

import {
  loadLockInfoOnBootstrap,
  startSubscribeAppStateChange,
} from './hooks/useLock';
import { startSyncDefaultRPCs } from './hooks/defaultRPCs';
import { startSubscribePerpsOnAppState } from './hooks/perps/usePerpsStore';
import { storeApiGasAccount } from './screens/GasAccount/hooks/atom';
import { startSubscribeOnekeyDevices } from './core/apis/onekey';
import { startSubscribeTrezorConnectOnUrl } from './hooks/trezor/useTrezor';
import { startFetchOnceTop5TokensForAllAccounts } from './components/AccountSwitcher/hooks';
import { startSyncOnlineConfig } from './core/config/online';
import { loadVersionInfoOnBootstrap } from './hooks/version';
import { autoGoogleSignIfPreviousSignedOnBoot } from './hooks/cloudStorage';
import {
  screenshotModalStartSyncNetworth,
  startSubscribeUserDidTakeScreenshot,
} from './components/Screenshot/hooks';
import { startSubscribeWhetherPreventScreenshot } from './hooks/native/security';
import {
  startSubscribeAtSensitiveScene,
  startSubscribeIOSJustScreenshotted,
  startSubscribeIOSScreenRecording,
  startSubscribeRemoteNotification,
} from './hooks/navigation';
import { startComputationThread } from './perfs/thread';
import { rateModalStartSyncNetworth } from './components/RateModal/hooks';
import { trimNoLongerSupportsOnUnlock } from './components2024/NoLongerSupports/useNoLongerSupports';
import { startCheckClearAction } from './utils/clipboard';
import { startSubscribeOpenApiHttpErrorDebugToast } from './utils/openapiDebugToast';
import tokenListStore from './store/tokens';
import {
  balance24hStore,
  hydrateCachedHome24hBalanceScene,
  scene24hBalanceStore,
} from './store/balance24h';
import {
  hydrateCachedHomeDayCurve,
  initCurve24hStore,
  startProcessMultiCurveEvents,
} from './store/curve24h';
import useProtocolListStore from './store/protocols';
import { useAppChainStore } from './store/appchain';
import addressBalanceStore, {
  startProcessAccountBalanceEvents,
} from './store/balance';
import { apisAutoLock } from './core/apis';
import { startWatchLayoutChange } from './hooks/useAppLayout';
import { startCareAppNotificationPermissions } from './hooks/appNotification';
import nftListStore from './store/nfts';
import { keyringService } from './core/services';

startComputationThread();
startSubscribeLangChange();

connectPushServerOnBootstrap();

startManageAccountStoreLifecycle();
loadLockInfoOnBootstrap();
apisAutoLock.setupAutoLockChecker();
startFetchOnceTop5TokensForAllAccounts();
subscribeUnlockToFetchAccounts();
startSubscribeAppStateChange();

startSyncOnlineConfig();
loadVersionInfoOnBootstrap();

loadJavaScriptBeforeContentLoadedOnBoot();

startSubscribeOnekeyDevices();
startSubscribeTrezorConnectOnUrl();

autoGoogleSignIfPreviousSignedOnBoot();
startSyncDefaultRPCs();
runIIFEFunc(() => {
  storeApiGasAccount.fetchGasAccountInfo();
});
startSubscribePerpsOnAppState();
startWatchLayoutChange();

startSubscribeUserDidTakeScreenshot();
startSubscribeAtSensitiveScene();
startSubscribeIOSJustScreenshotted();
startSubscribeWhetherPreventScreenshot();
startSubscribeIOSScreenRecording();

rateModalStartSyncNetworth();
screenshotModalStartSyncNetworth();

startProcessAccountBalanceEvents();
scene24hBalanceStore.startProcessScene24hBalanceEvents();
hydrateCachedHome24hBalanceScene();
startProcessMultiCurveEvents();

trimNoLongerSupportsOnUnlock();

startCheckClearAction();
startSubscribeOpenApiHttpErrorDebugToast();

startCareAppNotificationPermissions();
startSubscribeRemoteNotification();

async function initPersistedStores() {
  console.time('initPersistedStores');
  await useAppChainStore.getState().initStore();
  await Promise.all([
    addressBalanceStore.initStore(),
    balance24hStore.initStore(),
    initCurve24hStore(),
  ]);
  hydrateCachedHome24hBalanceScene();
  hydrateCachedHomeDayCurve();
  console.timeEnd('initPersistedStores');
}

async function initUnlockedStores() {
  console.time('initUnlockedStores');
  await tokenListStore.getState().initStore();
  await nftListStore.getState().initStore();
  await useProtocolListStore.getState().initStore();
  console.timeEnd('initUnlockedStores');
}

const initPersistedStoresStateRef = {
  promise: null as Promise<void> | null,
};
const startInitPersistedStores = async () => {
  if (initPersistedStoresStateRef.promise) {
    return initPersistedStoresStateRef.promise;
  }
  const promise = initPersistedStores();
  initPersistedStoresStateRef.promise = promise;
  await promise;
};

const initUnlockedStoresStateRef = {
  promise: null as Promise<void> | null,
};
const startInitStores = async () => {
  await startInitPersistedStores();

  if (initUnlockedStoresStateRef.promise) {
    return initUnlockedStoresStateRef.promise;
  }
  const promise = initUnlockedStores();
  initUnlockedStoresStateRef.promise = promise;
  await promise;
};

function startInitStoresOnUnlock() {
  if (keyringService.isUnlocked()) {
    startInitStores().catch(error => {
      console.error('startInitStoresOnUnlock::error', error);
    });
    return;
  }

  keyringService.once('unlock', () => {
    startInitStores().catch(error => {
      console.error('startInitStoresOnUnlock::error', error);
    });
  });
}

startInitPersistedStores().catch(error => {
  console.error('startInitPersistedStores::error', error);
});
startInitStoresOnUnlock();
