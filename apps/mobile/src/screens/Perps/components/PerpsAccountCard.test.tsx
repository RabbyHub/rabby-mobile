import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { fetchPerpsPortfolio } from '@/hooks/perps/usePerpsPortfolioStore';
import {
  fetchSpotMeta,
  fetchStakingSummaryHttp,
} from '@/hooks/perps/usePerpsStore';
import { PerpsAccountCard } from './PerpsAccountCard';

let mockFocused = true;
let mockDepositOpen = false;

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  Easing: { bezier: jest.fn() },
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: () => 0,
  useAnimatedStyle: (factory: () => object) => factory(),
  useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  withTiming: (value: unknown) => value,
}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('@rneui/base', () => ({ Skeleton: require('react-native').View }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/assets/icons/common', () => ({
  RcIconCloseCC: require('react-native').View,
}));
jest.mock(
  '@/assets2024/icons/perps/IconLearnArrow.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/IconHistoryCC.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/IconPortfolioCollapseCC.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/IconPortfolioPlusCC.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/IconPortfolioMinusCC.svg',
  () => require('react-native').View,
);
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (value: unknown) => value,
}));
jest.mock('@/utils/number', () => ({ splitNumberByStep: String }));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ push: jest.fn() }),
}));
jest.mock('@/core/apis', () => ({
  apisPerps: { getHasClosedLearnMoreCard: jest.fn().mockResolvedValue(true) },
}));
jest.mock('../hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [
    { isShowDepositPopup: mockDepositOpen },
    jest.fn(),
  ],
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand').create(() => ({
    currentPerpsAccount: { address: '0x123' },
    localLoadingHistory: [],
  })),
  fetchSpotMeta: jest.fn().mockResolvedValue(undefined),
  fetchStakingSummaryHttp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/hooks/perps/usePerpsAccount', () => ({
  usePerpsAccount: () => ({
    availableBalance: '0',
    accountValue: 0,
    isAvailableBalanceReady: true,
    isUnifiedAccount: false,
  }),
}));
jest.mock('@/hooks/perps/usePerpsPortfolioStore', () => ({
  fetchPerpsPortfolio: jest.fn().mockResolvedValue(undefined),
  usePerpsPortfolio: () => null,
}));
jest.mock('@/hooks/perps/usePerpsPortfolioLiveValue', () => ({
  usePerpsPortfolioLiveValue: () => null,
}));
jest.mock(
  '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation',
  () => ({
    useShowPerpsPortfolioBreakdown: () => ({
      showPortfolioBreakdown: jest.fn(),
    }),
  }),
);
jest.mock(
  '@/screens/PerpsPro/components/common/PerpsProDottedUnderlineText',
  () => ({
    PerpsProDottedUnderlineText: require('react-native').Text,
  }),
);
jest.mock('@/components/Animated/AnimatedTickerText', () => () => null);
jest.mock(
  '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear',
  () => ({ LoadingLinear: () => null }),
);
jest.mock('./PerpsPortfolioChart', () => ({ PerpsPortfolioChart: () => null }));
jest.mock('@/screens/Bridge/components/PendingTx', () => () => null);

describe('PerpsAccountCard retained activity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFocused = true;
    mockDepositOpen = false;
    AppState.currentState = 'active';
  });
  afterEach(() => jest.useRealTimers());

  it('does not poll an unselected preview and resumes the existing cadence after selection', async () => {
    const screen = render(<PerpsAccountCard sceneActive={false} />);
    await act(async () => {});
    act(() => jest.advanceTimersByTime(120_000));
    expect(fetchPerpsPortfolio).not.toHaveBeenCalled();
    expect(fetchSpotMeta).not.toHaveBeenCalled();
    expect(fetchStakingSummaryHttp).not.toHaveBeenCalled();

    screen.rerender(<PerpsAccountCard sceneActive />);
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    expect(fetchSpotMeta).toHaveBeenCalledTimes(1);
    expect(fetchStakingSummaryHttp).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenLastCalledWith('0x123', {
      force: true,
    });
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);

    screen.rerender(<PerpsAccountCard sceneActive={false} />);
    act(() => jest.advanceTimersByTime(120_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);
    screen.rerender(<PerpsAccountCard sceneActive />);
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(3);
  });

  it('cancels a pending popup-close refresh on deactivation', async () => {
    mockDepositOpen = true;
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    mockDepositOpen = false;
    screen.rerender(<PerpsAccountCard />);
    act(() => jest.advanceTimersByTime(1_000));
    screen.rerender(<PerpsAccountCard sceneActive={false} />);
    act(() => jest.advanceTimersByTime(3_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
  });

  it('preserves standalone focus and AppState poll guards', async () => {
    mockFocused = false;
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    expect(fetchPerpsPortfolio).not.toHaveBeenCalled();
    mockFocused = true;
    screen.rerender(<PerpsAccountCard />);
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    AppState.currentState = 'background';
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    AppState.currentState = 'active';
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);
  });
});
