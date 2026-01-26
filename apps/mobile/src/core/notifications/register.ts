import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';
import { sleep } from '@/utils/async';
import { IS_IOS } from '../native/utils';
import { zMutativeByMMKV } from '../storage/mmkv';
import { notificationOpenapi } from './openapi';
import { preferenceService } from '../services';
import { perfEvents } from '../utils/perf';
import { storeApiAccounts } from '@/hooks/account';
import { accountEvents, getTop10MyAccounts } from '../apis/account';
import { checkIfEnabledNotificationWithPermission } from './switch';

const iosPush = {
  token: '',
  error: null as null | { message: string; code: number; details: any },
};

// const notificationMemStore = zCreate(
//   zMutative<{
//     pushToken: string;
//   }>(() => {
//     return {
//       pushToken: '',
//     }
//   })
// )

export const notificationStore = zMutativeByMMKV('notification', {
  pushToken: '',
  // deviceId: ensureDeviceUUID(),
});

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

  notificationStore.setState(prev => {
    prev.pushToken = pushToken;
  });

  return {
    pushToken: pushToken || '',
  };
};

export const startSubscribePushNotifications = async () => {
  if (IS_IOS) {
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

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;
export async function startConnectPushServerInterval() {
  const requstConnect = async (appEnabled?: boolean) => {
    return notificationOpenapi.setDeviceActiveStatus({
      isActive:
        (await checkIfEnabledNotificationWithPermission(appEnabled)) ?? true,
    });
  };

  requstConnect();
  perfEvents.subscribe('PREFERENCE_UPDATED', ctx => {
    switch (ctx.key) {
      case 'enabledTransactionNofification': {
        requstConnect(ctx.value as boolean);
        break;
      }
    }
  });

  notificationOpenapi.heartbeat();
  setInterval(async () => {
    await notificationOpenapi.heartbeat();
  }, CONNECT_DURATION_MS);
}

export async function bindPushServer(pushToken: string) {
  const requestBind = async () => {
    return notificationOpenapi.bindDevice({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pushToken,
      userAddrs: await getTop10MyAccounts().then(acc => acc.top10Addresses),
    });
  };

  accountEvents.addListener('ACCOUNT_ADDED', requestBind);
  accountEvents.addListener('ACCOUNT_REMOVED', requestBind);
}
