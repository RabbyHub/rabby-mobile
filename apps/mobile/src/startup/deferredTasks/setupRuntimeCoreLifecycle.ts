import { subscribeUnlockToFetchAccounts } from '@/hooks/useBootstrap';
import { startManageAccountStoreLifecycle } from '@/hooks/account';
import {
  loadLockInfoOnBootstrap,
  startSubscribeAppStateChange,
} from '@/hooks/useLock';
import { startProcessAccountBalanceEvents } from '@/store/balanceAccountSelection';
import { startCheckClearAction } from '@/utils/clipboard';
import { startSubscribeOpenApiHttpErrorDebugToast } from '@/utils/openapiDebugToast';
import * as apisAutoLock from '@/core/apis/autoLock';
import { startWatchLayoutChange } from '@/hooks/useAppLayout';

export function startSetupRuntimeCoreLifecycle() {
  startManageAccountStoreLifecycle();
  loadLockInfoOnBootstrap().catch(error => {
    console.error('loadLockInfoOnBootstrap::setupRuntime::error', error);
  });
  apisAutoLock.setupAutoLockChecker();
  subscribeUnlockToFetchAccounts();
  startSubscribeAppStateChange();
  startWatchLayoutChange();
  startProcessAccountBalanceEvents();
  startCheckClearAction();
  startSubscribeOpenApiHttpErrorDebugToast();
}
