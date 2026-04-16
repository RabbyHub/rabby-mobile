import { getDevServerHost, DevServerScene } from '../utils/devServerSettings';
import { makeMobileClientPushInfo } from '../apis/device';
import { RABBY_MOBILE_FE_SERVICE_URL } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant/package';
import { preferenceService } from '../services';
import { stringUtils } from '@rabby-wallet/base-utils';
import { checkIfEnabledNotificationWithPermission } from './switch';
import { IS_IOS } from '../native/utils';
import { AppState } from 'react-native';

export function getFeServiceURL() {
  if (!isNonPublicProductionEnv) return RABBY_MOBILE_FE_SERVICE_URL || null;

  let connectURL = getDevServerHost(DevServerScene.FE_PUSH_SERVICE);

  if (!connectURL) {
    connectURL = RABBY_MOBILE_FE_SERVICE_URL || '';
  } else if (stringUtils.isIpv4Address(connectURL)) {
    // TODO: on iOS's non production package, apply LAN devices on bootstrap
    connectURL = `http://${connectURL}:3000`;
  }

  return connectURL;
}

export const connectFeService = async (data: { pushToken: string }) => {
  const pushToken = data.pushToken;
  if (!pushToken) {
    throw new Error(
      '[connectFeService] Empty push token, cannot connect to push server',
    );
  }

  const connectURL = getFeServiceURL();
  if (!connectURL) {
    if (__DEV__) {
      console.warn('[connectFeService] No push server URL configured');
    } else {
      console.error('[connectFeService] No push server URL configured');
    }
    return;
  }

  try {
    const { enabled } = await checkIfEnabledNotificationWithPermission();
    const response = await fetch(
      `${connectURL}/v1/api/rabby-mobile-push/connect`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...makeMobileClientPushInfo(pushToken, enabled),
        }),
      },
    );

    if (!response.ok) {
      console.error(
        '[connectFeService] HTTP error:',
        response.status,
        response.statusText,
      );
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const nextSuccessSignature = JSON.stringify(result ?? null);
    if (
      connectFeServiceIntervalRef.lastSuccessSignature !== nextSuccessSignature
    ) {
      connectFeServiceIntervalRef.lastSuccessSignature = nextSuccessSignature;
      console.debug('[connectFeService] Token registered:', result);
    }
    return result;
  } catch (err) {
    console.error('[connectFeService] Failed to register push token:', err);
    throw err;
  }
};

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;
const connectFeServiceIntervalRef = {
  timer: null as ReturnType<typeof setInterval> | null,
  pushToken: '',
  connectURL: '',
  lastSuccessSignature: '',
};
export function startConnectFeServiceInterval(pushToken: string) {
  if (!pushToken) {
    if (__DEV__) {
      console.warn(
        '[connectFeService] skip startConnectFeServiceInterval because pushToken is empty',
      );
    }
    return;
  }

  const connectURL = getFeServiceURL();
  if (!connectURL) {
    return;
  }

  const shouldReuseExistingInterval =
    connectFeServiceIntervalRef.timer &&
    connectFeServiceIntervalRef.pushToken === pushToken &&
    connectFeServiceIntervalRef.connectURL === connectURL;
  if (shouldReuseExistingInterval) {
    return;
  }

  if (connectFeServiceIntervalRef.timer) {
    clearInterval(connectFeServiceIntervalRef.timer);
    connectFeServiceIntervalRef.timer = null;
  }

  connectFeServiceIntervalRef.pushToken = pushToken;
  connectFeServiceIntervalRef.connectURL = connectURL;
  connectFeServiceIntervalRef.lastSuccessSignature = '';

  console.debug('[connectFeService] connectURL', connectURL);

  void connectFeService({ pushToken }).catch(() => undefined);

  connectFeServiceIntervalRef.timer = setInterval(() => {
    void connectFeService({ pushToken }).catch(() => undefined);
  }, CONNECT_DURATION_MS);
}
