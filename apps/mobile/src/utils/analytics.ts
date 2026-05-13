import { BUILD_CHANNEL } from '@/constant/env';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import firebaseAnalytics from '@react-native-firebase/analytics';

import { customAlphabet, nanoid } from 'nanoid';
import { Platform } from 'react-native';

const ANALYTICS_PATH = 'https://matomo.debank.com/matomo.php';
const genExtensionId = customAlphabet('1234567890abcdef', 16);
type FirebaseAnalyticsModule = ReturnType<typeof firebaseAnalytics>;
type AnalyticsPreferenceStore = {
  extensionId?: string;
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

export const analytics = {
  logEvent: (...args: Parameters<FirebaseAnalyticsModule['logEvent']>) =>
    safeFirebaseAnalyticsCall(instance => instance.logEvent(...args)),
  logScreenView: (
    ...args: Parameters<FirebaseAnalyticsModule['logScreenView']>
  ) => safeFirebaseAnalyticsCall(instance => instance.logScreenView(...args)),
};

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
if (!extensionId) {
  extensionId = genExtensionId();
  appStorage.setItem(APP_STORE_NAMES.preference, {
    ...(getStoredPreference() || {}),
    extensionId,
  });
}

const getParams = async () => {
  const gaParams = new URLSearchParams();

  // const url = `https://${location.host}.com/${pathname}`;

  // gaParams.append('action_name', pathname);
  gaParams.append('idsite', '5');
  gaParams.append('rec', '1');
  // gaParams.append('url', encodeURI(url));
  gaParams.append('_id', extensionId);
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
  params.append('action_name', `Screen / ${name}`);

  try {
    await postData(ANALYTICS_PATH, params);
  } catch (e) {
    // ignore
  }
};

export const gaEvent = matomoRequestEvent;
