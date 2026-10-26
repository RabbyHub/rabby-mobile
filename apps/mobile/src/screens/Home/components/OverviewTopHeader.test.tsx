import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { TabsTopHeader } from './OverviewTopHeader';

type TickerProps = React.ComponentProps<
  typeof import('@/components/Animated/RefreshNudgedTickerText').default
>;

const mockTickerRender = jest.fn<void, [TickerProps]>();
let mockTotalBalance = 100;
let mockCurrency = 'USD';
let mockRefreshing = false;
let mockChangePercent = '';
let mockThemeColor = '#123456';

// Exercise the real parent responder handler. Native RNGH/RN bubbling and
// Fabric screen retention are separately verified on devices, not by Jest.
// Ticker assertions cover the caller's memoized prop boundary, not native
// Reanimated updates or render/commit performance.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  Extrapolate: { CLAMP: 'clamp' },
  interpolate: () => 0,
  useAnimatedStyle: (callback: () => object) => callback(),
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
}));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/assets2024/icons/common/IconSetting.svg', () => () => null);
jest.mock('@/assets2024/icons/home/eye-cc.svg', () => () => null);
jest.mock('@/assets2024/icons/home/eye-close-cc.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/icon-switch-mode.svg', () => () => null);
jest.mock('@/core/native/utils', () => ({ IS_ANDROID: true }));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({
    navigation: { navigateDeprecated: jest.fn() },
  }),
}));
jest.mock('@/constant/layout', () => ({ RootNames: {} }));
jest.mock('@/hooks/version', () => ({
  useUpgradeInfo: () => ({ remoteVersion: { couldUpgrade: false } }),
}));
jest.mock('@/utils/analytics', () => ({ matomoRequestEvent: jest.fn() }));
jest.mock('@/utils/currency', () => ({
  formatSmallCurrencyValueParts: (
    value: number,
    { currency }: { currency: string },
  ) => ({ text: `${currency} ${value}` }),
}));
jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ currency: mockCurrency }),
}));
jest.mock('../hooks/useHideBalance', () => ({
  useHideBalance: () => ['SHOW', jest.fn()],
}));
jest.mock('../hooks/useHomeDrawerAnimate', () => ({
  useHomeDrawerOpacityStyle: () => ({
    opacityStyle: {},
    pullPercent: { value: 0 },
  }),
}));
jest.mock('../hooks/useReportTokenTabView', () => ({
  useReportTokenTabView: jest.fn(),
}));
jest.mock('@/hooks/reanimated', () => ({
  useValueFromSharedValue: (value: { value: unknown }) => value.value,
}));
jest.mock('@/hooks/navigation', () => ({
  apisHomeTabIndex: {
    svTabName: { value: 'overview' },
    svTabIndexDecimal: { value: 0 },
    setTabIndex: jest.fn(),
  },
  HomeTabName: { overview: 'overview', token: 'token' },
}));
jest.mock('@/store/tokens', () => ({
  __esModule: true,
  default: (selector: (state: object) => unknown) =>
    selector({ tokenDisplayMode: 'byAddress', setTokenDisplayMode: jest.fn() }),
}));
jest.mock('@/store/homePortfolio', () => ({
  isHomeProjectionWaitingForValue: () => false,
  useHomeBalanceProjection: () => ({
    balanceAvailability: 'ready',
    totalBalance: mockTotalBalance,
  }),
  useHome24hProjection: () => ({
    changeAvailability: 'ready',
    changeData: { changePercent: mockChangePercent, isLoss: false },
    changeActivity: { isActive: false },
  }),
  useHomeRefreshProjection: () => mockRefreshing,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    // The real theme owner preserves styles until its theme/inset inputs change.
    return require('react').useMemo(() => {
      const color = mockThemeColor;
      const colors2024 = new Proxy({}, { get: () => color });
      return { colors2024, styles: getStyle.getStyles({ colors2024 }) };
    }, [getStyle, mockThemeColor]);
  },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/WebView/LocalWebView/LocalWebView', () => ({
  LocalWebView: () => null,
}));
jest.mock('@/components2024/RotateLoadingCircle', () => () => null);
jest.mock('@/components/Animated/RefreshNudgedTickerText', () => ({
  __esModule: true,
  default: require('react').memo(function MockRefreshTicker(
    props: TickerProps,
  ) {
    mockTickerRender(props);
    return require('react').createElement(require('react-native').View, {
      testID: 'header-ticker',
    });
  }),
}));
jest.mock('../MultiHeaderRightHistory', () => ({
  MultiHeaderRightHistory: () => null,
}));
jest.mock('@/components/Screenshot/FeedbackHistory/HeaderEntry', () => ({
  FeedbackHistoryHeaderEntry: () => null,
}));
jest.mock('@/screens/Address/AddressListScreenButton', () => ({
  AddressListScreenButton: () => null,
}));

function getHeaderArea() {
  return screen.UNSAFE_root.find(
    node =>
      typeof node.props.onPress === 'function' &&
      StyleSheet.flatten(node.props.style)?.justifyContent === 'flex-end',
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  apisHomeTabIndex.svTabName.value = HomeTabName.overview;
  mockTotalBalance = 100;
  mockCurrency = 'USD';
  mockRefreshing = false;
  mockChangePercent = '';
  mockThemeColor = '#123456';
});

it('does not switch Home to assets when a nested button press bubbles', () => {
  render(<TabsTopHeader />);
  const header = getHeaderArea();
  expect(header).toBeDefined();
  header.props.onPress({ target: 202, currentTarget: 101 });
  expect(apisHomeTabIndex.setTabIndex).not.toHaveBeenCalled();
});

it('still switches to assets when the empty header area itself is pressed', () => {
  render(<TabsTopHeader />);
  getHeaderArea().props.onPress({ target: 101, currentTarget: 101 });
  expect(apisHomeTabIndex.setTabIndex).toHaveBeenCalledTimes(1);
  expect(apisHomeTabIndex.setTabIndex).toHaveBeenCalledWith(1, true);
});

it('does not rerender the ticker for unrelated refresh and change updates', () => {
  const { rerender } = render(<TabsTopHeader />);
  const ticker = screen.getByTestId('header-ticker');
  const initialProps = mockTickerRender.mock.calls[0][0];
  expect(initialProps.fontSizeByLength).toEqual({
    maxFontSize: 18,
    minFontSize: 18,
    threshold: 16,
  });

  mockRefreshing = true;
  mockChangePercent = '1.2%';
  rerender(<TabsTopHeader />);
  expect(screen.getByText('+1.2%')).toBeTruthy();

  mockRefreshing = false;
  mockChangePercent = '2.4%';
  rerender(<TabsTopHeader />);
  expect(screen.getByText('+2.4%')).toBeTruthy();
  expect(screen.getByTestId('header-ticker')).toBe(ticker);
  expect(mockTickerRender).toHaveBeenCalledTimes(1);
});

it('keeps balance and currency live through the same shared value', () => {
  const { rerender } = render(<TabsTopHeader />);
  const initialProps = mockTickerRender.mock.calls[0][0];
  const value = initialProps.value as { value: string };
  expect(value.value).toBe('USD 100');

  mockTotalBalance = 9876.54;
  rerender(<TabsTopHeader />);
  expect(value.value).toBe('USD 9876.54');

  mockCurrency = 'EUR';
  rerender(<TabsTopHeader />);
  expect(value.value).toBe('EUR 9876.54');

  mockTotalBalance = 0;
  rerender(<TabsTopHeader />);
  expect(value.value).toBe('EUR 0');
  expect(mockTickerRender).toHaveBeenCalledTimes(1);
});

it('updates the ticker style when the theme changes without replacing its value', () => {
  const { rerender } = render(<TabsTopHeader />);
  const initialProps = mockTickerRender.mock.calls[0][0];

  mockThemeColor = '#abcdef';
  rerender(<TabsTopHeader />);

  expect(mockTickerRender).toHaveBeenCalledTimes(2);
  const nextProps = mockTickerRender.mock.calls[1][0];
  expect(nextProps.value).toBe(initialProps.value);
  expect(nextProps.fontSizeByLength).toBe(initialProps.fontSizeByLength);
  expect(nextProps.style).not.toBe(initialProps.style);
  expect(StyleSheet.flatten(nextProps.style)?.color).toBe('#abcdef');
});
