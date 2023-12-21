import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const ScreenLayouts = {
  headerAreaHeight: 44,
  bottomBarHeight: 84,

  dappWebViewControlHeaderHeight: 44,

  defaultWebViewNavBottomSheetHeight: 52 + 40,
  dappWebViewNavBottomSheetHeight: 342,
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
  SettingsWebViewTester: 'SettingsWebViewTester',
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
} as const;

export type AppRootName = keyof typeof RootNames;

export const RootSpecConfig: {
  [P in AppRootName]?: {
    statusBarStyle?: 'light-content' | 'dark-content';
    statusbarBackgroundColor?: string;
  };
} = {
  Home: {
    statusbarBackgroundColor: ScreenColors.homeHeaderBlue,
    statusBarStyle: 'light-content',
  },
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
