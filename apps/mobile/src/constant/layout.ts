import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import {
  AppColors2024Variants,
  AppColorsVariants,
  ThemeColors,
  ThemeColors2024,
} from './theme';
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
export const ASSETS_ITEM_HEIGHT = 68;
export const ASSETS_ITEM_HEIGHT_NEW = 74;
export const ASSETS_SECTION_HEADER = 36;
export const ASSETS_SEPARATOR_HEIGHT = 8;
export const HEADER_TOP_AREA_HEIGHT = 185;

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

  modalBottomSpace: 133,
};

export const ScreenColors = {
  homeHeaderBlue: '#434EB9',
};

export const RootNames = {
  StackGetStarted: 'StackGetStarted',
  GetStartedScreen2024: 'GetStartedScreen2024',
  CreateSelectMethod: 'CreateSelectMethod',
  StackRoot: 'StackRoot',
  StackHomeNonTab: 'StackHomeNonTab',

  NotFound: 'NotFound',
  Unlock: 'Unlock',

  StackBottom: 'StackBottom',
  Home: 'Home',
  Points: 'Points',

  StackDapps: 'StackDapps',
  Dapps: 'Dapps',
  FavoriteDapps: 'FavoriteDapps',
  Search: 'Search',

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
  NewUserGetStarted2024: 'NewUserGetStarted2024',
  DevUIFontShowCase: 'DevUIFontShowCase',
  DevUIFormShowCase: 'DevUIFormShowCase',
  DevUIAccountShowCase: 'DevUIAccountShowCase',
  DevUIScreenContainerShowCase: 'DevUIScreenContainerShowCase',
  DevUIDapps: 'DevUIDapps',
  DevDataSQLite: 'DevDataSQLite',
  /* warning: testkits only ------ start */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  MultiSend: 'MultiSend',
  SendNFT: 'SendNFT',
  MultiSendNFT: 'MultiSendNFT',
  Receive: 'Receive',
  Swap: 'Swap',
  MultiSwap: 'MultiSwap',
  GnosisTransactionQueue: 'GnosisTransactionQueue',
  Approvals: 'Approvals',
  History: 'History',
  HistoryFilterScam: 'HistoryFilterScam',
  HistoryDetail: 'HistoryDetail',
  HistoryLocalDetail: 'HistoryLocalDetail',
  MultiAddressHistory: 'MultiAddressHistory',
  Bridge: 'Bridge',
  MultiBridge: 'MultiBridge',
  GasAccount: 'GasAccount',

  AccountTransaction: 'AccountTransaction',
  /* @deprecated */
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  AddressList: 'AddressList',
  ApprovalAddressList: 'ApprovalAddressList',
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
  DeFiDetail: 'DeFiDetail',
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

  DappWebViewStubOnHome: 'DappWebViewStubOnHome',
  TokenDetail: 'TokenDetail',
  ReceiveAddressList: 'ReceiveAddressList',
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
    const colors2024 = ThemeColors2024[isDarkTheme ? 'dark' : 'light'];

    const bg1DefaultConf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors['neutral-bg-1'],
    };

    const bg1Default2024Conf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors2024['neutral-bg-1'],
    };

    const bg2Default2024Conf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: colors2024['neutral-bg-2'],
    };

    const transparentDefault2024Conf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: 'transparent',
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
      '@default': bg1Default2024Conf,
      '@bg1default': { ...bg1DefaultConf },
      '@openeddapp': {
        barStyle: adaptiveStatusBarStyle,
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: colors['neutral-bg-1'],
      },
      GetStarted: blueLightConf,
      GetStartedScreen2024: bg1DefaultConf,
      NewUserGetStarted2024: bg1DefaultConf,

      Home: transparentDefault2024Conf,
      DappWebViewStubOnHome: {
        barStyle: adaptiveStatusBarStyle,
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: colors['neutral-bg-1'],
      },
      MultiAddressHome: bg1Default2024Conf,
      // MultiAddressHome: bg1Default2024Conf,
      Unlock: bg1DefaultConf,
      History: {
        ...bg2Default2024Conf,
        androidStatusBarBg: !isDarkTheme
          ? '#F6F7F7'
          : colors2024['neutral-bg-1'],
      },
      MultiHistory: {
        ...bg2Default2024Conf,
        androidStatusBarBg: !isDarkTheme
          ? '#F6F7F7'
          : colors2024['neutral-bg-1'],
      },
      MultiAddressHistory: bg2Default2024Conf,
      HistoryDetail: bg2Default2024Conf,
      HistoryLocalDetail: bg2Default2024Conf,

      Dapps: bg1Default2024Conf,
      SendNFT: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      // SearchDapps: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

      // History: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

      // ImportNewAddress: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      // AddressList: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      ImportWatchAddress: blueLightConf,
      ImportSafeAddress: blueLightConf,
      ImportSuccess: blueLightConf,
      // ImportSuccess2024: blueLightConf,
      Settings: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      SingleAddressHome: transparentDefault2024Conf,
      Receive: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      GasAccount: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      Send: bg1Default2024Conf,
      MultiSend: bg1Default2024Conf,
      Swap: bg1Default2024Conf,
      MultiSwap: bg1Default2024Conf,
      Bridge: bg1Default2024Conf,
      MultiBridge: bg1Default2024Conf,
      // Receive: blueLightConf,
      AddressList: bg1Default2024Conf,
      SafeAddressList: bg1Default2024Conf,
      WatchAddressList: bg1Default2024Conf,
      ApprovalAddressList: bg1Default2024Conf,

      GnosisTransactionQueue: card2DefaultConf,

      Approvals: bg1Default2024Conf,

      SetPassword: blueLightConf,
      SetPassword2024: bg1Default2024Conf,
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
  colors2024,
}: { colors?: AppColorsVariants; colors2024?: AppColors2024Variants } = {}) {
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
    /** @deprecated */
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
    /** @deprecated */
    withBg2: {
      headerStyle: {
        backgroundColor: colors?.['neutral-bg2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        fontWeight: '700' as const,
        fontFamily: 'SF Pro Rounded',
        fontSize: DEFAULT_NAVBAR_FONT_SIZE,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    withBgCard1_2024: {
      headerStyle: {
        backgroundColor: colors2024?.['neutral-bg-1'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        fontWeight: '700' as const,
        fontFamily: 'SF Pro Rounded',
        fontSize: DEFAULT_NAVBAR_FONT_SIZE,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    withBgCard2_2024: {
      headerStyle: {
        backgroundColor: colors?.['neutral-card2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        fontWeight: '700' as const,
        fontFamily: 'SF Pro Rounded',
        fontSize: DEFAULT_NAVBAR_FONT_SIZE,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    titleFont_2024: {
      color: colors2024?.['neutral-title-1'],
      fontWeight: '700' as const,
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
    },
  };
}
