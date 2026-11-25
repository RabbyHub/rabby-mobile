import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { fetchPerpsPortfolio } from '@/hooks/perps/usePerpsPortfolioStore';
import type { PortfolioEntry } from '@/hooks/perps/usePerpsPortfolioStore';
import type { PortfolioData } from '@/hooks/perps/perpsPortfolio';
import {
  fetchSpotMeta,
  fetchStakingSummaryHttp,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { PerpsAccountCard } from './PerpsAccountCard';

type PopupState = {
  isShowDepositPopup: boolean;
  isShowWithdrawPopup: boolean;
  isShowSwapPopup: boolean;
};
type Fixture = {
  focused: boolean;
  popup: PopupState;
  liveValue: number | null;
  portfolioMap: Record<string, PortfolioEntry>;
  account: {
    availableBalance: number;
    accountValue: number;
    isAvailableBalanceReady: boolean;
    isUnifiedAccount: boolean;
  };
};
const initialFixture = (): Fixture => ({
  focused: true,
  popup: {
    isShowDepositPopup: false,
    isShowWithdrawPopup: false,
    isShowSwapPopup: false,
  },
  liveValue: null,
  portfolioMap: {},
  account: {
    availableBalance: 0,
    accountValue: 0,
    isAvailableBalanceReady: true,
    isUnifiedAccount: false,
  },
});
const mockFixture = create<Fixture>(initialFixture);
const mockParentRender = jest.fn();
const mockChartRender = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
const mockBreakdownMount = jest.fn();
const mockBreakdownUnmount = jest.fn();
const mockShowBreakdown = jest.fn();
const mockNavigate = jest.fn();
const mockSetPopup = (
  update: PopupState | ((prev: PopupState) => PopupState),
) =>
  mockFixture.setState(state => ({
    popup: typeof update === 'function' ? update(state.popup) : update,
  }));

// Component tests, not integration/native animation evidence. Real Zustand
// subscriptions notify PV/focus/popup consumers without rerendering Card by hand.
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFixture(state => state.focused),
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
  useDerivedValue: (factory: () => unknown) => {
    const shared = require('react').useRef({ value: factory() }).current;
    shared.value = factory();
    return shared;
  },
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  withTiming: (value: unknown) => value,
}));
jest.mock('react-native-linear-gradient', () => {
  return function Gradient(props) {
    return require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'card-gradient',
    });
  };
});
jest.mock('@rneui/base', () => ({
  Skeleton: props =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: `skeleton-${props.width}`,
    }),
}));
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
  () => props =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'history-icon',
    }),
);
jest.mock(
  '@/assets2024/icons/perps/IconPortfolioCollapseCC.svg',
  () => props =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'collapse-icon',
    }),
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
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) =>
    require('react').useMemo(() => {
      const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
      return {
        colors2024,
        isLight: true,
        styles: getStyle({ colors2024, isLight: true }),
      };
    }, [getStyle]),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (value: unknown) => value,
}));
jest.mock('@/utils/number', () => ({ splitNumberByStep: String }));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ push: mockNavigate }),
}));
jest.mock('@/core/apis', () => ({
  apisPerps: { getHasClosedLearnMoreCard: jest.fn().mockResolvedValue(true) },
}));
jest.mock('../hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [mockFixture(state => state.popup), mockSetPopup],
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
  usePerpsAccount: () => {
    mockParentRender();
    return mockFixture(state => state.account);
  },
}));
jest.mock('@/hooks/perps/usePerpsPortfolioStore', () => ({
  fetchPerpsPortfolio: jest.fn().mockResolvedValue(undefined),
  usePerpsPortfolio: (address?: string) =>
    mockFixture(
      state => state.portfolioMap[address?.toLowerCase() || ''] ?? null,
    ),
}));
jest.mock('@/hooks/perps/usePerpsPortfolioLiveValue', () => ({
  usePerpsPortfolioLiveValue: () => mockFixture(state => state.liveValue),
}));
jest.mock(
  '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation',
  () => ({
    useShowPerpsPortfolioBreakdown: () => {
      require('react').useEffect(() => {
        mockBreakdownMount();
        return mockBreakdownUnmount;
      }, []);
      return { showPortfolioBreakdown: mockShowBreakdown };
    },
  }),
);
jest.mock(
  '@/screens/PerpsPro/components/common/PerpsProDottedUnderlineText',
  () => ({
    PerpsProDottedUnderlineText: props =>
      require('react').createElement(require('react-native').Text, {
        ...props,
        testID: 'portfolio-breakdown',
      }),
  }),
);
jest.mock(
  '@/components/Animated/AnimatedTickerText',
  () =>
    ({ value }) =>
      require('react').createElement(
        require('react-native').Text,
        { testID: 'portfolio-ticker' },
        value.value,
      ),
);
jest.mock(
  '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear',
  () => ({ LoadingLinear: () => null }),
);
jest.mock('./PerpsPortfolioChart', () => ({
  // NOT memoized: a PV update reaching Card must expose itself in this sibling.
  // The real Chart memo contract is covered in PerpsPortfolioChart.test.tsx.
  PerpsPortfolioChart: function Chart(props) {
    const ReactModule = require('react');
    const {
      View,
      Pressable: ChartPressable,
      Text: ChartText,
    } = require('react-native');
    const [selection, setSelection] = ReactModule.useState(0);
    const kind = props.expanded ? 'expanded' : 'mini';
    mockChartRender(props);
    ReactModule.useEffect(() => {
      mockChartMount(kind);
      return () => mockChartUnmount(kind);
    }, [kind]);
    return ReactModule.createElement(
      View,
      { testID: `chart-${kind}`, accessibilityLabel: String(props.width) },
      ReactModule.createElement(
        ChartPressable,
        {
          onPress: () => setSelection(value => value + 1),
          testID: `chart-period-${kind}`,
        },
        ReactModule.createElement(ChartText, null, String(selection)),
      ),
    );
  },
}));
jest.mock('@/screens/Bridge/components/PendingTx', () => () => null);

function portfolio(value = '100', pnl = '10'): PortfolioData {
  return {
    day: {
      accountValueHistory: [
        [1, '90'],
        [2, value],
      ],
      pnlHistory: [
        [1, '0'],
        [2, pnl],
      ],
      vlm: '0',
    },
  };
}
function publishPortfolio(data: PortfolioData | null, address = '0x123') {
  mockFixture.setState(state => ({
    portfolioMap: {
      ...state.portfolioMap,
      [address]: { data, status: 'ready', updatedAt: 1 },
    },
  }));
}
function expand(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId('chart-mini'));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockFixture.setState(initialFixture(), true);
  perpsStore.setState({
    currentPerpsAccount: { address: '0x123' } as never,
    localLoadingHistory: [],
  });
  AppState.currentState = 'active';
});
afterEach(() => jest.useRealTimers());

describe('PerpsAccountCard retained activity', () => {
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

  it('cancels a pending subscribed popup-close refresh on deactivation', async () => {
    mockSetPopup({ ...mockFixture.getState().popup, isShowDepositPopup: true });
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    act(() =>
      mockSetPopup({
        ...mockFixture.getState().popup,
        isShowDepositPopup: false,
      }),
    );
    act(() => jest.advanceTimersByTime(1_000));
    screen.rerender(<PerpsAccountCard sceneActive={false} />);
    act(() => jest.advanceTimersByTime(3_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
  });

  it('refreshes three seconds after a subscribed funding popup closes', async () => {
    render(<PerpsAccountCard />);
    await act(async () => {});
    act(() =>
      mockSetPopup({
        ...mockFixture.getState().popup,
        isShowWithdrawPopup: true,
      }),
    );
    act(() =>
      mockSetPopup({
        ...mockFixture.getState().popup,
        isShowWithdrawPopup: false,
      }),
    );
    act(() => jest.advanceTimersByTime(2_999));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);
    expect(fetchPerpsPortfolio).toHaveBeenLastCalledWith('0x123', {
      force: true,
    });
  });

  it('preserves subscribed focus and AppState poll guards through Card memo', async () => {
    mockFixture.setState({ focused: false });
    render(<PerpsAccountCard />);
    await act(async () => {});
    expect(fetchPerpsPortfolio).not.toHaveBeenCalled();
    act(() => mockFixture.setState({ focused: true }));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    AppState.currentState = 'background';
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(1);
    AppState.currentState = 'active';
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);
    act(() => mockFixture.setState({ focused: false }));
    act(() => jest.advanceTimersByTime(60_000));
    expect(fetchPerpsPortfolio).toHaveBeenCalledTimes(2);
  });
});

describe('PerpsAccountCard live value leaf', () => {
  it('updates live PV and breakdown without rendering the card or chart siblings', async () => {
    publishPortfolio(portfolio());
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    const parentRenders = mockParentRender.mock.calls.length;
    const chartRenders = mockChartRender.mock.calls.length;
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('+11.11%(+$10.00)')).toBeTruthy();
    for (const liveValue of [111.12, 222.23, 333.34]) {
      act(() => mockFixture.setState({ liveValue }));
      expect(screen.getByText(`$${liveValue.toFixed(2)}`)).toBeTruthy();
      fireEvent.press(screen.getByTestId('portfolio-breakdown'));
      expect(mockShowBreakdown).toHaveBeenLastCalledWith(liveValue);
    }
    expect(mockParentRender).toHaveBeenCalledTimes(parentRenders);
    expect(mockChartRender).toHaveBeenCalledTimes(chartRenders);
    expect(screen.getByText('+11.11%(+$10.00)')).toBeTruthy();
    expect(mockBreakdownMount).toHaveBeenCalledTimes(1);
    expect(mockBreakdownUnmount).not.toHaveBeenCalled();
    screen.rerender(<PerpsAccountCard />);
    expect(mockParentRender).toHaveBeenCalledTimes(parentRenders);
    fireEvent.press(screen.getByTestId('history-icon'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps null fallback distinct from real live zero and consumes fresh REST history', async () => {
    publishPortfolio(portfolio());
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    fireEvent.press(screen.getByTestId('portfolio-breakdown'));
    expect(mockShowBreakdown).toHaveBeenLastCalledWith(100);
    act(() => mockFixture.setState({ liveValue: 0 }));
    expect(screen.getByTestId('portfolio-ticker').props.children).toBe('$0.00');
    expect(screen.queryByTestId('portfolio-breakdown')).toBeNull();
    act(() => mockFixture.setState({ liveValue: 250 }));
    const next = portfolio('200', '20');
    act(() => publishPortfolio(next));
    expect(screen.getByText('$250.00')).toBeTruthy();
    expect(screen.getByText('+11.11%(+$20.00)')).toBeTruthy();
    expect(mockChartRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: next }),
    );
    act(() => mockFixture.setState({ liveValue: null }));
    expect(screen.getByText('$200.00')).toBeTruthy();
    fireEvent.press(screen.getByTestId('portfolio-breakdown'));
    expect(mockShowBreakdown).toHaveBeenLastCalledWith(200);
  });

  it('retains REST loading/zero/data gates and one leaf instance independently of live readiness', async () => {
    mockFixture.setState({ liveValue: 25 });
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    expect(screen.getByTestId('skeleton-132')).toBeTruthy();
    expect(screen.queryByTestId('portfolio-ticker')).toBeNull();
    // Existing behavior: label eligibility uses PV independently of REST state.
    fireEvent.press(screen.getByTestId('portfolio-breakdown'));
    expect(mockShowBreakdown).toHaveBeenLastCalledWith(25);
    act(() =>
      publishPortfolio({
        day: {
          accountValueHistory: [[1, '0']],
          pnlHistory: [[1, '0']],
          vlm: '0',
        },
      }),
    );
    expect(screen.queryByTestId('skeleton-132')).toBeNull();
    expect(screen.queryByTestId('portfolio-ticker')).toBeNull();
    expect(screen.getByText('+0%(+$0.00)')).toBeTruthy();
    expect(screen.getByTestId('portfolio-breakdown')).toBeTruthy();
    act(() => publishPortfolio(portfolio()));
    expect(screen.getByText('$25.00')).toBeTruthy();
    expect(mockBreakdownMount).toHaveBeenCalledTimes(1);
    expect(mockBreakdownUnmount).not.toHaveBeenCalled();
    screen.unmount();
    expect(mockBreakdownUnmount).toHaveBeenCalledTimes(1);
  });

  it('keeps expanded chart state for the collapse delay and cancels unmount on a quick reopen', async () => {
    publishPortfolio(portfolio());
    const screen = render(<PerpsAccountCard />);
    await act(async () => {});
    fireEvent(screen.getByTestId('card-gradient'), 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });
    expand(screen);
    expect(screen.getByTestId('chart-expanded').props.accessibilityLabel).toBe(
      '268',
    );
    fireEvent.press(screen.getByTestId('chart-period-expanded'));
    expect(
      screen
        .getByTestId('chart-period-expanded')
        .findByType(require('react-native').Text).props.children,
    ).toBe('1');
    fireEvent(screen.getByTestId('card-gradient'), 'layout', {
      nativeEvent: { layout: { width: 340 } },
    });
    expect(screen.getByTestId('chart-expanded').props.accessibilityLabel).toBe(
      '308',
    );
    fireEvent.press(screen.getByTestId('collapse-icon'));
    act(() => jest.advanceTimersByTime(299));
    expect(screen.getByTestId('chart-expanded')).toBeTruthy();
    expand(screen);
    act(() => jest.advanceTimersByTime(1));
    expect(
      screen
        .getByTestId('chart-period-expanded')
        .findByType(require('react-native').Text).props.children,
    ).toBe('1');
    expect(mockChartUnmount).not.toHaveBeenCalledWith('expanded');
    fireEvent.press(screen.getByTestId('collapse-icon'));
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByTestId('chart-expanded')).toBeNull();
    expect(mockChartUnmount).toHaveBeenCalledWith('expanded');
    expand(screen);
    expect(
      screen
        .getByTestId('chart-period-expanded')
        .findByType(require('react-native').Text).props.children,
    ).toBe('0');
    expect(
      mockChartMount.mock.calls.filter(([kind]) => kind === 'expanded'),
    ).toHaveLength(2);
  });
});
