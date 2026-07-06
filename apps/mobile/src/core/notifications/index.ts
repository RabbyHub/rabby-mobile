import {
  startBindPushServerOnDemand,
  registerForPushNotifications,
  startConnectPushServerInterval,
  startSubscribePushNotifications,
} from './register';

import { startConnectFeServiceInterval } from './test-server';
import { APP_FEATURE_SWITCH } from '@/constant';

export async function connectPushServerOnBootstrap() {
  if (!APP_FEATURE_SWITCH.transactionNotification) {
    return;
  }

  startSubscribePushNotifications();
  startConnectPushServerInterval();

  let pushToken = '';
  try {
    const { pushToken: token } = await registerForPushNotifications();
    pushToken = token;
  } catch (error) {
    console.warn('Failed to register for push notifications:', error);
  }
  console.debug('[connectFeService] pushToken', pushToken);

  startBindPushServerOnDemand(pushToken);
  startConnectFeServiceInterval(pushToken);
}
