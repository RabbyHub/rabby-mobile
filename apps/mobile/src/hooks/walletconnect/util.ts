import { WalletInfo } from '@/utils/walletInfo';
import { Linking, Platform } from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';

export const canOpenWallet = (walletInfo: WalletInfo) => {
  switch (Platform.OS) {
    case 'ios':
      if (!walletInfo.deepLink) {
        return Promise.resolve(false);
      }

      try {
        return Linking.canOpenURL(walletInfo.deepLink);
      } catch (error) {
        return Promise.resolve(false);
      }

    case 'android':
      return walletInfo.androidPackageName
        ? SendIntentAndroid.isAppInstalled(walletInfo.androidPackageName).then(
            installed => {
              return installed;
            },
          )
        : Promise.resolve(false);

    default:
      return Promise.resolve(false);
  }
};

export const openWallet = (walletInfo: WalletInfo, wcLink = '') => {
  const { universal: universalLink, deepLink } = walletInfo;

  if (!walletInfo) {
    return Promise.reject('Wallet not supported');
  }

  const universal =
    universalLink && /^https:\/\/./.test(universalLink?.trim())
      ? universalLink?.replace(/\/+$/, '')
      : '';

  switch (Platform.OS) {
    case 'ios':
      // TODO: enable redirect
      // const maybeRedirectUrl = typeof redirectUrl === 'string' ? `&redirectUrl=${encodeURIComponent(redirectUrl)}` : '';
      const maybeRedirectUrl = '';
      const scheme = universal
        ? `${universal}/`
        : deepLink
        ? `${deepLink}//`
        : '';
      const link = wcLink
        ? `${scheme}${
            wcLink ? `wc?uri=${encodeURIComponent(wcLink)}` : ''
          }${maybeRedirectUrl}`
        : walletInfo.useDeepLink
        ? deepLink
        : universal || deepLink;

      return scheme
        ? Linking.openURL(link)
        : Promise.reject('Wallet not supported');

    case 'android':
      // 带上 redirectUrl tokenpocket 不支持
      return walletInfo.androidPackageName
        ? wcLink
          ? SendIntentAndroid.openAppWithData(
              walletInfo.androidPackageName,
              wcLink,
            )
          : SendIntentAndroid.openApp(walletInfo.androidPackageName, {})
        : Promise.resolve(false);

    default:
      return Promise.resolve(false);
  }
};
