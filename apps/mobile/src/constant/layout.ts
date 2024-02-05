import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AppColorsVariants } from './theme';

export const ScreenLayouts = {
  headerAreaHeight: 48,
  bottomBarHeight: 84,

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
  NotFound: 'NotFound',
  StackRoot: 'StackRoot',
  StackBottom: 'StackBottom',
  Home: 'Home',

  Dapps: 'Dapps',
  StackFavoritePopularDapps: 'StackFavoritePopularDapps',
  FavoritePopularDapps: 'FavoritePopularDapps',
  StackSearchDapps: 'StackSearchDapps',
  SearchDapps: 'SearchDapps',

  StackSettings: 'StackSettings',
  Settings: 'Settings',
  GetStarted: 'GetStarted',
  /* warning: dev only ------ start */
  ProviderControllerTester: 'ProviderControllerTester',
  /* warning: dev only ------ end */

  StackTransaction: 'StackTransaction',
  Send: 'Send',
  History: 'History',
  HistoryFilterScam: 'HistoryFilterScam',

  AccountTransaction: 'AccountTransaction',
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  CurrentAddress: 'CurrentAddress',
  ImportNewAddress: 'ImportNewAddress',
  ImportSuccess: 'ImportSuccess',
  ImportWatchAddress: 'ImportWatchAddress',
  AddressDetail: 'AddressDetail',
  NftDetail: 'NftDetail',

  Receive: 'Receive',
} as const;

export type AppRootName = keyof typeof RootNames;

export const getRootSpecConfig = (
  colors: AppColorsVariants,
  options?: {
    isDarkTheme?: boolean;
  },
) => {
  const { isDarkTheme } = options || {};

  const defaultStatusBarStyle = isDarkTheme ? 'light-content' : 'dark-content';

  return {
    Home: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['neutral-bg-1'],
    },
    ImportWatchAddress: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['blue-default'],
    },
    ImportSuccess: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['blue-default'],
    },
    Send: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['neutral-card2'],
    },
    Receive: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['blue-default'],
    },
  } as {
    [P in AppRootName]?: {
      statusBarStyle?: 'light-content' | 'dark-content';
      statusbarBackgroundColor?: string;
    };
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
  };
}
