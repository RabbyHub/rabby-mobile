import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { AppColorsVariants } from './theme';

export const ScreenLayouts = {
  headerAreaHeight: 48,
  bottomBarHeight: 84,
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
      statusBarStyle: 'light-content',
      statusbarBackgroundColor: colors['neutral-bg-1'],
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
