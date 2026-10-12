import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { TabsTopHeader } from './OverviewTopHeader';

// Exercise the real parent responder handler. Native RNGH/RN bubbling and
// Fabric screen retention are separately verified on devices, not by Jest.
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
jest.mock('@/assets2024/icons/home/eye-half-close-cc.svg', () => () => null);
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
  formatSmallCurrencyValueParts: () => ({ text: '$100' }),
}));
jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ currency: 'USD' }),
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
    totalBalance: 100,
  }),
  useHome24hProjection: () => ({
    changeAvailability: 'ready',
    changeData: { changePercent: '', isLoss: false },
    changeActivity: { isActive: false },
  }),
  useHomeRefreshProjection: () => false,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: () => '#123456' });
    return { colors2024, styles: getStyle.getStyles({ colors2024 }) };
  },
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/WebView/LocalWebView/LocalWebView', () => ({
  LocalWebView: () => null,
}));
jest.mock('@/components2024/RotateLoadingCircle', () => () => null);
jest.mock('@/components/Animated/RefreshNudgedTickerText', () => () => null);
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
