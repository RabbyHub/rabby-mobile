import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AppColorsVariants } from './theme';

export const ScreenLayouts = {
  headerAreaHeight: 48,
  bottomBarHeight: 84,

  dappWebViewControlHeaderHeight: 44,

  defaultWebViewNavBottomSheetHeight: 52 + 40,
  dappWebViewNavBottomSheetHeight: 342,
  inConnectedDappWebViewNavBottomSheetHeight: 342 /*  - 120 */,
};

export const ScreenColors = {
  homeHeaderBlue: '#434EB9',
};

export const RootNames = {
  StackLogin: 'StackLogin',
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
  /* warning: dev only ------ start */
  ProviderControllerTester: 'ProviderControllerTester',
  /* warning: dev only ------ end */

  StackTransaction: 'StackTransaction',
  History: 'History',

  AccountTransaction: 'AccountTransaction',
  MyBundle: 'MyBundle',

  StackAddress: 'StackAddress',
  CurrentAddress: 'CurrentAddress',
  ImportNewAddress: 'ImportNewAddress',
  ImportSuccess: 'ImportSuccess',
  ImportWatchAddress: 'ImportWatchAddress',
  AddressDetail: 'AddressDetail',
  NftDetail: 'NftDetail',
} as const;

export type AppRootName = keyof typeof RootNames;

export const getRootSpecConfig = (colors: AppColorsVariants) => {
  return {
    Home: {
      statusBarStyle: 'dark-content',
      statusbarBackgroundColor: colors['neutral-bg-1'],
    },
    ImportWatchAddress: {
      statusBarStyle: 'light-content',
      statusbarBackgroundColor: colors['blue-default'],
    },
    ImportSuccess: {
      statusBarStyle: 'light-content',
      statusbarBackgroundColor: colors['blue-default'],
    },
  } as {
    [P in AppRootName]?: {
      statusBarStyle?: 'light-content' | 'dark-content';
      statusbarBackgroundColor?: string;
    };
  };
};

export const NavigationHeadersPresets = {
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
};
