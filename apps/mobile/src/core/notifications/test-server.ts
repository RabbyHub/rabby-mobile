import { getDevServerHost } from '../utils/devServerSettings';
import { makeMobileClientPushInfo } from '../apis/device';
import { RABBY_MOBILE_PUSH_TEST_SERVER_URL } from '@/constant/env';
import { isNonPublicProductionEnv } from '@/constant';
import { preferenceService } from '../services';

export function getTestPushServerURL() {
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

const CONNECT_DURATION_MS = __DEV__ ? 5 * 1000 : 30 * 1000;
export function startConnectPushTestServerInterval(pushToken: string) {
  connectPushTestServer({ pushToken });
  setInterval(async () => {
    await connectPushTestServer({ pushToken });
  }, CONNECT_DURATION_MS);
}
