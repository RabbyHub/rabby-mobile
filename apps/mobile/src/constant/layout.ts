import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AppColorsVariants } from './theme';

export const ModalLayouts = {
  defaultHeightPercentText: '80%' as `${number}%`,
  titleTopOffset: 8,
};

export const ScreenLayouts = {
  headerAreaHeight: 56,
  bottomBarHeight: 60,

  dappWebViewControlHeaderHeight: 44,

  defaultWebViewNavBottomSheetHeight: 52 + 40,
  dappWebViewNavBottomSheetHeight: 302,
  inConnectedDappWebViewNavBottomSheetHeight: 302 /*  - 120 */,
};

export const ScreenColors = {
  homeHeaderBlue: '#434EB9',
};

export const RootNames = {
  StackLogin: 'StackLogin',
  StackGetStarted: 'StackGetStarted',

  StackRoot: 'StackRoot',
  NotFound: 'NotFound',
  Unlock: 'Unlock',

  StackBottom: 'StackBottom',
  Home: 'Home',
  Points: 'Points',

  Dapps: 'Dapps',
  StackFavoritePopularDapps: 'StackFavoritePopularDapps',
  FavoritePopularDapps: 'FavoritePopularDapps',
  StackSearchDapps: 'StackSearchDapps',
  SearchDapps: 'SearchDapps',

  StackSettings: 'StackSettings',
  Settings: 'Settings',
  SetPassword: 'SetPassword',
  GetStarted: 'GetStarted',
  /* warning: dev only ------ start */
  ProviderControllerTester: 'ProviderControllerTester',
  /* warning: dev only ------ end */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  Receive: 'Receive',
  Swap: 'Swap',
  GnosisTransactionQueue: 'GnosisTransactionQueue',
  Approvals: 'Approvals',
  GasTopUp: 'GasTopUp',
  History: 'History',
  HistoryFilterScam: 'HistoryFilterScam',

  AccountTransaction: 'AccountTransaction',
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  CurrentAddress: 'CurrentAddress',
  ImportNewAddress: 'ImportNewAddress',
  ImportSuccess: 'ImportSuccess',
  ImportWatchAddress: 'ImportWatchAddress',
  ImportSafeAddress: 'ImportSafeAddress',
  AddressDetail: 'AddressDetail',
  NftDetail: 'NftDetail',

  ImportLedger: 'ImportLedger',
  ImportHardware: 'ImportHardware',
} as const;

export type AppRootName = keyof typeof RootNames;

export type ScreenStatusBarConf = {
  statusBarStyle?: 'light-content' | 'dark-content';
  androidStatusBarBg?: string;
  androidTranslucent?: boolean;
};

export const getRootSpecConfig = (
  colors: AppColorsVariants,
  options?: {
    isDarkTheme?: boolean;
  },
) => {
  const { isDarkTheme } = options || {};

  const adaptiveStatusBarStyle = isDarkTheme ? 'light-content' : 'dark-content';

  const bg1DefaultConf = {
    statusBarStyle: adaptiveStatusBarStyle,
    androidStatusBarBg: colors['neutral-bg1'],
  };

  const bg2DefaultConf = {
    statusBarStyle: adaptiveStatusBarStyle,
    androidStatusBarBg: colors['neutral-bg2'],
  };

  const card2DefaultConf = {
    statusBarStyle: adaptiveStatusBarStyle,
    androidStatusBarBg: colors['neutral-card2'],
  };

  const blueDefaultConf = {
    statusBarStyle: adaptiveStatusBarStyle,
    androidStatusBarBg: colors['blue-default'],
  };

  const blueLightConf = {
    statusBarStyle: 'light-content',
    androidStatusBarBg: colors['blue-default'],
  };

  return {
    '@default': !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    '@bg1default': { ...bg1DefaultConf },
    '@openeddapp': {
      statusBarStyle: 'light-content',
      androidStatusBarBg: 'rgba(0, 0, 0, 1)',
    },
    Home: bg1DefaultConf,
    Unlock: bg1DefaultConf,

    // Dapps: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    // SearchDapps: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

    // History: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,

    // ImportNewAddress: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    // CurrentAddress: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    ImportWatchAddress: blueDefaultConf,
    ImportSafeAddress: blueDefaultConf,
    ImportSuccess: blueLightConf,

    // Send: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    // Swap: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
    Receive: blueLightConf,

    GnosisTransactionQueue: card2DefaultConf,

    Approvals: bg2DefaultConf,
    GasTopUp: blueLightConf,

    SetPassword: blueLightConf,
    // Settings: !isDarkTheme ? card2DefaultConf : bg1DefaultConf,
  } as {
    '@default': ScreenStatusBarConf;
    '@bg1default': ScreenStatusBarConf;
    '@openeddapp': ScreenStatusBarConf;
  } & {
    [P in AppRootName]: ScreenStatusBarConf;
  };
};

export function makeHeadersPresets({
  colors,
}: { colors?: AppColorsVariants } = {}) {
  return {
    onlyTitle: {
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTransparent: true,
      headerBackVisible: false,
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 17,
      },
    } as NativeStackNavigationOptions,
    withBgCard2: {
      headerStyle: {
        backgroundColor: colors?.['neutral-card2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        fontWeight: '500' as const,
        fontSize: 20,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
    withBg2: {
      headerStyle: {
        backgroundColor: colors?.['neutral-bg2'],
      },
      headerTitleStyle: {
        color: colors?.['neutral-title-1'],
        fontWeight: '500' as const,
        fontSize: 20,
      },
      headerTintColor: colors?.['neutral-title-1'],
    },
  };
}
