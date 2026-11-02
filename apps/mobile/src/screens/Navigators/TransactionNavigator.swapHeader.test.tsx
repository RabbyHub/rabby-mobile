import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { RootNames } from '@/constant/layout';
import TransactionNavigator from './TransactionNavigator';

type CapturedScreen = {
  name: string;
  options:
    | NativeStackHeaderProps['options']
    | ((context: {
        route: NativeStackHeaderProps['route'];
        navigation: NativeStackHeaderProps['navigation'];
      }) => NativeStackHeaderProps['options']);
};
const mockScreens = new Map<string, CapturedScreen>();

// Capture the real navigator's first screen configuration without mounting the
// business screen. This is a component/config contract, not a native-stack or
// iOS transition test: device coverage must still check the cold-entry arrow.
jest.mock('@/utils/CustomNativeStackNavigator', () => ({
  createCustomNativeStackNavigator: () => ({
    Navigator: ({ children }: React.PropsWithChildren) => children,
    Screen: (props: CapturedScreen) => {
      if (!mockScreens.has(props.name)) {
        mockScreens.set(props.name, props);
      }
      return null;
    },
  }),
}));

jest.mock('react-native-gesture-handler', () => ({}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: true, IS_ANDROID: false }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle?: Function } = {}) => {
    const { ThemeColors, ThemeColors2024 } = require('@/constant/theme');
    const theme = {
      colors: ThemeColors.light,
      colors2024: ThemeColors2024.light,
      isLight: true,
    };
    return { ...theme, styles: getStyle?.(theme) || {} };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: Function) => getStyle,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/navigation', () => ({
  useStackScreenConfig: () => ({
    mergeScreenOptions: (...options: object[]) => Object.assign({}, ...options),
    mergeScreenOptions2024: (options: object[]) =>
      Object.assign({}, ...options),
  }),
  HeaderBackPressable: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'custom-header-back',
    }),
}));
jest.mock('@/components/AccountSwitcher/HeaderAccountSwitcher', () => ({
  HeaderAccountSwitcher: (props: { forScene: string }) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'header-account-switcher',
    }),
}));
jest.mock('@/components/AccountSwitcher/OnScreenHeader', () => ({
  ScreenHeaderAccountSwitcher: () => null,
}));
jest.mock('../Swap/components/Header', () => ({
  SwapHeader: (props: { isForMultipleAddress: boolean }) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'swap-header-actions',
    }),
}));
jest.mock('../Bridge/components/BridgeHeader', () => ({
  BridgeHeader: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'bridge-header-actions',
    }),
}));
jest.mock('@/devtools/regressionScenarios/react', () => ({
  withRegressionScenario: (component: unknown) => component,
}));
jest.mock('@/config/innerDappPreloadStrategy', () => ({
  useInnerDappPreloadStrategy: () => 'screen',
}));

// Screen bodies and unrelated headers must not run effects to supply options.
jest.mock('../Send/Send', () => ({
  __esModule: true,
  default: Object.assign(() => null, { ForMultipleAddress: () => null }),
}));
jest.mock('../SwapBridge', () => ({
  __esModule: true,
  default: Object.assign(() => null, { ForMultipleAddress: () => null }),
}));
jest.mock('../SendNFT/SendNFT', () => () => null);
jest.mock('../Transaction/HistoryDetailScreen', () => ({
  HistoryDetailScreen: () => null,
}));
jest.mock('../Transaction/HistoryLocalDetailScreen', () => ({
  HistoryLocalDetailScreen: () => null,
}));
jest.mock('../Approvals', () => () => null);
jest.mock('../Receive/Receive', () => () => null);
jest.mock('../ConvertDust', () => ({ ConvertDustScreen: () => null }));
jest.mock('../GasAccount', () => ({ GasAccountScreen: () => null }));
jest.mock('../Transaction/MultiAddressHistory', () => ({
  __esModule: true,
  default: Object.assign(() => null, { ForSingleAddress: () => null }),
}));
jest.mock('../GnosisQueue', () => ({ GnosisQueueScreen: () => null }));
jest.mock('../BatchRevoke/BatchRevoke', () => ({
  BatchRevokeScreen: () => null,
}));
jest.mock('../Perps/index', () => ({ PerpsOriginScreen: () => null }));
jest.mock('../PerpsMarketDetail', () => ({
  PerpsMarketDetailScreen: () => null,
}));
jest.mock('../PerpsMarketDetail/components/PerpsMarketDetailHeader', () => ({
  PerpsMarketDetailHeader: () => null,
}));
jest.mock('../PerpsHistory', () => ({ PerpsHistoryScreen: () => null }));
jest.mock('../PerpsProHistory', () => ({ PerpsProHistoryScreen: () => null }));
jest.mock('../PerpsProHistory/components/PerpsProHistoryHeader', () => ({
  PerpsProHistoryHeader: () => null,
}));
jest.mock('../PerpsSearch', () => ({ PerpsSearchScreen: () => null }));
jest.mock('../Lending/components/LendingHistory', () => () => null);
jest.mock('../Lending', () => () => null);
jest.mock('../Lending/components/Header', () => ({
  LendingHistoryHeader: () =>
    require('react').createElement(require('react-native').View, {
      testID: 'lending-history',
    }),
}));
jest.mock('@/assets2024/icons/lending/IconAAVE.svg', () => () => null);
jest.mock('../Prediction', () => () => null);
jest.mock('../InnerDapp/InnerDappPreloadScreens', () => ({
  PredictionScreenWithPreload: () => null,
}));

function getInitialHeader(
  name:
    | typeof RootNames.SwapBridge
    | typeof RootNames.MultiSwapBridge
    | typeof RootNames.Lending,
  activeTab?: 'swap' | 'bridge',
) {
  render(<TransactionNavigator />);
  const descriptor = mockScreens.get(name);
  expect(descriptor).toBeDefined();
  const navigation = {
    setParams: jest.fn(),
    isFocused: () => true,
    addListener: () => () => {},
  } as unknown as NativeStackHeaderProps['navigation'];
  const route = {
    key: `${name}-cold-entry`,
    name,
    params: activeTab ? { activeTab } : undefined,
  };
  const options =
    typeof descriptor!.options === 'function'
      ? descriptor!.options({ route, navigation })
      : descriptor!.options;

  // A later screen effect cannot rescue the first descriptor in this test.
  expect(options.header).toEqual(expect.any(Function));
  const element = options.header!({ route, navigation, options });
  return { element, navigation };
}

describe('SwapBridge initial route header', () => {
  beforeEach(() => {
    mockScreens.clear();
  });

  it.each([
    [RootNames.SwapBridge, false],
    [RootNames.MultiSwapBridge, true],
  ] as const)(
    '%s has the complete Swap header before its screen mounts',
    (name, multi) => {
      const { element, navigation } = getInitialHeader(name);
      const screen = render(<>{element}</>);

      expect(screen.getAllByTestId('custom-header-back')).toHaveLength(1);
      expect(screen.getByText('Swap')).toBeTruthy();
      expect(screen.getByText('Bridge')).toBeTruthy();
      expect(
        screen.getByTestId('swap-header-actions').props.isForMultipleAddress,
      ).toBe(multi);
      expect(screen.queryByTestId('bridge-header-actions')).toBeNull();

      fireEvent.press(screen.getByText('Bridge'));
      expect(navigation.setParams).toHaveBeenCalledWith({
        activeTab: 'bridge',
      });
    },
  );

  it.each([RootNames.SwapBridge, RootNames.MultiSwapBridge] as const)(
    '%s honors an initial Bridge route without an intermediate Swap header',
    name => {
      const { element, navigation } = getInitialHeader(name, 'bridge');
      const screen = render(<>{element}</>);

      expect(screen.getAllByTestId('custom-header-back')).toHaveLength(1);
      expect(screen.getByTestId('bridge-header-actions')).toBeTruthy();
      expect(screen.queryByTestId('swap-header-actions')).toBeNull();
      fireEvent.press(screen.getByText('Swap'));
      expect(navigation.setParams).toHaveBeenCalledWith({ activeTab: 'swap' });
    },
  );
});

describe('Lending initial route header', () => {
  beforeEach(() => {
    mockScreens.clear();
  });

  it('has the complete Aave header before the Lending screen mounts', () => {
    const { element } = getInitialHeader(RootNames.Lending);
    const screen = render(<>{element}</>);

    expect(screen.getByText('Aave')).toBeTruthy();
    expect(screen.queryByText('Lending')).toBeNull();
    expect(screen.getAllByTestId('custom-header-back')).toHaveLength(1);
    expect(screen.getByTestId('header-account-switcher').props.forScene).toBe(
      'Lending',
    );
    expect(screen.getByTestId('lending-history')).toBeTruthy();
  });
});
