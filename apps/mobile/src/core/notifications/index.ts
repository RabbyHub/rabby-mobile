import {
  startBindPushServerOnDemand,
  registerForPushNotifications,
  startConnectPushServerInterval,
  startSubscribePushNotifications,
} from './register';

import { startConnectPushTestServerInterval } from './test-server';

export async function connectPushServerOnBootstrap() {
  startSubscribePushNotifications();
  startConnectPushServerInterval();

  let pushToken = '';
  try {
    const { pushToken: token } = await registerForPushNotifications();
    pushToken = token;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
  }
  console.debug('[connectPushTestServer] pushToken', pushToken);

  startBindPushServerOnDemand(pushToken);
  startConnectPushTestServerInterval(pushToken);
}
