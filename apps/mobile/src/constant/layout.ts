import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AppColorsVariants, ThemeColors } from './theme';
import { IS_ANDROID } from '@/core/native/utils';

export const ModalLayouts = {
  defaultHeightPercentText: '80%' as `${number}%`,
  titleTopOffset: 8,
};

// for DappWebViewControl
export const ScreenLayouts = {
  headerAreaHeight: 56,
  bottomBarHeight: 60,

  dappWebViewControlHeaderHeight: 44,

  defaultWebViewNavBottomSheetHeight: 52 + 40,
  dappWebViewNavBottomSheetHeight: 302,
  inConnectedDappWebViewNavBottomSheetHeight: 302 /*  - 120 */,
};

// for DappWebViewControl2
export const ScreenLayouts2 = {
  headerAreaHeight: 56,

  dappWebViewControlHeaderHeight: (IS_ANDROID ? 10 : 0) /* padding-top */ + 56,
  dappWebViewControlNavHeight: 68,
};

export const ScreenWithAccountSwitcherLayouts = {
  /**
   * @description for our app,
   * - landscape layout is not supported
   * - not for iPad/tvOS
   *
   * so the screen header height must be 56
   * see details apps/mobile/node_modules/@react-navigation/elements/src/Header/getDefaultHeaderHeight.tsx
   */
  screenHeaderHeight: 56,
};

export const ScreenColors = {
  homeHeaderBlue: '#434EB9',
};

export const RootNames = {
  StackGetStarted: 'StackGetStarted',
  GetStartedScreen2024: 'GetStartedScreen2024',
  CreateSelectMethod: 'CreateSelectMethod',
  StackRoot: 'StackRoot',
  NotFound: 'NotFound',
  Unlock: 'Unlock',

  StackBottom: 'StackBottom',
  Home: 'Home',
  // MultiAddressHome: 'MultiAddressHome',
  Points: 'Points',

  Dapps: 'Dapps',
  StackFavoriteDapps: 'StackFavoriteDapps',
  FavoriteDapps: 'FavoriteDapps',

  StackSettings: 'StackSettings',
  Settings: 'Settings',
  SetPassword: 'SetPassword',
  CustomTestnet: 'CustomTestnet',
  CustomRPC: 'CustomRPC',
  SetBiometricsAuthentication: 'SetBiometricsAuthentication',
  /** @deprecated */
  GetStarted: 'GetStarted',
  /* warning: dev only ------ start */
  ProviderControllerTester: 'ProviderControllerTester',
  /* warning: dev only ------ end */

  /* warning: testkits only ------ start */
  StackTestkits: 'StackTestkits',
  TestKits: 'TestKits',
  SampleNewUserGetStarted2024: 'SampleNewUserGetStarted2024',
  DevUIFontShowCase: 'DevUIFontShowCase',
  DevUIFormShowCase: 'DevUIFormShowCase',
  DevUIAccountShowCase: 'DevUIAccountShowCase',
  DevUIScreenContainerShowCase: 'DevUIScreenContainerShowCase',
  /* warning: testkits only ------ start */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  SendNFT: 'SendNFT',
  Receive: 'Receive',
  Swap: 'Swap',
  GnosisTransactionQueue: 'GnosisTransactionQueue',
  Approvals: 'Approvals',
  History: 'History',
  HistoryFilterScam: 'HistoryFilterScam',
  Bridge: 'Bridge',
  GasAccount: 'GasAccount',

  AccountTransaction: 'AccountTransaction',
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  AddressList: 'AddressList',
  ImportNewAddress: 'ImportNewAddress',
  ImportHardwareAddress: 'ImportHardwareAddress',
  ImportSuccess: 'ImportSuccess',
  ImportSuccess2024: 'ImportSuccess2024',
  ImportMethods: 'ImportMethods',
  ImportWatchAddress: 'ImportWatchAddress',
  ImportWatchAddress2024: 'ImportWatchAddress2024',
  ImportSafeAddress: 'ImportSafeAddress',
  ImportSafeAddress2024: 'ImportSafeAddress2024',
  AddressDetail: 'AddressDetail',
  NftDetail: 'NftDetail',
  CreateNewAddress: 'CreateNewAddress',
  CreateSelectOnCurrentSeed: 'CreateSelectOnCurrentSeed',
  SetPassword2024: 'SetPassword2024',
  CreateChooseBackup: 'CreateChooseBackup',

  ImportLedger: 'ImportLedger',
  ImportMoreAddress: 'ImportMoreAddress',
  ImportPrivateKey: 'ImportPrivateKey',
  ImportPrivateKey2024: 'ImportPrivateKey2024',
  ImportMnemonic: 'ImportMnemonic',
  ImportMnemonic2024: 'ImportMnemonic2024',
  CreateMnemonic: 'CreateMnemonic',
  PreCreateMnemonic: 'PreCreateMnemonic',
  AddMnemonic: 'AddMnemonic',
  CreateMnemonicBackup: 'CreateMnemonicBackup',
  CreateMnemonicVerify: 'CreateMnemonicVerify',
  Scanner: 'Scanner',
  BackupPrivateKey: 'BackupPrivateKey',
  BackupMnemonic: 'BackupMnemonic',
  RestoreFromCloud: 'RestoreFromCloud',
  WatchAddressList: 'WatchAddressList',
  SafeAddressList: 'SafeAddressList',

  SingleAddressStack: 'SingleAddressStack',
  SingleAddressHome: 'SingleAddressHome',
} as const;

export type AppRootName = keyof typeof RootNames;

export type ScreenStatusBarConf = {
  barStyle?: 'light-content' | 'dark-content';
  iosStatusBarStyle?: NativeStackNavigationOptions['statusBarStyle'];
  androidStatusBarBg?: string;
};

// function rgbaToAlphaHex(rgba: string) {
//   return colord(rgba).toHex();
// }

function makeScreenSpecConfig() {
  type ThemeType = {
    '@default': ScreenStatusBarConf;
    '@bg1default': ScreenStatusBarConf;
    '@openeddapp': ScreenStatusBarConf;
  } & {
    [P in AppRootName]?: ScreenStatusBarConf;
  };

  const [dark, light] = [true, false].map(isDarkTheme => {
    const adaptiveStatusBarStyle = isDarkTheme
      ? ('light-content' as const)
      : ('dark-content' as const);

    // const adaptiveIosStatusBarStyle = isDarkTheme
    //   ? 'dark' as const
    //   : 'light' as const;
    const adaptiveIosStatusBarStyle = isDarkTheme
      ? ('light' as const)
      : ('dark' as const);

    const colors = ThemeColors[isDarkTheme ? 'dark' : 'light'];

    const bg1DefaultConf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors['neutral-bg1'],
    };

    const bg2DefaultConf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors['neutral-bg2'],
    };

    const card2DefaultConf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors['neutral-card2'],
    };

    // const blueDefaultConf = <ScreenStatusBarConf>{
    //   barStyle: adaptiveStatusBarStyle,
    //   iosStatusBarStyle: adaptiveIosStatusBarStyle,
    //   androidStatusBarBg: colors['blue-default'],
    // };

    const blueLightConf = <ScreenStatusBarConf>{
      barStyle: 'light-content',
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors['blue-default'],
    };

    const themeSpecs = <ThemeType>{
      '@default': !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      '@bg1default': { ...bg1DefaultConf },
      '@openeddapp': {
        barStyle: 'dark-content',
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: 'rgba(255, 255, 255, 1)',
      },
      GetStarted: blueLightConf,
      GetStartedScreen2024: bg1DefaultConf,
      SampleNewUserGetStarted2024: bg1DefaultConf,

      Home: bg1DefaultConf,
      Unlock: bg1DefaultConf,

      // Dapps: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      // SearchDapps: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

      // History: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

      // ImportNewAddress: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      // AddressList: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      ImportWatchAddress: blueLightConf,
      ImportSafeAddress: blueLightConf,
      ImportSuccess: blueLightConf,
      ImportSuccess2024: blueLightConf,

      // Send: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      // Swap: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      Receive: blueLightConf,

      GnosisTransactionQueue: card2DefaultConf,

      Approvals: bg2DefaultConf,

      SetPassword: blueLightConf,
      SetBiometricsAuthentication: bg1DefaultConf,
      Scanner: blueLightConf,
      // Settings: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    };

    // return __DEV__ ? Object.freeze(themeSpecs) : themeSpecs;
    return themeSpecs;
  });

  return {
    dark,
    light,
  } as const;
}
const ScreenSpecs = makeScreenSpecConfig();

export function getScreenStatusBarConf(options: {
  screenName: string | AppRootName;
  isDarkTheme?: boolean;
  isShowingDappCard?: boolean;
}) {
  const { screenName, isDarkTheme, isShowingDappCard } = options || {};
  const rootSpecs = ScreenSpecs[isDarkTheme ? 'dark' : 'light'];

  const screenSpec = isShowingDappCard
    ? rootSpecs['@openeddapp']
    : rootSpecs[screenName as AppRootName] || rootSpecs['@default'];

  return {
    rootSpecs,
    screenSpec,
    navStatusBarBackground: screenSpec.androidStatusBarBg,
    navStatusBarStyle: screenSpec.iosStatusBarStyle,
  };
}

export const DEFAULT_NAVBAR_FONT_SIZE = 18;

export function makeHeadersPresets({
  colors,
}: { colors?: AppColorsVariants } = {}) {
  const navigationBarHeaderTitle = {
    fontWeight: '500' as const,
    fontSize: DEFAULT_NAVBAR_FONT_SIZE,
  };
  return {
    navigationBarHeaderTitle,
    onlyTitle: {
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTransparent: true,
      headerBackVisible: false,
      headerTitleStyle: { ...navigationBarHeaderTitle },
    } as NativeStackNavigationOptions,
    withBgCard2: {
      headerStyle: {
        backgroundColor: colors?.['neutral-card2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        ...navigationBarHeaderTitle,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    withBg2: {
      headerStyle: {
        backgroundColor: colors?.['neutral-bg2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        ...navigationBarHeaderTitle,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
  };
}
