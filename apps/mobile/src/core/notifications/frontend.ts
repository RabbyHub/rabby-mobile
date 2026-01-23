import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community//push-notification-ios';
import { Platform } from 'react-native';
import { getDevServerHost } from '../utils/devServerSettings';
import { makeMobileClientPushInfo } from '../apis/device';
import { sleep } from '@/utils/async';
import { RABBY_MOBILE_PUSH_TEST_SERVER_URL } from '@/constant/env';
import { IS_IOS } from '../native/utils';
import { isNonPublicProductionEnv } from '@/constant';
import { preferenceService } from '../services';

const iosPush = {
  token: '',
  error: null as null | { message: string; code: number; details: any },
};

const iosTokenReady = new Promise<string>((resolve, reject) => {
  if (IS_IOS) {
    PushNotificationIOS.addEventListener('register', deviceToken => {
      PushNotificationIOS.removeEventListener('register');

      console.debug('[iosTokenReady] iOS APNs device token:', deviceToken);
      iosPush.token = deviceToken;
      iosPush.error = null;
      resolve(deviceToken);
    });

    PushNotificationIOS.addEventListener('registrationError', error => {
      PushNotificationIOS.removeEventListener('registrationError');

      console.error('[iosTokenReady] iOS APNs registration error:', error);
      iosPush.error = error;
      iosPush.token = '';
      reject(error);
    });
  } else {
    resolve('');
  }
});

export const registerForPushNotifications = async () => {
  let pushToken = '';

  if (Platform.OS === 'ios') {
    pushToken = await iosTokenReady;
    const authStatus = await PushNotificationIOS.requestPermissions({
      alert: true,
      badge: true,
      sound: true,
    });
    const enabled = authStatus?.alert ?? false;
    if (!enabled) {
      console.warn('Push notifications disabled by user');
    }
  } else {
    // Android: 使用 FCM
    await Promise.race([
      messaging()
        .getToken()
        .then(token => {
          pushToken = token;
        }),
      sleep(3000).then(() => {
        if (pushToken) return;
        throw new Error('FCM getToken timeout');
      }),
    ]);
  }

  return {
    pushToken: pushToken || '',
  };
};

function getTestPushServerURL() {
  if (!isNonPublicProductionEnv) return null;

  const localHost = getDevServerHost();
  let connectURL = `http://${localHost}:3000`;
  if (!localHost) {
    connectURL = RABBY_MOBILE_PUSH_TEST_SERVER_URL || '';
  }

  return connectURL;
}

export const connectPushTestServer = async (data: { pushToken: string }) => {
  const pushToken = data.pushToken;
  if (!pushToken) {
    throw new Error(
      '[connectPushTestServer] Empty push token, cannot connect to push server',
    );
  }

  const connectURL = getTestPushServerURL();
  if (!connectURL) {
    console.error('[connectPushTestServer] No push server URL configured');
    return;
  }

  try {
    console.debug('[connectPushTestServer] connectURL', connectURL);

    const response = await fetch(
      `${connectURL}/v1/api/rabby-mobile-push/connect`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...makeMobileClientPushInfo(
            pushToken,
            preferenceService.getPreferenceByKey(
              'enabledTransactionNofification',
            ) ?? false,
          ),
        }),
      },
    );

    if (!response.ok) {
      console.error(
        '[connectPushTestServer] HTTP error:',
        response.status,
        response.statusText,
      );
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.debug('[connectPushTestServer] Token registered:', result);
    return result;
  } catch (err) {
    console.error(
      '[connectPushTestServer] Failed to register push token:',
      err,
    );
    throw err;
  }
};

export const startSubscribePushNotifications = async () => {
  if (IS_IOS) {
    PushNotificationIOS.setNotificationCategories([
      {
        id: 'tx_changed',
        actions: [
          // {id: 'open', title: 'Open', options: {foreground: true}},
          // {
          //   id: 'ignore',
          //   title: 'Desruptive',
          //   options: {foreground: true, destructive: true},
          // },
          // {
          //   id: 'text',
          //   title: 'Text Input',
          //   options: {foreground: true},
          //   textInput: {buttonTitle: 'Send'},
          // },
        ],
      },
    ]);
    PushNotificationIOS.addEventListener('notification', notification => {
      console.log(
        '[notifications] Received foreground APNs notification:',
        notification,
      );
    });
  } else {
    messaging().onMessage(async remoteMessage => {
      console.log('[notifications] Received foreground FCM:', remoteMessage);
    });
  }
};
