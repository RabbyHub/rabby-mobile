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
  ImportMoreAddress: 'ImportMoreAddress',
  ImportPrivateKey: 'ImportPrivateKey',
  ImportMnemonic: 'ImportMnemonic',
  CreateMnemonic: 'CreateMnemonic',
  AddMnemonic: 'AddMnemonic',
  CreateMnemonicBackup: 'CreateMnemonicBackup',
  CreateMnemonicVerify: 'CreateMnemonicVerify',
  Scanner: 'Scanner',
  BackupPrivateKey: 'BackupPrivateKey',
  BackupMnemonic: 'BackupMnemonic',
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
    Unlock: {
      statusBarStyle: 'dark-content',
      statusbarBackgroundColor: colors['neutral-bg1'],
    },
    ImportWatchAddress: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['blue-default'],
    },
    ImportSafeAddress: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['blue-default'],
    },
    ImportSuccess: {
      statusBarStyle: 'light-content',
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
    GnosisTransactionQueue: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['neutral-card2'],
    },
    Approvals: {
      statusBarStyle: defaultStatusBarStyle,
      statusbarBackgroundColor: colors['neutral-card2'],
    },
    GasTopUp: {
      statusBarStyle: 'light-content',
      statusbarBackgroundColor: colors['blue-default'],
    },
    SetPassword: {
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
