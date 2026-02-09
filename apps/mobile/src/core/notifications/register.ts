import messaging from '@react-native-firebase/messaging';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { AppState, Platform, PushNotification } from 'react-native';

import { sleep } from '@/utils/async';
import { IS_IOS } from '../native/utils';
import { zMutativeByMMKV } from '../storage/mmkv';
import { HeartbeatResponse, notificationOpenapi } from './openapi';
import { perfEvents } from '../utils/perf';
import { accountEvents } from '../apis/account';
import {
  checkIfEnabledNotificationWithPermission,
  iosCheckPermission,
} from './switch';
import { useShallow } from 'zustand/shallow';
import { zCreate, zMutative } from '../utils/reexports';
import { notificationEvents, parseRemoteData } from './data';
import { getTopMyAccountsOnNotifications } from './utils';
import { makeAvoidParallelAsyncFunc } from '../utils/concurrency';

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

const notificationStore = zMutativeByMMKV('notification', {
  pushToken: '',
  // deviceId: ensureDeviceUUID(),
});

export function useNotificationStore() {
  const { pushToken } = notificationStore(
    useShallow(s => ({
      pushToken: s.pushToken,
    })),
  );

  return { pushToken };
}

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
    const authStatus = await iosCheckPermission();
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
    const intialNotificationPromise =
      PushNotificationIOS.getInitialNotification();
    const intialNotificationRef = {
      consumed: false,
      instance: null as Awaited<typeof intialNotificationPromise>,
    };
    PushNotificationIOS.addEventListener(
      'localNotification',
      async evtNotifi => {
        // const intialNotification = await PushNotificationIOS.getInitialNotification();
        const initialNotificationConsumed = intialNotificationRef.consumed;
        if (!intialNotificationRef.consumed) {
          intialNotificationRef.instance = await intialNotificationPromise;
          intialNotificationRef.consumed = true;
        }
        const notification = !initialNotificationConsumed
          ? intialNotificationRef.instance || evtNotifi
          : evtNotifi;
        const isUserTapped = notification?.getData().userInteraction === 1;
        console.debug(
          '[notifications][local] Received notification:',
          notification,
          intialNotificationRef,
          isUserTapped,
        );
        if (!notification) return;
        if (!isUserTapped) return;

        const parsed = parseRemoteData(notification.getData());
        parsed._parseSuccess &&
          notificationEvents.emit('onParsedReceivedData', {
            parsedData: parsed,
          });
        console.debug('[notifications][local] parsed:', parsed);
      },
    );

    // PushNotificationIOS.addEventListener('notification', async notification => {
    //   // const intialNotification = await PushNotificationIOS.getInitialNotification();
    //   const intialNotification = await intialNotificationPromise;
    //     const isUserTapped =
    //       intialNotification?.getData().userInteraction === 1;
    //   const iosFromLaunch = !intialNotification
    //     ? false
    //     : isUserTapped;
    //   console.debug(
    //     '[notifications] Received foreground APNs notification:',
    //     notification,
    //     intialNotification,
    //   );
    //   const isBackground =
    //     AppState.isAvailable && AppState.currentState === 'background';
    //   const canProcess =
    //     (iosFromLaunch && !initialNotificationConsumed) || isBackground;
    //   if (!canProcess) return;
    //   if (iosFromLaunch && !initialNotificationConsumed) {
    //     initialNotificationConsumed = true;
    //   }

    //   const parsed = parseRemoteData(notification.getData());
    //   parsed._parseSuccess &&
    //     notificationEvents.emit('onParsedReceivedData', {
    //       parsedData: parsed,
    //       iosFromLaunch,
    //     });
    //   console.debug('[notifications] parsed:', parsed);
    //   // notification.finish(PushNotificationIOS.FetchResult.NoData);
    // });
  } else {
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        console.debug(
          '[notifications] messaging().getInitialNotification():: remoteMessage:',
          remoteMessage,
        );
        if (!remoteMessage) return;

        // TODO: need test on real device? or maybe simulator also works
        const parsed = parseRemoteData(remoteMessage.data);
        parsed._parseSuccess &&
          notificationEvents.emit('onParsedReceivedData', {
            parsedData: parsed,
          });
        console.debug('[notifications] parsed:', parsed);
      });
    messaging().onMessage(async remoteMessage => {
      console.debug('[notifications] Received foreground FCM:', remoteMessage);

      // const parsed = parseRemoteData(remoteMessage.data);
      // parsed._parseSuccess && notificationEvents.emit('onParsedReceivedData', {
      //   parsedData: parsed,
      // });
      // console.debug('[notifications] parsed:', parsed);
    });
    messaging().onNotificationOpenedApp(async remoteMessage => {
      console.debug('[notifications] Received background FCM:', remoteMessage);

      const parsed = parseRemoteData(remoteMessage.data);
      parsed._parseSuccess &&
        notificationEvents.emit('onParsedReceivedData', {
          parsedData: parsed,
        });
      console.debug('[notifications] parsed:', parsed);
    });
  }
};

type HeartbeatLogItem = HeartbeatResponse & {
  expireTime: number;
};
const devLogsStore = zCreate(
  zMutative(() => {
    return {
      heartbeatResps: [] as HeartbeatLogItem[],
    };
  }),
);
export function useNotificationDevLogsStore() {
  const heartbeatResps = devLogsStore(s => s.heartbeatResps);

  return { heartbeatResps };
}

function onHeartbeatResponse(resp: HeartbeatResponse) {
  // limit recent 20 records
  devLogsStore.setState(prev => {
    const heartbeatList = prev.heartbeatResps;
    const item = {
      ...resp,
      expireTime: Date.now() + resp.ttl * 1000,
    };

    heartbeatList.unshift(item);

    prev.heartbeatResps = heartbeatList.slice(0, 20);
  });
}

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;
export async function startConnectPushServerInterval() {
  const requstConnect = async (appEnabled?: boolean) => {
    const { enabled } = await checkIfEnabledNotificationWithPermission(
      appEnabled,
    );
    return notificationOpenapi.setDeviceActiveStatus({
      isActive: enabled,
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

  const requestHeartbeat = makeAvoidParallelAsyncFunc(async () => {
    if (AppState.isAvailable && AppState.currentState !== 'active') return;
    notificationOpenapi.heartbeat().then(onHeartbeatResponse);
  });

  requestHeartbeat();
  setInterval(async () => {
    if (AppState.isAvailable && AppState.currentState !== 'active') return;
    await requestHeartbeat();
  }, CONNECT_DURATION_MS);

  AppState.addEventListener('change', state => {
    if (state === 'active') {
      requestHeartbeat();
    }
  });
}

export const requestBindDevice = async (pushToken: string) => {
  return notificationOpenapi.bindDevice({
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    pushToken,
    userAddrs: await getTopMyAccountsOnNotifications().then(
      acc => acc.top100Addresses,
    ),
  });
};

export async function startBindPushServerOnDemand(pushToken: string) {
  perfEvents.on('USER_MANUALLY_UNLOCK', () => {
    requestBindDevice(pushToken);
  });

  accountEvents.addListener('ACCOUNT_ADDED', () =>
    requestBindDevice(pushToken),
  );
  accountEvents.addListener('ACCOUNT_REMOVED', () =>
    requestBindDevice(pushToken),
  );
}
