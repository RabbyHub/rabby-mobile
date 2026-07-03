import { BUILD_CHANNEL } from '@/constant/env';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import firebaseAnalytics from '@react-native-firebase/analytics';
import {
  canTrackUserBehavior,
  getUserBehaviorTrackingOptOut,
  USER_BEHAVIOR_TRACKING_OPT_OUT_KEY,
} from '@/utils/trackingOptOut';

import { customAlphabet, nanoid } from 'nanoid';
import { Platform } from 'react-native';

const ANALYTICS_PATH = 'https://matomo.debank.com/matomo.php';
const genExtensionId = customAlphabet('1234567890abcdef', 16);
type FirebaseAnalyticsModule = ReturnType<typeof firebaseAnalytics>;
type AnalyticsPreferenceStore = {
  extensionId?: string;
  [USER_BEHAVIOR_TRACKING_OPT_OUT_KEY]?: boolean;
};

let firebaseAnalyticsInstance: FirebaseAnalyticsModule | null | undefined;
let firebaseAnalyticsUnavailableLogged = false;

function logFirebaseAnalyticsUnavailable(error: unknown) {
  if (firebaseAnalyticsUnavailableLogged) {
    return;
  }
  firebaseAnalyticsUnavailableLogged = true;
  console.warn('[analytics] Firebase analytics unavailable', error);
}

function getFirebaseAnalytics() {
  if (firebaseAnalyticsInstance !== undefined) {
    return firebaseAnalyticsInstance;
  }

  try {
    firebaseAnalyticsInstance = firebaseAnalytics();
  } catch (error) {
    firebaseAnalyticsInstance = null;
    logFirebaseAnalyticsUnavailable(error);
  }

  return firebaseAnalyticsInstance;
}

async function safeFirebaseAnalyticsCall<T>(
  callback: (instance: FirebaseAnalyticsModule) => Promise<T>,
) {
  const instance = getFirebaseAnalytics();
  if (!instance) {
    return undefined;
  }

  try {
    return await callback(instance);
  } catch (error) {
    logFirebaseAnalyticsUnavailable(error);
    return undefined;
  }
}

const getStoredPreference = () =>
  appStorage.getItem(APP_STORE_NAMES.preference) as
    | AnalyticsPreferenceStore
    | null
    | undefined;

async function postData(url = '', params: URLSearchParams) {
  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'POST',
  });

  return response;
}

let extensionId = getStoredPreference()?.extensionId;

function getOrCreateExtensionId() {
  extensionId = extensionId || getStoredPreference()?.extensionId;

  if (!extensionId) {
    extensionId = genExtensionId();
    appStorage.setItem(APP_STORE_NAMES.preference, {
      ...(getStoredPreference() || {}),
      [USER_BEHAVIOR_TRACKING_OPT_OUT_KEY]: getUserBehaviorTrackingOptOut(),
      extensionId,
    });
  }

  return extensionId;
}

export const syncFirebaseAnalyticsCollectionWithOptOut = async () => {
  await safeFirebaseAnalyticsCall(instance =>
    instance.setAnalyticsCollectionEnabled(canTrackUserBehavior()),
  );
};

void syncFirebaseAnalyticsCollectionWithOptOut();

export const analytics = {
  logEvent: async (...args: Parameters<FirebaseAnalyticsModule['logEvent']>) => {
    if (!canTrackUserBehavior()) {
      return;
    }
    return safeFirebaseAnalyticsCall(instance => instance.logEvent(...args));
  },
  logScreenView: async (
    ...args: Parameters<FirebaseAnalyticsModule['logScreenView']>
  ) => {
    if (!canTrackUserBehavior()) {
      return;
    }
    return safeFirebaseAnalyticsCall(instance =>
      instance.logScreenView(...args),
    );
  },
  setAnalyticsCollectionEnabled: (
    ...args: Parameters<
      FirebaseAnalyticsModule['setAnalyticsCollectionEnabled']
    >
  ) =>
    safeFirebaseAnalyticsCall(instance =>
      instance.setAnalyticsCollectionEnabled(...args),
    ),
};

const getParams = async () => {
  if (!canTrackUserBehavior()) {
    return null;
  }

  const gaParams = new URLSearchParams();
  const visitorId = getOrCreateExtensionId();

  // const url = `https://${location.host}.com/${pathname}`;

  // gaParams.append('action_name', pathname);
  gaParams.append('idsite', '5');
  gaParams.append('rec', '1');
  // gaParams.append('url', encodeURI(url));
  gaParams.append('_id', visitorId);
  gaParams.append('rand', nanoid());
  gaParams.append('ca', '1');
  gaParams.append('h', new Date().getUTCHours().toString());
  gaParams.append('m', new Date().getUTCMinutes().toString());
  gaParams.append('s', new Date().getUTCSeconds().toString());
  gaParams.append('cookie', '0');
  gaParams.append('send_image', '0');
  gaParams.append('dimension1', process.env.APP_VERSION!);
  gaParams.append('dimension2', BUILD_CHANNEL);
  gaParams.append('dimension3', Platform.OS);

  return gaParams;
};

// alias name for gaEvent
export const matomoRequestEvent = async (data: {
  category: string;
  action: string;
  label?: string;
  value?: number;
  transport?: any;
}) => {
  const params = await getParams();
  if (!params) {
    return;
  }

  if (data.category) {
    params.append('e_c', data.category);
  }

  if (data.action) {
    params.append('e_a', data.action);
  }

  if (data.label) {
    params.append('e_n', data.label);
  }

  if (data.value) {
    params.append('e_v', data.value.toString());
  }

  if (data.transport) {
    params.append('e_i', data.transport);
  }

  try {
    await Promise.all([
      analytics.logEvent(data.category.trim().replace(/\s+/g, '_'), data),
      postData(ANALYTICS_PATH, params),
    ]);
  } catch (e) {
    console.error('gaEvent Error', e);
  }
};

export const matomoLogScreenView = async ({ name }: { name: string }) => {
  const params = await getParams();
  if (!params) {
    return;
  }

  params.append('action_name', `Screen / ${name}`);

  try {
    await postData(ANALYTICS_PATH, params);
  } catch (e) {
    // ignore
  }
};

export const gaEvent = matomoRequestEvent;
