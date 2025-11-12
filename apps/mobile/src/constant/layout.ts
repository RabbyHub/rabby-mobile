import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import {
  AppColors2024Variants,
  AppColorsVariants,
  ThemeColors,
  ThemeColors2024,
} from './theme';
import { IS_ANDROID } from '@/core/native/utils';
import { Dimensions } from 'react-native';

export const ModalLayouts = {
  defaultHeightPercentText: '80%' as `${number}%`,
  titleTopOffset: 8,
};

// for DappWebViewControl
export const ScreenLayouts = {
  homeHorizontalPadding: 16,
  headerAreaHeight: 56,
  bottomBarHeight: 60,

  dappWebViewControlHeaderHeight: 44,

  defaultWebViewNavBottomSheetHeight: 52 + 40,
  dappWebViewNavBottomSheetHeight: 302,
  inConnectedDappWebViewNavBottomSheetHeight: 302 /*  - 120 */,
};
const SCREEN_WIDTH = Dimensions.get('window').width - 32;
export const DEFI_CARD_WIDTH = (SCREEN_WIDTH - 12) / 2;
export const ASSETS_ITEM_HEIGHT = 68;
export const ASSETS_ITEM_HEIGHT_NEW = 74;
export const DEFI_ITEM_HEIGHT = 200;
export const ASSETS_SECTION_HEADER = 36;
export const TOKEN_EMPTY_ROW_HIGHT = 326;
export const ASSETS_EMPTY_ROW_HIGHT = 186;
export const ASSETS_SEPARATOR_HEIGHT = 8;
export const ASSETS_LIST_HEADER = 22;
export const DEFI_SEPARATOR_HEIGHT = 12;
export const HEADER_TOP_AREA_HEIGHT = 250;
export const HEADER_CHART_HEIGHT = 205;
export const ALERT_HEIGHT = 65;
export const SWITCH_HEADER_HEIGHT = 58;
export const SWITCH_HEADER_GAP = 16;
export const ADDRESS_ENTRY_HEIGHT = 78;
export const ADDRESS_ENTRY_GAP = 12;
export const TOGGLE_SPLIT_HEIGHT = 24;

export const FOLD_ASSETS_HEADER_HEIGHT = 46 + 32;
export const UNFOLD_ASSETS_HEADER_HEIGHT = 161 + 20;

// for DappWebViewControl2
export const ScreenLayouts2 = {
  headerAreaHeight: 52,

  // dappWebViewControlHeaderHeight: (IS_ANDROID ? 10 : 0) /* padding-top */ + 56,
  dappWebViewControlHeaderHeight: 52,
  dappWebViewControlNavHeight: 68,

  TabbedDappWebViewControlNavHeight: IS_ANDROID ? 57 : 68,
  TabbedDappWebViewControlNavHeightV2: IS_ANDROID ? 104 : 124,
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

  modalBottomSpace: 200,
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
  Watchlist: 'Watchlist',
  Lending: 'Lending',

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
  DevUIAnimatedTextAndView: 'DevUIAnimatedTextAndView',
  DevUIFormShowCase: 'DevUIFormShowCase',
  DevUIAccountShowCase: 'DevUIAccountShowCase',
  DevUIScreenContainerShowCase: 'DevUIScreenContainerShowCase',
  DevUIDapps: 'DevUIDapps',
  DevDataSQLite: 'DevDataSQLite',
  DevUIBuiltInPages: 'DevUIBuiltInPages',
  DevUIPermissions: 'DevUIPermissions',
  /* warning: testkits only ------ start */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  SendHistory: 'SendHistory',
  /** @deprecated */
  MultiSend: 'MultiSend',
  SendNFT: 'SendNFT',
  MultiSendNFT: 'MultiSendNFT',
  Receive: 'Receive',
  Swap: 'Swap',
  MultiSwap: 'MultiSwap',
  GnosisTransactionQueue: 'GnosisTransactionQueue',
  Approvals: 'Approvals',
  BatchRevoke: 'BatchRevoke',
  History: 'History',
  CopyTradingTokenDetail: 'CopyTradingTokenDetail',
  HistoryDetail: 'HistoryDetail',
  HistoryLocalDetail: 'HistoryLocalDetail',
  MultiAddressHistory: 'MultiAddressHistory',
  LendingHistory: 'LendingHistory',
  Bridge: 'Bridge',
  MultiBridge: 'MultiBridge',
  GasAccount: 'GasAccount',
  /** @deprecated */
  Buy: 'Buy',
  /** @deprecated */
  MultiBuy: 'MultiBuy',
  /**
   * @deprecated
   */
  CopyTrading: 'CopyTrading',
  Perps: 'Perps',
  PerpsMarketList: 'PerpsMarketList',
  PerpsMarketDetail: 'PerpsMarketDetail',
  PerpsHistory: 'PerpsHistory',
  AccountTransaction: 'AccountTransaction',
  /* @deprecated */
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  AddressList: 'AddressList',
  AddressAssetsOverview: 'AddressAssetsOverview',
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
  /** @deprecated */
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
  TokenMarketInfo: 'TokenMarketInfo',
  ReceiveAddressList: 'ReceiveAddressList',

  SyncExtensionPassword: 'SyncExtensionPassword',
  SyncExtensionImported: 'SyncExtensionImported',
  SyncExtensionAccountSuccess: 'SyncExtensionAccountSuccess',

  StackMain: 'StackMain',

  StackBrowser: 'StackBrowser',
  BrowserScreen: 'BrowserScreen',
  BrowserManageScreen: 'BrowserManageScreen',
} as const;

export type AppRootName = keyof typeof RootNames;

type NonStackAppRootName = Exclude<AppRootName, `Stack${string}`>;

export type ScreenStatusBarConf = {
  barStyle?: 'light-content' | 'dark-content';
  iosStatusBarStyle?: NativeStackNavigationOptions['statusBarStyle'];
  androidStatusBarBg?: string;
};

// function rgbaToAlphaHex(rgba: string) {
//   return colord(rgba).toHex();
// }

export function makeTxPageBackgroundColors({
  isLight,
  colors2024,
}: {
  isLight?: boolean;
  colors2024: AppColors2024Variants;
}) {
  return isLight ? '#F6F7F7' : colors2024['neutral-bg-1'];
}

function makeScreenSpecConfig() {
  type ThemeType = {
    '@default': ScreenStatusBarConf;
    '@bg1default': ScreenStatusBarConf;
    '@openeddapp': ScreenStatusBarConf;
  } & Record<NonStackAppRootName, ScreenStatusBarConf>;

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
    const colors2024 = ThemeColors2024[
      isDarkTheme ? 'dark' : 'light'
    ] as AppColors2024Variants;

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

    const historyPageConf = <ScreenStatusBarConf>{
      ...bg2Default2024Conf,
      androidStatusBarBg: makeTxPageBackgroundColors({
        isLight: !isDarkTheme,
        colors2024,
      }),
    };

    const transparentDefault2024Conf = <ScreenStatusBarConf>{
      barStyle: adaptiveStatusBarStyle,
      iosStatusBarStyle: adaptiveIosStatusBarStyle,
      androidStatusBarBg: 'transparent',
    };

    // const bg2DefaultConf = <ScreenStatusBarConf>{
    //   barStyle: adaptiveStatusBarStyle,
    //   iosStatusBarStyle: adaptiveIosStatusBarStyle,
    //   androidStatusBarBg: colors['neutral-bg2'],
    // };

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

    const themeSpecs: ThemeType = {
      '@default': bg1Default2024Conf,
      '@bg1default': { ...bg1DefaultConf },
      '@openeddapp': {
        barStyle: adaptiveStatusBarStyle,
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: colors['neutral-bg-1'],
      },

      // StackGetStarted
      GetStartedScreen2024: bg1DefaultConf,
      CreateSelectMethod: bg1Default2024Conf,
      // StackRoot
      // StackHomeNonTab

      NotFound: bg1Default2024Conf,
      Unlock: bg1DefaultConf,

      // StackBottom
      Home: bg1Default2024Conf,
      Points: bg1Default2024Conf,

      // StackDapps
      Dapps: bg1Default2024Conf,
      FavoriteDapps: bg1Default2024Conf,
      Search: bg1Default2024Conf,
      Watchlist: bg1Default2024Conf,
      Lending: bg1Default2024Conf,

      // StackSettings
      Settings: historyPageConf,
      SetPassword: blueLightConf,
      CustomTestnet: bg1Default2024Conf,
      CustomRPC: bg1Default2024Conf,
      SetBiometricsAuthentication: bg1DefaultConf,
      /** @deprecated */
      GetStarted: blueLightConf,
      /* warning: dev only ------ start */
      ProviderControllerTester: bg1Default2024Conf,
      /* warning: dev only ------ end */

      /* warning: testkits only ------ start */
      // StackTestkits
      NewUserGetStarted2024: bg1DefaultConf,
      DevUIFontShowCase: bg1Default2024Conf,
      DevUIAnimatedTextAndView: bg1Default2024Conf,
      DevUIFormShowCase: bg1Default2024Conf,
      DevUIAccountShowCase: bg1Default2024Conf,
      DevUIScreenContainerShowCase: bg1Default2024Conf,
      DevUIDapps: bg1Default2024Conf,
      DevDataSQLite: bg1Default2024Conf,
      DevUIBuiltInPages: bg1Default2024Conf,
      DevUIPermissions: bg1Default2024Conf,
      /* warning: testkits only ------ start */

      // StackTransaction
      Send: bg1Default2024Conf,
      SendHistory: bg1Default2024Conf,
      /** @deprecated */
      MultiSend: bg1Default2024Conf,
      SendNFT: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      MultiSendNFT: bg1Default2024Conf,
      Receive: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      Swap: bg1Default2024Conf,
      MultiSwap: bg1Default2024Conf,
      GnosisTransactionQueue: card2DefaultConf,
      Approvals: bg1Default2024Conf,
      BatchRevoke: transparentDefault2024Conf,
      History: historyPageConf,
      CopyTradingTokenDetail: bg1Default2024Conf,
      HistoryDetail: historyPageConf,
      HistoryLocalDetail: historyPageConf,
      MultiAddressHistory: historyPageConf,
      LendingHistory: bg1Default2024Conf,
      Bridge: bg1Default2024Conf,
      MultiBridge: bg1Default2024Conf,
      GasAccount: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      /** @deprecated */
      Buy: bg1Default2024Conf,
      /** @deprecated */
      MultiBuy: bg1Default2024Conf,
      /**
       * @deprecated
       */
      CopyTrading: bg1Default2024Conf,
      Perps: bg1Default2024Conf,
      PerpsMarketList: bg1Default2024Conf,
      PerpsMarketDetail: bg1Default2024Conf,
      PerpsHistory: bg1Default2024Conf,
      AccountTransaction: bg1Default2024Conf,
      /* @deprecated */
      MyBundle: bg1Default2024Conf,

      // StackAddress
      AddressList: bg1Default2024Conf,
      AddressAssetsOverview: bg1Default2024Conf,
      ApprovalAddressList: bg1Default2024Conf,
      ImportNewAddress: bg1Default2024Conf,
      ImportHardwareAddress: bg1Default2024Conf,
      ImportSuccess: blueLightConf,
      ImportSuccess2024: bg1Default2024Conf,
      ImportMethods: bg1Default2024Conf,
      ImportWatchAddress: blueLightConf,
      ImportWatchAddress2024: bg1Default2024Conf,
      ImportSafeAddress: blueLightConf,
      ImportSafeAddress2024: bg1Default2024Conf,
      AddressDetail: bg1Default2024Conf,
      NftDetail: bg1Default2024Conf,
      DeFiDetail: bg1Default2024Conf,
      CreateNewAddress: bg1Default2024Conf,
      CreateSelectOnCurrentSeed: bg1Default2024Conf,
      SetPassword2024: bg1Default2024Conf,
      CreateChooseBackup: bg1Default2024Conf,

      ImportLedger: bg1Default2024Conf,
      ImportMoreAddress: bg1Default2024Conf,
      ImportPrivateKey: bg1Default2024Conf,
      ImportPrivateKey2024: bg1Default2024Conf,
      /** @deprecated */
      ImportMnemonic: bg1Default2024Conf,
      ImportMnemonic2024: bg1Default2024Conf,
      CreateMnemonic: bg1Default2024Conf,
      PreCreateMnemonic: bg1Default2024Conf,
      AddMnemonic: bg1Default2024Conf,
      CreateMnemonicBackup: bg1Default2024Conf,
      CreateMnemonicVerify: bg1Default2024Conf,
      Scanner: transparentDefault2024Conf,
      BackupPrivateKey: bg1Default2024Conf,
      BackupMnemonic: bg1Default2024Conf,
      RestoreFromCloud: bg1Default2024Conf,
      WatchAddressList: bg1Default2024Conf,
      SafeAddressList: bg1Default2024Conf,

      SingleAddressStack: bg1Default2024Conf,
      SingleAddressHome: transparentDefault2024Conf,

      DappWebViewStubOnHome: {
        barStyle: adaptiveStatusBarStyle,
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: colors['neutral-bg-1'],
      },
      TokenDetail: transparentDefault2024Conf,
      TokenMarketInfo: bg1Default2024Conf,
      ReceiveAddressList: bg1Default2024Conf,

      SyncExtensionPassword: bg1Default2024Conf,
      SyncExtensionImported: bg1Default2024Conf,
      SyncExtensionAccountSuccess: bg1Default2024Conf,

      // StackMain

      // StackBrowser
      BrowserScreen: bg1Default2024Conf,
      BrowserManageScreen: bg1Default2024Conf,
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
