import {
  loadJavaScriptBeforeContentLoadedOnBoot,
  subscribeUnlockToFetchAccounts,
} from './hooks/useBootstrap';

import { runIIFEFunc } from './core/utils/store';
import { startSubscribeLangChange } from './hooks/lang';
import { startManageAccountStoreLifecycle } from './hooks/account';

import {
  loadLockInfoOnBootstrap,
  startSubscribeAppStateChange,
} from './hooks/useLock';
import { startSyncDefaultRPCs } from './hooks/defaultRPCs';
import { startSubscribePerpsOnAppState } from './hooks/perps/usePerpsStore';
import { startSubscribeBalanceUpdated } from './hooks/useCurve';
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
} from './hooks/navigation';
import { startComputationThread } from './perfs/thread';
import { rateModalStartSyncNetworth } from './components/RateModal/hooks';
import { trimNoLongerSupportsOnUnlock } from './components2024/NoLongerSupports/useNoLongerSupports';
import { startCheckClearAction } from './utils/clipboard';
import tokenListStore from './store/tokens';
import { startProcessScene24hBalanceEvents } from './hooks/useScene24hBalance';
import { startProcessMultiCurveEvents } from './hooks/useMultiCurve';
import { apisAutoLock } from './core/apis';

startSubscribeLangChange();

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
startSubscribeBalanceUpdated();
startSyncDefaultRPCs();
runIIFEFunc(() => {
  storeApiGasAccount.fetchGasAccountInfo();
});
startSubscribePerpsOnAppState();

startSubscribeUserDidTakeScreenshot();
startSubscribeAtSensitiveScene();
startSubscribeIOSJustScreenshotted();
startSubscribeWhetherPreventScreenshot();
startSubscribeIOSScreenRecording();

rateModalStartSyncNetworth();
screenshotModalStartSyncNetworth();

startComputationThread();
startProcessScene24hBalanceEvents();
startProcessMultiCurveEvents();

trimNoLongerSupportsOnUnlock();

startCheckClearAction();

tokenListStore.getState().initStore();
