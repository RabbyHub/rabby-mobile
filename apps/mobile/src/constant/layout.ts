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
export const TAB_HEADER_HEIGHT = 36;

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
  DevSwitches: 'DevSwitches',
  DevPerf: 'DevPerf',
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
  HistoryDetail: 'HistoryDetail',
  HistoryLocalDetail: 'HistoryLocalDetail',
  MultiAddressHistory: 'MultiAddressHistory',
  LendingHistory: 'LendingHistory',
  Bridge: 'Bridge',
  MultiBridge: 'MultiBridge',
  GasAccount: 'GasAccount',
  Perps: 'Perps',
  PerpsMarketList: 'PerpsMarketList',
  PerpsMarketDetail: 'PerpsMarketDetail',
  PerpsHistory: 'PerpsHistory',
  AccountTransaction: 'AccountTransaction',
  /** @deprecated */
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  /** @deprecated */
  AddressList: 'AddressList',
  ApprovalAddressList: 'ApprovalAddressList',
  /** @deprecated */
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

  /** @deprecated */
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
      [RootNames.GetStartedScreen2024]: bg1DefaultConf,
      [RootNames.CreateSelectMethod]: bg1Default2024Conf,
      // StackRoot
      // StackHomeNonTab

      [RootNames.NotFound]: bg1Default2024Conf,
      [RootNames.Unlock]: bg1DefaultConf,

      // StackBottom
      [RootNames.Home]: bg1Default2024Conf,
      [RootNames.Points]: bg1Default2024Conf,

      // StackDapps
      [RootNames.Dapps]: bg1Default2024Conf,
      [RootNames.FavoriteDapps]: bg1Default2024Conf,
      [RootNames.Search]: bg1Default2024Conf,
      [RootNames.Watchlist]: bg1Default2024Conf,
      [RootNames.Lending]: bg1Default2024Conf,

      // StackSettings
      [RootNames.Settings]: historyPageConf,
      [RootNames.SetPassword]: blueLightConf,
      [RootNames.CustomTestnet]: bg1Default2024Conf,
      [RootNames.CustomRPC]: bg1Default2024Conf,
      [RootNames.SetBiometricsAuthentication]: bg1DefaultConf,
      /** @deprecated */
      [RootNames.GetStarted]: blueLightConf,
      [RootNames.ProviderControllerTester]: bg1Default2024Conf,

      // StackTestkits
      [RootNames.NewUserGetStarted2024]: bg1DefaultConf,
      [RootNames.DevUIFontShowCase]: bg1Default2024Conf,
      [RootNames.DevUIAnimatedTextAndView]: bg1Default2024Conf,
      [RootNames.DevUIFormShowCase]: bg1Default2024Conf,
      [RootNames.DevUIAccountShowCase]: bg1Default2024Conf,
      [RootNames.DevUIScreenContainerShowCase]: bg1Default2024Conf,
      [RootNames.DevUIDapps]: bg1Default2024Conf,
      [RootNames.DevDataSQLite]: bg1Default2024Conf,
      [RootNames.DevUIBuiltInPages]: bg1Default2024Conf,
      [RootNames.DevUIPermissions]: bg1Default2024Conf,
      [RootNames.DevSwitches]: bg1Default2024Conf,
      [RootNames.DevPerf]: bg1Default2024Conf,

      // StackTransaction
      [RootNames.Send]: bg1Default2024Conf,
      [RootNames.SendHistory]: bg1Default2024Conf,
      [RootNames.MultiSend]: bg1Default2024Conf,
      [RootNames.SendNFT]: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      [RootNames.MultiSendNFT]: bg1Default2024Conf,
      [RootNames.Receive]: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      [RootNames.Swap]: bg1Default2024Conf,
      [RootNames.MultiSwap]: bg1Default2024Conf,
      [RootNames.GnosisTransactionQueue]: card2DefaultConf,
      [RootNames.Approvals]: bg1Default2024Conf,
      [RootNames.BatchRevoke]: transparentDefault2024Conf,
      [RootNames.History]: historyPageConf,
      [RootNames.HistoryDetail]: historyPageConf,
      [RootNames.HistoryLocalDetail]: historyPageConf,
      [RootNames.MultiAddressHistory]: historyPageConf,
      [RootNames.LendingHistory]: bg1Default2024Conf,
      [RootNames.Bridge]: bg1Default2024Conf,
      [RootNames.MultiBridge]: bg1Default2024Conf,
      [RootNames.GasAccount]: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      [RootNames.Perps]: bg1Default2024Conf,
      [RootNames.PerpsMarketList]: bg1Default2024Conf,
      [RootNames.PerpsMarketDetail]: bg1Default2024Conf,
      [RootNames.PerpsHistory]: bg1Default2024Conf,
      [RootNames.AccountTransaction]: bg1Default2024Conf,
      [RootNames.MyBundle]: bg1Default2024Conf,

      // StackAddress
      [RootNames.AddressList]: bg1Default2024Conf,
      [RootNames.ApprovalAddressList]: bg1Default2024Conf,
      [RootNames.ImportNewAddress]: bg1Default2024Conf,
      [RootNames.ImportHardwareAddress]: bg1Default2024Conf,
      [RootNames.ImportSuccess]: blueLightConf,
      [RootNames.ImportSuccess2024]: bg1Default2024Conf,
      [RootNames.ImportMethods]: bg1Default2024Conf,
      [RootNames.ImportWatchAddress]: blueLightConf,
      [RootNames.ImportWatchAddress2024]: bg1Default2024Conf,
      [RootNames.ImportSafeAddress]: blueLightConf,
      [RootNames.ImportSafeAddress2024]: bg1Default2024Conf,
      [RootNames.AddressDetail]: bg1Default2024Conf,
      [RootNames.NftDetail]: bg1Default2024Conf,
      [RootNames.DeFiDetail]: bg1Default2024Conf,
      [RootNames.CreateNewAddress]: bg1Default2024Conf,
      [RootNames.SetPassword2024]: bg1Default2024Conf,
      [RootNames.CreateChooseBackup]: bg1Default2024Conf,

      [RootNames.ImportLedger]: bg1Default2024Conf,
      [RootNames.ImportMoreAddress]: bg1Default2024Conf,
      [RootNames.ImportPrivateKey]: bg1Default2024Conf,
      [RootNames.ImportPrivateKey2024]: bg1Default2024Conf,
      [RootNames.ImportMnemonic]: bg1Default2024Conf,
      [RootNames.ImportMnemonic2024]: bg1Default2024Conf,
      [RootNames.CreateMnemonic]: bg1Default2024Conf,
      [RootNames.PreCreateMnemonic]: bg1Default2024Conf,
      [RootNames.AddMnemonic]: bg1Default2024Conf,
      [RootNames.CreateMnemonicBackup]: bg1Default2024Conf,
      [RootNames.CreateMnemonicVerify]: bg1Default2024Conf,
      [RootNames.Scanner]: transparentDefault2024Conf,
      [RootNames.BackupPrivateKey]: bg1Default2024Conf,
      [RootNames.RestoreFromCloud]: bg1Default2024Conf,
      [RootNames.WatchAddressList]: bg1Default2024Conf,
      [RootNames.SafeAddressList]: bg1Default2024Conf,

      [RootNames.SingleAddressStack]: bg1Default2024Conf,
      [RootNames.SingleAddressHome]: transparentDefault2024Conf,

      [RootNames.DappWebViewStubOnHome]: {
        barStyle: adaptiveStatusBarStyle,
        iosStatusBarStyle: adaptiveIosStatusBarStyle,
        androidStatusBarBg: colors['neutral-bg-1'],
      },
      [RootNames.TokenDetail]: transparentDefault2024Conf,
      [RootNames.TokenMarketInfo]: bg1Default2024Conf,
      [RootNames.ReceiveAddressList]: bg1Default2024Conf,

      [RootNames.SyncExtensionPassword]: bg1Default2024Conf,
      [RootNames.SyncExtensionImported]: bg1Default2024Conf,
      [RootNames.SyncExtensionAccountSuccess]: bg1Default2024Conf,

      // StackMain

      // StackBrowser
      [RootNames.BrowserScreen]: bg1Default2024Conf,
      [RootNames.BrowserManageScreen]: bg1Default2024Conf,
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
