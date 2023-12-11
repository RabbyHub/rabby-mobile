import { Linking, Platform } from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';

// https://explorer.walletconnect.com
// https://registry.walletconnect.org/data/wallets.json
const supportWallets: Record<
  string,
  {
    name: string;
    androidPackageName: string;
    useDeepLink?: boolean;
    deepLink: string;
    useV2?: boolean;
  }
> = {
  '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369': {
    name: 'Rainbow',
    deepLink: 'rainbow:',
    androidPackageName: 'me.rainbow',
  },
  '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0': {
    name: 'Trust Wallet',
    deepLink: 'trust:',
    androidPackageName: 'com.wallet.crypto.trustapp',
  },
  // 未支持签名
  // bc949c5d968ae81310268bf9193f9c9fb7bb4e1283e1284af8f2bd4992535fd6: {
  //   name: 'Argent',
  //   deepLink: 'argent:',
  //   androidPackageName: 'im.argent.contractwalletclient',
  // },
  c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96: {
    name: 'MetaMask',
    deepLink: 'metamask:',
    androidPackageName: 'io.metamask',
  },
  ef333840daf915aafdc4a004525502d6d49d77bd9c65e0642dbaefb3c2893bef: {
    name: 'imToken',
    deepLink: 'imtokenv2:',
    androidPackageName: 'im.token.app',
  },
  ecc4036f814562b41a5268adc86270fba1365471402006302e70169465b7ac18: {
    name: 'Zerion',
    deepLink: 'zerion:',
    useDeepLink: true,
    androidPackageName: 'io.zerion.android',
    useV2: true,
  },
  '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66': {
    name: 'TokenPocket',
    deepLink: 'tpoutside:',
    androidPackageName: 'vip.mytokenpocket',
    useV2: true,
  },
  '7674bb4e353bf52886768a3ddc2a4562ce2f4191c80831291218ebd90f5f5e26': {
    useDeepLink: true,
    name: 'MathWallet',
    deepLink: 'mathwallet:',
    androidPackageName: 'com.mathwallet.android',
  },
};

export const sortedSupportWallets = Object.entries(supportWallets).reduce(
  (m, [id, n], i) => {
    m[id] = { ...n, sort: i };

    return m;
  },
  {} as Record<
    string,
    {
      name: string;
      androidPackageName: string;
      useDeepLink?: boolean;
      deepLink: string;
      sort: number;
    }
  >,
);

export type WalletService = {
  readonly id: string;
  readonly name: string;
  readonly homepage: string;
  readonly chains: readonly string[];
  readonly app: {
    readonly browser: string;
    readonly ios: string;
    readonly android: string;
    readonly mac: string;
    readonly windows: string;
    readonly linux: string;
  };
  readonly mobile: {
    readonly native: string;
    readonly universal: string;
  };
  readonly desktop: {
    readonly native: string;
    readonly universal: string;
  };
  readonly metadata: {
    readonly shortName: string;
    readonly colors: {
      readonly primary: string;
      readonly secondary: string;
    };
  };
};

export const canOpenWallet = (walletService: WalletService) => {
  const supportWallet = supportWallets[walletService?.id];
  if (!supportWallet) {
    return Promise.resolve(false);
  }
  switch (Platform.OS) {
    case 'ios':
      if (!supportWallet.deepLink) {
        return Promise.resolve(false);
      }

      try {
        return Linking.canOpenURL(supportWallet.deepLink);
      } catch (error) {
        return Promise.resolve(false);
      }

    case 'android':
      return supportWallet.androidPackageName
        ? SendIntentAndroid.isAppInstalled(
            supportWallet.androidPackageName,
          ).then(installed => {
            console.log(supportWallet.androidPackageName, installed);
            return installed;
          })
        : Promise.resolve(false);

    default:
      return Promise.resolve(false);
  }
};

export const openWallet = (walletService: WalletService, wcLink = '') => {
  const { mobile, id } = walletService;
  const supportWallet = supportWallets[id];

  if (!supportWallet) {
    return Promise.reject('Wallet not supported');
  }

  const universal = /^https:\/\/./.test(mobile.universal?.trim())
    ? mobile.universal?.replace(/\/+$/, '')
    : '';
  const { deepLink } = supportWallet;

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
        : supportWallet.useDeepLink
        ? deepLink
        : universal || deepLink; // trust wallet 不支持 `${deepLink}/`

      return scheme
        ? Linking.openURL(link)
        : Promise.reject('Wallet not supported');

    case 'android':
      // 带上 redirectUrl tokenpocket 不支持
      return supportWallet.androidPackageName
        ? wcLink
          ? SendIntentAndroid.openAppWithData(
              supportWallet.androidPackageName,
              wcLink,
            )
          : SendIntentAndroid.openApp(supportWallet.androidPackageName, {})
        : Promise.resolve(false);

    default:
      return Promise.resolve(false);
  }
};
