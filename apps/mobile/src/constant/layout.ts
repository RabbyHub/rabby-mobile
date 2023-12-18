import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const ScreenLayouts = {
  headerAreaHeight: 44,
  bottomBarHeight: 84,
};

export const ScreenColors = {
  homeHeaderBlue: '#434EB9',
};

export const RootNames = {
  Login: 'Login',
  NotFound: 'NotFound',
  StackRoot: 'StackRoot',
  StackBottom: 'StackBottom',
  Home: 'Home',
  Dapps: 'Dapps',
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
