import { APP_FEATURE_SWITCH } from '@/constant';
import { startCareAppNotificationPermissions } from '@/hooks/appNotification';
import { startSubscribeRemoteNotification } from '@/hooks/navigation';

export function startSetupRuntimeNotificationBootstrap() {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return;
  }

  startCareAppNotificationPermissions();
  startSubscribeRemoteNotification();
}
