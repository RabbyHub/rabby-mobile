import {
  loadJavaScriptBeforeContentLoadedOnBoot,
  subscribeUnlockToFetchAccounts,
} from './hooks/useBootstrap';
import { InteractionManager } from 'react-native';

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
import {
  enableIOSAppSwitcherBlur,
  startSubscribeIOSAppSwitcherBlur,
  startSubscribeWhetherPreventScreenshot,
} from './hooks/native/security';
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
import {
  hydrateCachedHome24hBalanceScene,
  scene24hBalanceStore,
} from './store/balance24h';
import { startProcessMultiCurveEvents } from './store/curve24h';
import { startProcessAccountBalanceEvents } from './store/balanceAccountSelection';
import { traceAndroidInstant } from './core/utils/androidTrace';
import { runAfterHomePostStartupReady } from './core/utils/homeStartupReady';
import * as apisAutoLock from './core/apis/autoLock';
import { isUnlockSessionValid } from './core/apis/lock';
import { startWatchLayoutChange } from './hooks/useAppLayout';
import { startCareAppNotificationPermissions } from './hooks/appNotification';
import { keyringService } from './core/services';
import { APP_FEATURE_SWITCH } from './constant';
import {
  startInitPersistedStores,
  startReadableAccountBootstrapWarmups,
  startUnlockScreenBootstrapWarmups,
} from './setup-readable-account-bootstrap-warmups';
import { startInitReadableAccountStores } from './setup-readable-account-stores';

const UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS = 800;
const WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS = 60000;
const WALLETCONNECT_RESTORE_HOME_READY_FALLBACK_MS = 10000;
const WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS = 10000;

startComputationThread();
startSubscribeLangChange();

if (APP_FEATURE_SWITCH.transactionNotification) {
  connectPushServerOnBootstrap();
}

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
startSubscribeIOSAppSwitcherBlur();
enableIOSAppSwitcherBlur();
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

if (APP_FEATURE_SWITCH.transactionNotification) {
  startCareAppNotificationPermissions();
  startSubscribeRemoteNotification();
}

export {
  startInitPersistedStores,
  startReadableAccountBootstrapWarmups,
  startUnlockScreenBootstrapWarmups,
};

export async function initReadableAccountStores() {
  return startInitReadableAccountStores();
}

const startInitStores = async () => {
  traceAndroidInstant('global_task.init_persisted_stores.start');
  await startInitPersistedStores();
  traceAndroidInstant('global_task.init_persisted_stores.end');
};

function startInitStoresAfterUnlockInteractions(reason: string) {
  traceAndroidInstant('global_task.init_persisted_stores.schedule', {
    reason,
    delayMs: UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS,
  });
  const interactionHandle = InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      traceAndroidInstant('global_task.init_persisted_stores.fire', {
        reason,
      });
      startInitStores().catch(error => {
        traceAndroidInstant('global_task.init_persisted_stores.error', {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`startInitStoresOnUnlock::${reason}::error`, error);
      });
    }, UNLOCKED_STORES_AFTER_UNLOCK_DELAY_MS);
  });

  return interactionHandle;
}

function startInitStoresOnUnlock() {
  if (keyringService.isUnlocked()) {
    startInitStoresAfterUnlockInteractions('already_unlocked');
    return;
  }

  keyringService.once('unlock', () => {
    startInitStoresAfterUnlockInteractions('unlock_event');
  });
}

startInitStoresOnUnlock();

let walletConnectRestoreScheduled = false;

function startWalletConnectRestore(reason: string) {
  traceAndroidInstant('global_task.walletconnect_restore.fire', {
    reason,
  });
  import('./core/walletconnect/client')
    .then(({ startRestoreWalletConnectSessions }) => {
      startRestoreWalletConnectSessions();
    })
    .catch(error => {
      traceAndroidInstant('global_task.walletconnect_restore.error', {
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn('startWalletConnectRestoreAfterHomeReady::error', error);
    });
}

function startWalletConnectRestoreAfterIdle(reason: string) {
  InteractionManager.runAfterInteractions(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(
        () => {
          startWalletConnectRestore(reason);
        },
        {
          timeout: WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS,
        },
      );
      return;
    }

    startWalletConnectRestore(reason);
  });
}

function startWalletConnectRestoreAfterHomeReady(reason: string) {
  if (walletConnectRestoreScheduled) {
    traceAndroidInstant('global_task.walletconnect_restore.schedule_skipped', {
      reason,
    });
    return;
  }

  walletConnectRestoreScheduled = true;
  traceAndroidInstant('global_task.walletconnect_restore.schedule', {
    reason,
    delayMs: WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS,
    idleTimeoutMs: WALLETCONNECT_RESTORE_IDLE_TIMEOUT_MS,
  });

  runAfterHomePostStartupReady(
    () => {
      setTimeout(() => {
        traceAndroidInstant('global_task.walletconnect_restore.idle_wait_start', {
          reason,
        });
        startWalletConnectRestoreAfterIdle(reason);
      }, WALLETCONNECT_RESTORE_AFTER_HOME_IDLE_DELAY_MS);
    },
    {
      label: 'walletconnect_restore',
      fallbackMs: WALLETCONNECT_RESTORE_HOME_READY_FALLBACK_MS,
    },
  );
}

function startWalletConnectStartupPolicy() {
  if (keyringService.isUnlocked() || isUnlockSessionValid()) {
    traceAndroidInstant('global_task.walletconnect_restore.already_unlocked');
    startWalletConnectRestoreAfterHomeReady('already_unlocked');
  }

  keyringService.on('unlock', () => {
    traceAndroidInstant('global_task.walletconnect_restore.unlock_event');
    startWalletConnectRestoreAfterHomeReady('unlock_event');
  });
}

startWalletConnectStartupPolicy();
