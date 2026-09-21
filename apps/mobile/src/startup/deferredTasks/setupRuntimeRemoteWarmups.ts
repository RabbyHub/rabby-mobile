import { APP_FEATURE_SWITCH } from '@/constant';
import { connectPushServerOnBootstrap } from '@/core/notifications';
import { startSyncOnlineConfig } from '@/core/config/online';
import { loadVersionInfoOnBootstrap } from '@/hooks/version';
import { loadJavaScriptBeforeContentLoadedOnBoot } from '@/hooks/useBootstrap';
import { autoGoogleSignIfPreviousSignedOnBoot } from '@/hooks/cloudStorage';
import { startSyncDefaultRPCs } from '@/hooks/defaultRPCs';
import { rateModalStartSyncNetworth } from '@/components/RateModal/hooks';
import { screenshotModalStartSyncNetworth } from '@/components/Screenshot/hooks';
import { trimNoLongerSupportsOnUnlock } from '@/components2024/NoLongerSupports/useNoLongerSupports';

export function startSetupRuntimeRemoteWarmups() {
  if (APP_FEATURE_SWITCH.transactionNotification) {
    connectPushServerOnBootstrap();
  }

  startSyncOnlineConfig();
  loadVersionInfoOnBootstrap();
  loadJavaScriptBeforeContentLoadedOnBoot();
  autoGoogleSignIfPreviousSignedOnBoot();
  startSyncDefaultRPCs();
  rateModalStartSyncNetworth();
  screenshotModalStartSyncNetworth();
  trimNoLongerSupportsOnUnlock();
}
