import { Linking, Alert } from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

import { urlUtils } from '@rabby-wallet/base-utils';
import { withHttp } from '@/utils/url';

export async function openExternalUrl(url: string) {
  const supported = await Linking.canOpenURL(url);

  const result = {
    couldOpen: supported,
    maybeOpened: false,
  };

  try {
    // we always try to open the URL, even if it's not supported
    await Linking.openURL(url);
    result.maybeOpened = true;
  } catch (err) {
    result.maybeOpened = false;
    if (!supported) {
      Alert.alert(`Don't know how to open this URL: ${url}`);
    } else {
      Alert.alert(`Can't open this URL: ${url}`);
    }
  }

  return result;
}

export type LoginInfo = {
  currentAddress: string;
  sessionId: string;
  walletType?: string;
};
export const openInAppBrowser = async (
  url?: string | null,
  loginInfo?: LoginInfo,
) => {
  if (!url) return;

  let uri = withHttp(url);
  if (loginInfo) {
    uri = urlUtils.integrateQueryToUrl(uri, {
      ...loginInfo,
      inDebankApp: 'true',
    });
  }

  await InAppBrowser.isAvailable();
  InAppBrowser.close();
  InAppBrowser.open(uri, {
    modalPresentationStyle: 'fullScreen',
    animated: true,
    animations: {
      startEnter: 'slide_in_right',
      startExit: 'slide_out_left',
      endEnter: 'slide_in_left',
      endExit: 'slide_out_right',
    },
  });
};
