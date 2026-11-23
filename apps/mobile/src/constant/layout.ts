import { RoundedFontStyles } from '@/core/utils/fonts';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import {
  AppColors2024Variants,
  AppColorsVariants,
  ThemeColors,
  ThemeColors2024,
} from './theme';
import { IS_ANDROID } from '@/core/native/utils';

export const BOTTOM_BUTTON_BOTTOM_OFFSET = 36;
export const BOTTOM_BUTTON_TOP_OFFSET = 12;
export const BOTTOM_BUTTON_GAP = 12;
export const BOTTOM_BUTTON_SINGLE_HEIGHT = 52;
export const BOTTOM_BUTTON_COMPACT_HEIGHT = 36;
export const BOTTOM_BUTTON_DOUBLE_HEIGHT = 48;
export const BOTTOM_BUTTON_TEXT_SIZE = 18;
export const BOTTOM_BUTTON_TEXT_LINE_HEIGHT = 22;
// 标题样式不带 lineHeight。Button 在传入 height 时自己居中：iOS 用
// BOTTOM_BUTTON_TEXT_LINE_HEIGHT，Android 不设行高。非 Button 的 Text 需要
// 固定行高时用 BOTTOM_BUTTON_TEXT_LINE_HEIGHT。
export const BOTTOM_BUTTON_TITLE_STYLE = {
  fontSize: BOTTOM_BUTTON_TEXT_SIZE,
  fontWeight: '700',
} as const;
export const BOTTOM_BUTTON_COMPACT_TITLE_STYLE = {
  fontSize: 16,
  fontWeight: '500',
} as const;
export const BOTTOM_BUTTON_WITH_ICON_TITLE_STYLE = {
  fontSize: BOTTOM_BUTTON_TEXT_SIZE,
  fontWeight: '700',
} as const;
export const getBottomButtonBottomOffset = (safeAreaBottom = 0) =>
  BOTTOM_BUTTON_BOTTOM_OFFSET + (IS_ANDROID ? safeAreaBottom : 0);

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
export const ASSETS_ITEM_HEIGHT = 68;
export const ASSETS_ITEM_HEIGHT_NEW = 70;
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

/**
 * iPhone logical screen sizes in portrait (points), grouped by width tier.
 *
 * Source: Apple device specifications, compiled at
 * https://www.ios-resolution.com/ (checked 2026-11-20).
 *
 * Width is the dimension that matters for horizontal layout. When a style
 * needs a narrow-screen variant, gate it with `isNarrowScreenWidth()` (or
 * compare against `NARROW_SCREEN_MAX_WIDTH`) so wider screens keep the
 * regular layout untouched. Heights are listed only to identify the tier.
 *
 * Android phones can be narrower than 375dp too (Galaxy S series is 360dp),
 * so anything `<= 375` takes the narrow variant on both platforms.
 */
export const IPHONE_SCREEN_TIERS = [
  {
    width: 320,
    heights: [480, 568],
    models: ['iPhone 4/4S', 'iPhone 5/5S/5C/SE 1st'],
  },
  {
    width: 375,
    heights: [667, 812],
    models: [
      'iPhone 6/6s/7/8/SE 2nd/SE 3rd',
      'iPhone X/XS/11 Pro/12 mini/13 mini',
    ],
  },
  {
    width: 390,
    heights: [844],
    models: ['iPhone 12/12 Pro/13/13 Pro/14/16e/17e'],
  },
  { width: 393, heights: [852], models: ['iPhone 14 Pro/15/15 Pro/16'] },
  { width: 402, heights: [874], models: ['iPhone 16 Pro/17/17 Pro/18 Pro'] },
  {
    width: 414,
    heights: [736, 896],
    models: ['iPhone 6/7/8 Plus', 'iPhone XR/XS Max/11/11 Pro Max'],
  },
  { width: 420, heights: [912], models: ['iPhone Air'] },
  {
    width: 428,
    heights: [926],
    models: ['iPhone 12/13 Pro Max', 'iPhone 14 Plus'],
  },
  {
    width: 430,
    heights: [932],
    models: ['iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus'],
  },
  {
    width: 440,
    heights: [956],
    models: ['iPhone 16 Pro Max/17 Pro Max/18 Pro Max'],
  },
] as const;

/** Narrowest tier that still ships: iPhone SE 2nd/3rd and the mini line. */
export const NARROW_SCREEN_MAX_WIDTH = 375;

export const isNarrowScreenWidth = (width?: number) =>
  typeof width === 'number' && width > 0 && width <= NARROW_SCREEN_MAX_WIDTH;

export const FOLD_ASSETS_HEADER_HEIGHT = 64;
export const FOLD_ASSETS_HEADER_HEIGHT_WITH_PADDING = 64 + 32;
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
  CreateSelectMethod: 'CreateSelectMethod',
  StackRoot: 'StackRoot',
  StackHomeNonTab: 'StackHomeNonTab',

  NotFound: 'NotFound',
  Unlock: 'Unlock',

  StackBottom: 'StackBottom',
  Home: 'Home',
  Points: 'Points',
  Prediction: 'Prediction',

  StackDapps: 'StackDapps',
  Dapps: 'Dapps',
  FavoriteDapps: 'FavoriteDapps',
  Search: 'Search',
  Market: 'Market',
  Watchlist: 'Watchlist',
  Meme: 'Meme',
  Lending: 'Lending',

  StackSettings: 'StackSettings',
  Settings: 'Settings',
  SetPassword: 'SetPassword',
  WalletConnect: 'WalletConnect',
  CustomTestnet: 'CustomTestnet',
  CustomRPC: 'CustomRPC',
  SetBiometricsAuthentication: 'SetBiometricsAuthentication',
  GetStarted: 'GetStarted',
  /* warning: dev only ------ start */
  ProviderControllerTester: 'ProviderControllerTester',
  /* warning: dev only ------ end */

  /* warning: testkits only ------ start */
  StackTestkits: 'StackTestkits',
  DevUIFontShowCase: 'DevUIFontShowCase',
  DevUIAnimatedTextAndView: 'DevUIAnimatedTextAndView',
  DevUIAutoFitTitlePlayground: 'DevUIAutoFitTitlePlayground',
  DevUIFormShowCase: 'DevUIFormShowCase',
  DevUIAccountShowCase: 'DevUIAccountShowCase',
  DevUIComponents2024ShowCase: 'DevUIComponents2024ShowCase',
  DevUISafeSvgMedia: 'DevUISafeSvgMedia',
  DevUIScreenContainerShowCase: 'DevUIScreenContainerShowCase',
  DevUIToast: 'DevUIToast',
  DevUINotifications: 'DevUINotifications',
  DevUIDapps: 'DevUIDapps',
  DevDataSQLite: 'DevDataSQLite',
  DevWatchAddressFixtureImport: 'DevWatchAddressFixtureImport',
  DevDataKeychain: 'DevDataKeychain',
  DevDataKeyringVault: 'DevDataKeyringVault',
  DevDataContactService: 'DevDataContactService',
  DevDataWhitelist: 'DevDataWhitelist',
  DevUIBuiltInPages: 'DevUIBuiltInPages',
  DevUIPermissions: 'DevUIPermissions',
  DevUIWalletConnect: 'DevUIWalletConnect',
  DevCapabilityFile: 'DevCapabilityFile',
  DevSwitches: 'DevSwitches',
  DevScreenInjectionProbe: 'DevScreenInjectionProbe',
  DevTabsHost: 'DevTabsHost',
  DevPerf: 'DevPerf',
  DebugLogViewer: 'DebugLogViewer',
  StartupPerformanceLogViewer: 'StartupPerformanceLogViewer',
  InMemoryLogViewer: 'InMemoryLogViewer',
  /* warning: testkits only ------ start */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  SendHistory: 'SendHistory',
  /** @deprecated */
  MultiSend: 'MultiSend',
  SendNFT: 'SendNFT',
  MultiSendNFT: 'MultiSendNFT',
  Receive: 'Receive',
  SwapBridge: 'SwapBridge',
  MultiSwapBridge: 'MultiSwapBridge',
  GnosisTransactionQueue: 'GnosisTransactionQueue',
  Approvals: 'Approvals',
  BatchRevoke: 'BatchRevoke',
  History: 'History',
  HistoryDetail: 'HistoryDetail',
  BridgeDetail: 'BridgeDetail',
  HistoryLocalDetail: 'HistoryLocalDetail',
  MultiAddressHistory: 'MultiAddressHistory',
  LendingHistory: 'LendingHistory',
  ConvertDust: 'ConvertDust',
  MemeCoin: 'MemeCoin',
  MemeCoinBuy: 'MemeCoinBuy',
  MemeCoinExecute: 'MemeCoinExecute',
  GasAccount: 'GasAccount',
  Perps: 'Perps',
  PerpsMarketList: 'PerpsMarketList',
  PerpsMarketDetail: 'PerpsMarketDetail',
  PerpsHistory: 'PerpsHistory',
  PerpsProHistory: 'PerpsProHistory',
  PerpsSearch: 'PerpsSearch',
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
  SelectAddMethod: 'SelectAddMethod',
  MoreImportMethods: 'MoreImportMethods',
  AddressDetail: 'AddressDetail',
  NftDetail: 'NftDetail',
  CreateNewAddress: 'CreateNewAddress',
  SetupWallet: 'SetupWallet',
  SelectImportMethod: 'SelectImportMethod',
  ImportRabbyWallet: 'ImportRabbyWallet',
  SetPassword2024: 'SetPassword2024',
  CreateChooseBackup: 'CreateChooseBackup',

  ImportLedger: 'ImportLedger',
  ImportMoreAddress: 'ImportMoreAddress',
  ImportPrivateKey: 'ImportPrivateKey',
  ImportPrivateKey2024: 'ImportPrivateKey2024',
  /** @deprecated */
  ImportMnemonic: 'ImportMnemonic',
  ImportMnemonic2024: 'ImportMnemonic2024',
  ImportSecret: 'ImportSecret',
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

  Backup: 'Backup',

  /** @deprecated */
  StackMain: 'StackMain',

  StackBrowser: 'StackBrowser',
  BrowserScreen: 'BrowserScreen',
  BrowserManageScreen: 'BrowserManageScreen',
} as const;

export type AppRootName = keyof typeof RootNames;

type NonStackAppRootName = Exclude<AppRootName, `Stack${string}`>;

export type ScreenSystemBarConfig = {
  statusBarStyle: 'light-content' | 'dark-content';
  statusBarBackgroundColor: string;
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
    '@default': ScreenSystemBarConfig;
    '@bg1default': ScreenSystemBarConfig;
    '@openeddapp': ScreenSystemBarConfig;
  } & Record<NonStackAppRootName, ScreenSystemBarConfig>;

  const [dark, light] = [true, false].map(isDarkTheme => {
    const statusBarStyle = isDarkTheme
      ? ('light-content' as const)
      : ('dark-content' as const);

    const colors = ThemeColors[isDarkTheme ? 'dark' : 'light'];
    const colors2024 = ThemeColors2024[
      isDarkTheme ? 'dark' : 'light'
    ] as AppColors2024Variants;

    const bg1DefaultConf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor: colors['neutral-bg-1'],
    };

    const bg1Default2024Conf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor: colors2024['neutral-bg-1'],
    };

    const bg2Default2024Conf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor: colors2024['neutral-bg-2'],
    };

    const historyPageConf = <ScreenSystemBarConfig>{
      ...bg2Default2024Conf,
      statusBarBackgroundColor: makeTxPageBackgroundColors({
        isLight: !isDarkTheme,
        colors2024,
      }),
    };

    const bridgeDetailPageConf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor:
        colors2024[isDarkTheme ? 'neutral-bg-1' : 'neutral-bg-0'],
    };

    const transparentDefault2024Conf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor: 'transparent',
    };

    const card2DefaultConf = <ScreenSystemBarConfig>{
      statusBarStyle,
      statusBarBackgroundColor: colors['neutral-card2'],
    };

    const blueLightConf = <ScreenSystemBarConfig>{
      statusBarStyle: 'light-content',
      statusBarBackgroundColor: colors['blue-default'],
    };

    const themeSpecs: ThemeType = {
      '@default': bg1Default2024Conf,
      '@bg1default': { ...bg1DefaultConf },
      '@openeddapp': bg1DefaultConf,

      // StackGetStarted
      [RootNames.GetStarted]: bg1DefaultConf,
      [RootNames.CreateSelectMethod]: bg1Default2024Conf,
      // StackRoot
      // StackHomeNonTab

      [RootNames.NotFound]: bg1Default2024Conf,
      [RootNames.Unlock]: bg1DefaultConf,

      // StackBottom
      [RootNames.Home]: transparentDefault2024Conf,
      [RootNames.Points]: transparentDefault2024Conf,
      [RootNames.Prediction]: bg1Default2024Conf,

      // StackDapps
      [RootNames.Dapps]: bg1Default2024Conf,
      [RootNames.FavoriteDapps]: bg1Default2024Conf,
      [RootNames.Search]: bg1Default2024Conf,
      [RootNames.Market]: bg1Default2024Conf,
      [RootNames.Watchlist]: bg1Default2024Conf,
      [RootNames.Meme]: bg1Default2024Conf,
      [RootNames.Lending]: transparentDefault2024Conf,

      // StackSettings
      [RootNames.Settings]: transparentDefault2024Conf,
      [RootNames.SetPassword]: blueLightConf,
      [RootNames.WalletConnect]: transparentDefault2024Conf,
      [RootNames.CustomTestnet]: card2DefaultConf,
      [RootNames.CustomRPC]: bg1Default2024Conf,
      [RootNames.SetBiometricsAuthentication]: bg1DefaultConf,
      [RootNames.ProviderControllerTester]: bg1Default2024Conf,

      // StackTestkits
      [RootNames.DevUIFontShowCase]: bg1Default2024Conf,
      [RootNames.DevUIAnimatedTextAndView]: bg1Default2024Conf,
      [RootNames.DevUIAutoFitTitlePlayground]: bg1Default2024Conf,
      [RootNames.DevUIFormShowCase]: bg1Default2024Conf,
      [RootNames.DevUIAccountShowCase]: bg1Default2024Conf,
      [RootNames.DevUIComponents2024ShowCase]: bg1Default2024Conf,
      [RootNames.DevUISafeSvgMedia]: bg1Default2024Conf,
      [RootNames.DevUIToast]: bg1Default2024Conf,
      [RootNames.DevUINotifications]: bg1Default2024Conf,
      [RootNames.DevUIScreenContainerShowCase]: bg1Default2024Conf,
      [RootNames.DevUIDapps]: bg1Default2024Conf,
      [RootNames.DevDataSQLite]: bg1Default2024Conf,
      [RootNames.DevWatchAddressFixtureImport]: bg1Default2024Conf,
      [RootNames.DevDataKeychain]: bg1Default2024Conf,
      [RootNames.DevDataKeyringVault]: bg1Default2024Conf,
      [RootNames.DevDataContactService]: bg1Default2024Conf,
      [RootNames.DevDataWhitelist]: bg1Default2024Conf,
      [RootNames.DevUIBuiltInPages]: bg1Default2024Conf,
      [RootNames.DevUIPermissions]: bg1Default2024Conf,
      [RootNames.DevUIWalletConnect]: bg1Default2024Conf,
      [RootNames.DevCapabilityFile]: bg1Default2024Conf,
      [RootNames.DevSwitches]: bg1Default2024Conf,
      [RootNames.DevScreenInjectionProbe]: bg1Default2024Conf,
      [RootNames.DevTabsHost]: bg1Default2024Conf,
      [RootNames.DevPerf]: bg1Default2024Conf,
      [RootNames.DebugLogViewer]: bg1Default2024Conf,
      [RootNames.StartupPerformanceLogViewer]: bg1Default2024Conf,
      [RootNames.InMemoryLogViewer]: bg1Default2024Conf,

      // StackTransaction
      [RootNames.Send]: bg1Default2024Conf,
      [RootNames.SendHistory]: bg1Default2024Conf,
      [RootNames.MultiSend]: bg1Default2024Conf,
      [RootNames.SendNFT]: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
      [RootNames.MultiSendNFT]: bg1Default2024Conf,
      [RootNames.Receive]: transparentDefault2024Conf,
      [RootNames.SwapBridge]: bg1Default2024Conf,
      [RootNames.MultiSwapBridge]: bg1Default2024Conf,
      [RootNames.GnosisTransactionQueue]: card2DefaultConf,
      [RootNames.Approvals]: bg1Default2024Conf,
      [RootNames.BatchRevoke]: transparentDefault2024Conf,
      [RootNames.History]: historyPageConf,
      [RootNames.HistoryDetail]: historyPageConf,
      [RootNames.BridgeDetail]: bridgeDetailPageConf,
      [RootNames.HistoryLocalDetail]: historyPageConf,
      [RootNames.MultiAddressHistory]: historyPageConf,
      [RootNames.LendingHistory]: bg1Default2024Conf,
      [RootNames.ConvertDust]: bg1Default2024Conf,
      [RootNames.MemeCoin]: transparentDefault2024Conf,
      [RootNames.MemeCoinBuy]: transparentDefault2024Conf,
      [RootNames.MemeCoinExecute]: transparentDefault2024Conf,
      [RootNames.GasAccount]: transparentDefault2024Conf,
      [RootNames.Perps]: transparentDefault2024Conf,
      [RootNames.PerpsMarketList]: bg1Default2024Conf,
      [RootNames.PerpsMarketDetail]: bg1Default2024Conf,
      [RootNames.PerpsHistory]: bg1Default2024Conf,
      [RootNames.PerpsProHistory]: bg1Default2024Conf,
      [RootNames.PerpsSearch]: bg1Default2024Conf,
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
      [RootNames.SelectAddMethod]: bg1Default2024Conf,
      [RootNames.MoreImportMethods]: bg1Default2024Conf,
      [RootNames.AddressDetail]: bg1Default2024Conf,
      [RootNames.NftDetail]: bg1Default2024Conf,
      [RootNames.CreateNewAddress]: bg1Default2024Conf,
      [RootNames.SetupWallet]: bg1Default2024Conf,
      [RootNames.SelectImportMethod]: bg1Default2024Conf,
      [RootNames.ImportRabbyWallet]: bg1Default2024Conf,
      [RootNames.SetPassword2024]: bg1Default2024Conf,
      [RootNames.CreateChooseBackup]: bg1Default2024Conf,

      [RootNames.ImportLedger]: bg1Default2024Conf,
      [RootNames.ImportMoreAddress]: bg1Default2024Conf,
      [RootNames.ImportPrivateKey]: bg1Default2024Conf,
      [RootNames.ImportPrivateKey2024]: bg1Default2024Conf,
      [RootNames.ImportMnemonic]: bg1Default2024Conf,
      [RootNames.ImportMnemonic2024]: bg1Default2024Conf,
      [RootNames.ImportSecret]: bg1Default2024Conf,
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
        statusBarStyle,
        statusBarBackgroundColor: colors['neutral-bg-1'],
      },
      [RootNames.TokenDetail]: transparentDefault2024Conf,
      [RootNames.TokenMarketInfo]: transparentDefault2024Conf,
      [RootNames.ReceiveAddressList]: bg1Default2024Conf,

      [RootNames.SyncExtensionPassword]: bg1Default2024Conf,
      [RootNames.SyncExtensionImported]: bg1Default2024Conf,
      [RootNames.SyncExtensionAccountSuccess]: bg1Default2024Conf,

      [RootNames.Backup]: bg1Default2024Conf,

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

type GetScreenSystemBarConfigOptions = {
  screenName: string | AppRootName;
  isDarkTheme?: boolean;
  isShowingDappCard?: boolean;
};

export function getOwnScreenSystemBarConfig(
  options: Omit<GetScreenSystemBarConfigOptions, 'isShowingDappCard'>,
) {
  const { screenName, isDarkTheme } = options;
  const rootSpecs = ScreenSpecs[isDarkTheme ? 'dark' : 'light'];

  return rootSpecs[screenName as AppRootName];
}

export function getScreenContentBackgroundColor(
  options: Omit<GetScreenSystemBarConfigOptions, 'isShowingDappCard'>,
) {
  return (
    getOwnScreenSystemBarConfig(options)?.statusBarBackgroundColor ||
    'transparent'
  );
}

export function getScreenSystemBarConfig(
  options: GetScreenSystemBarConfigOptions,
) {
  const { screenName, isDarkTheme, isShowingDappCard } = options || {};
  const rootSpecs = ScreenSpecs[isDarkTheme ? 'dark' : 'light'];

  const screenSpec = isShowingDappCard
    ? rootSpecs['@openeddapp']
    : getOwnScreenSystemBarConfig({ screenName, isDarkTheme }) ||
      rootSpecs['@default'];

  return screenSpec;
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
        ...RoundedFontStyles.bold,
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
        ...RoundedFontStyles.bold,
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
        ...RoundedFontStyles.bold,
        fontSize: DEFAULT_NAVBAR_FONT_SIZE,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    titleFont_2024: {
      color: colors2024?.['neutral-title-1'],
      ...RoundedFontStyles.bold,
      fontSize: 20,
    },
  };
}
