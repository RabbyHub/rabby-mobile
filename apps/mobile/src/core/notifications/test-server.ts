import { getDevServerHost } from '../utils/devServerSettings';
import { makeMobileClientPushInfo } from '../apis/device';
import { RABBY_MOBILE_FE_SERVICE_URL } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant';
import { preferenceService } from '../services';
import { stringUtils } from '@rabby-wallet/base-utils';
import { checkIfEnabledNotificationWithPermission } from './switch';
import { IS_IOS } from '../native/utils';
import { AppState } from 'react-native';

export function getFeServiceURL() {
  if (!isNonPublicProductionEnv) return RABBY_MOBILE_FE_SERVICE_URL || null;

  let connectURL = getDevServerHost();

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
    console.error('[connectFeService] No push server URL configured');
    return;
  }

  try {
    console.debug('[connectFeService] connectURL', connectURL);

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
    console.debug('[connectFeService] Token registered:', result);
    return result;
  } catch (err) {
    console.error('[connectFeService] Failed to register push token:', err);
    throw err;
  }
};

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;
export function startConnectFeServiceInterval(pushToken: string) {
  connectFeService({ pushToken });

  setInterval(async () => {
    await connectFeService({ pushToken });
  }, CONNECT_DURATION_MS);
}
