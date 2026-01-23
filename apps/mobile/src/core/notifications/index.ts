import {
  connectPushTestServer,
  registerForPushNotifications,
  startSubscribePushNotifications,
} from './frontend';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { IS_IOS } from '../native/utils';

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;

export async function connectPushServerOnBootstrap() {
  startSubscribePushNotifications();

  let pushToken = '';
  try {
    const { pushToken: token } = await registerForPushNotifications();
    pushToken = token;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
  }
  console.debug('[connectPushTestServer] pushToken', pushToken);

  connectPushTestServer({ pushToken });

  setInterval(async () => {
    await connectPushTestServer({ pushToken });
  }, CONNECT_DURATION_MS);
}
