import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { E2E_ID } from '@/constant/e2e';
import type { HomeProjectionAvailability } from '@/store/homePortfolio/model';
import { MultiChart } from './CurveChart';

let mockStartupReady = true;
let mockBalanceAvailability: HomeProjectionAvailability = 'ready';
let mockTotalBalance = 1234;
let mockCurrency: 'USD' | 'EUR' = 'USD';
const mockTickerMount = jest.fn();
const mockTickerUnmount = jest.fn();
const includingHidden = { includeHiddenElements: true };
const mockLightTheme = {
  isLight: true,
  colors2024: { 'neutral-title-1': '#192945' },
  colors: {},
};
const mockDarkTheme = {
  isLight: false,
  colors2024: { 'neutral-title-1': '#F7FAFC' },
  colors: {},
};
const mockThemeContext = React.createContext(mockLightTheme);

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: require('react-native').View,
    createAnimatedComponent: (component: unknown) => component,
  },
  Easing: {
    inOut: (fn: unknown) => fn,
    out: (fn: unknown) => fn,
    ease: jest.fn(),
    cubic: jest.fn(),
  },
  makeMutable: (value: unknown) => ({ value }),
  useDerivedValue: (derive: () => unknown) => {
    // Preserve the native hook's per-mount SharedValue identity. Derivation is
    // synchronous here; this does not model UI-thread mapper scheduling.
    const value = derive();
    const derived = require('react').useRef({ value });
    derived.current.value = value;
    return derived.current;
  },
  useAnimatedStyle: (derive: () => unknown) => derive(),
  useAnimatedProps: (derive: () => unknown) => derive(),
  withTiming: (value: unknown) => value,
}));
jest.mock('react-native-wagmi-charts', () => ({
  LineChart: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useChart: () => ({ currentIndex: { value: -1 } }),
  },
}));
jest.mock('d3-shape', () => ({ curveCatmullRom: jest.fn() }));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: require('react-native').View,
  Path: require('react-native').View,
}));
jest.mock('@rneui/base', () => ({
  Skeleton: require('react-native').View,
}));
jest.mock('@/assets2024/icons/home/IconSmallWalletCC.svg', () => ({
  __esModule: true,
  default: require('react-native').View,
}));
jest.mock('@/assets2024/icons/home/IconSmallArrowCC.svg', () => ({
  __esModule: true,
  default: require('react-native').View,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (theme: object) => object }) => {
    const ReactModule = require('react');
    const theme = ReactModule.useContext(mockThemeContext);
    const styles = ReactModule.useMemo(
      () => getStyle(theme),
      [getStyle, theme],
    );
    return { ...theme, styles };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ currency: mockCurrency }),
}));
jest.mock('@/utils/currency', () => ({
  formatSmallCurrencyValueParts: (
    value: number,
    { currency }: { currency: string },
  ) => ({
    text: `${currency === 'EUR' ? '€' : '$'}${value}`,
  }),
  formatCurrencyValueParts: (
    value: number,
    { currency }: { currency: string },
  ) => ({
    text: `${currency === 'EUR' ? '€' : '$'}${value}`,
  }),
}));
jest.mock('@/hooks/common/delayLikeValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));
jest.mock('@/core/utils/homeStartupReady', () => ({
  useHomeStartupReady: () => mockStartupReady,
}));
jest.mock('@/components/Perf/PerfDetector', () => ({
  useRendererDetect: jest.fn(),
}));
jest.mock('@/store/curve24h', () => ({ refreshDayCurve: jest.fn() }));
jest.mock(
  '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader',
  () => ({ CurveLoader: () => null }),
);
jest.mock(
  '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear',
  () => ({ LoadingLinear: () => null }),
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  AnimateableText: require('react-native').Text,
}));
jest.mock('@/utils/makeTestIDProps', () => ({
  makeTestIDProps: (testID: string) => ({ testID }),
}));
jest.mock('@/components/Animated/TabFocusedTickerText', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: function MockTicker(props: object) {
      ReactModule.useEffect(() => {
        mockTickerMount();
        return () => mockTickerUnmount();
      }, []);
      return ReactModule.createElement(require('react-native').View, {
        ...props,
        testID: 'balance-ticker',
      });
    },
  };
});
jest.mock('@/store/homePortfolio', () => ({
  EMPTY_HOME_CURVE_LIST: [],
  getHomeCurveProjectionList: () => [],
  isHomeProjectionWaitingForValue: jest.requireActual(
    '@/store/homePortfolio/model',
  ).isHomeProjectionWaitingForValue,
  useHomeCurveProjection: (select: (state: object) => unknown) =>
    select({ availability: 'ready' }),
  useHomeAccountProjection: (select: (state: object) => unknown) =>
    select({
      matteredAccountLength: 3,
      isPendingMatteredAccountLength: false,
    }),
  useHomeBalanceProjection: (select: (state: object) => unknown) =>
    select({
      availability: mockBalanceAvailability,
      value: { totalBalance: mockTotalBalance },
    }),
  useHome24hProjection: (select: (state: object) => unknown) =>
    select({
      availability: 'ready',
      value: { rawChange: 0, changePercent: '', isLoss: false },
    }),
}));

// Component contracts only: projection hooks supply inputs and native/chart
// components are boundaries. Native animation cleanup and CPU cost need device
// evidence; these tests prove which subtree remains mounted.
describe('MultiChart balance presentation', () => {
  beforeEach(() => {
    mockStartupReady = true;
    mockBalanceAvailability = 'ready';
    mockTotalBalance = 1234;
    mockCurrency = 'USD';
    mockTickerMount.mockClear();
    mockTickerUnmount.mockClear();
  });

  const tree = (
    props: Partial<React.ComponentProps<typeof MultiChart>> = {},
    theme = mockLightTheme,
  ) => (
    <mockThemeContext.Provider value={theme}>
      <MultiChart tabName="overview" hideType="SHOW" style={{}} {...props} />
    </mockThemeContext.Provider>
  );

  it('keeps ticker inputs stable when an unrelated parent callback changes', () => {
    const firstOnPress = jest.fn();
    const nextOnPress = jest.fn();
    const view = render(tree({ onPressNetWorth: firstOnPress }));
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const initialProps = ticker.props;

    view.rerender(tree({ onPressNetWorth: nextOnPress }));

    // Prove ChartHeader accepted the new prop rather than bailing out above
    // the ticker, then compare the real inputs supplied to the native boundary.
    fireEvent.press(view.getByTestId(E2E_ID.home.portfolioBalanceValue));
    expect(nextOnPress).toHaveBeenCalledTimes(1);
    expect(firstOnPress).not.toHaveBeenCalled();
    expect(view.getByTestId('balance-ticker', includingHidden)).toBe(ticker);
    expect(Object.keys(ticker.props)).toEqual(Object.keys(initialProps));
    for (const [key, value] of Object.entries(initialProps)) {
      expect(ticker.props[key]).toBe(value);
    }
    expect(ticker.props.fontSizeByLength).toEqual({
      maxFontSize: 38,
      minFontSize: 24,
      threshold: 9,
    });
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('updates privacy presentation without replacing the ticker value or sizing options', () => {
    const view = render(tree());
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const initialValue = ticker.props.value;
    const fontSizeByLength = ticker.props.fontSizeByLength;
    const visibleStyle = ticker.props.style;

    view.rerender(tree({ hideType: 'HALF_HIDE' }));
    expect(ticker.props.style).not.toBe(visibleStyle);
    expect(StyleSheet.flatten(ticker.props.style).opacity).toBe(0.2);
    expect(ticker.props.value.value).toBe('$1234');
    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);

    view.rerender(tree({ hideType: 'HIDE' }));
    expect(StyleSheet.flatten(ticker.props.style).opacity).toBeUndefined();
    expect(ticker.props.value.value).toBe('******');
    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);

    view.rerender(tree({ hideType: 'SHOW' }));
    expect(StyleSheet.flatten(ticker.props.style).opacity).toBeUndefined();
    expect(ticker.props.value.value).toBe('$1234');
    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('updates the ticker color on theme changes and then reuses the new style', () => {
    const view = render(tree());
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const lightStyle = ticker.props.style;
    const initialValue = ticker.props.value;
    const fontSizeByLength = ticker.props.fontSizeByLength;
    expect(StyleSheet.flatten(lightStyle).color).toBe('#192945');

    view.rerender(tree({}, mockDarkTheme));
    const darkStyle = ticker.props.style;
    expect(darkStyle).not.toBe(lightStyle);
    expect(StyleSheet.flatten(darkStyle).color).toBe('#F7FAFC');

    view.rerender(tree({ onPressNetWorth: jest.fn() }, mockDarkTheme));
    expect(ticker.props.style).toBe(darkStyle);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);
    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.value.value).toBe('$1234');
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('updates the balance through the existing value while preserving style and sizing inputs', () => {
    const view = render(tree());
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const initialValue = ticker.props.value;
    const initialStyle = ticker.props.style;
    const fontSizeByLength = ticker.props.fontSizeByLength;

    mockTotalBalance = 9876;
    view.rerender(tree());

    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.value.value).toBe('$9876');
    expect(ticker.props.style).toBe(initialStyle);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('updates currency through the existing value without changing ticker style or sizing inputs', () => {
    const view = render(tree());
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const initialValue = ticker.props.value;
    const initialStyle = ticker.props.style;
    const fontSizeByLength = ticker.props.fontSizeByLength;
    expect(initialValue.value).toBe('$1234');

    mockCurrency = 'EUR';
    view.rerender(tree());

    expect(view.getByTestId('balance-ticker', includingHidden)).toBe(ticker);
    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.value.value).toBe('€1234');
    expect(ticker.props.style).toBe(initialStyle);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);

    mockCurrency = 'USD';
    view.rerender(tree());

    expect(ticker.props.value).toBe(initialValue);
    expect(ticker.props.value.value).toBe('$1234');
    expect(ticker.props.style).toBe(initialStyle);
    expect(ticker.props.fontSizeByLength).toBe(fontSizeByLength);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it.each<HomeProjectionAvailability>(['ready', 'partial', 'empty'])(
    'does not retain a hidden balance Skeleton for %s data',
    availability => {
      mockBalanceAvailability = availability;
      const view = render(tree());

      expect(
        view.queryByTestId(
          E2E_ID.home.portfolioBalanceLoading,
          includingHidden,
        ),
      ).toBeNull();
      expect(
        StyleSheet.flatten(
          view.getByTestId(E2E_ID.home.portfolioBalanceValue, includingHidden)
            .props.style,
        ).display,
      ).toBeUndefined();
      expect(
        view.getByTestId('balance-ticker', includingHidden).props.value.value,
      ).toBe('$1234');
    },
  );

  it.each<HomeProjectionAvailability>(['unresolved', 'loading'])(
    'mounts the same loading geometry while balance is %s',
    availability => {
      mockBalanceAvailability = availability;
      const view = render(tree());
      const placeholder = view.getByTestId(E2E_ID.home.portfolioBalanceLoading);

      expect(placeholder.props).toMatchObject({ width: 181, height: 42 });
      expect(StyleSheet.flatten(placeholder.props.style)).toMatchObject({
        borderRadius: 8,
      });
      expect(
        StyleSheet.flatten(
          view.getByTestId(E2E_ID.home.portfolioBalanceValue, includingHidden)
            .props.style,
        ).display,
      ).toBe('none');
      expect(mockTickerMount).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the balance ticker instance and layout through loading and resolution', () => {
    const view = render(tree());
    const balance = view.getByTestId(
      E2E_ID.home.portfolioBalanceValue,
      includingHidden,
    );
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    const balanceStyle = StyleSheet.flatten(balance.props.style);
    const tickerStyle = StyleSheet.flatten(ticker.props.style);

    mockBalanceAvailability = 'loading';
    view.rerender(tree());
    expect(view.getByTestId(E2E_ID.home.portfolioBalanceLoading)).toBeTruthy();
    expect(
      view.getByTestId(E2E_ID.home.portfolioBalanceValue, includingHidden),
    ).toBe(balance);
    expect(view.getByTestId('balance-ticker', includingHidden)).toBe(ticker);

    mockBalanceAvailability = 'ready';
    mockTotalBalance = 9876;
    view.rerender(tree());
    expect(
      view.queryByTestId(E2E_ID.home.portfolioBalanceLoading, includingHidden),
    ).toBeNull();
    expect(
      view.getByTestId(E2E_ID.home.portfolioBalanceValue, includingHidden),
    ).toBe(balance);
    expect(view.getByTestId('balance-ticker', includingHidden)).toBe(ticker);
    expect(StyleSheet.flatten(balance.props.style)).toEqual(balanceStyle);
    expect(StyleSheet.flatten(ticker.props.style)).toEqual(tickerStyle);
    expect(ticker.props.value.value).toBe('$9876');
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });

  it('unmounts the startup placeholder without remounting the balance ticker', () => {
    mockStartupReady = false;
    const view = render(tree());
    const ticker = view.getByTestId('balance-ticker', includingHidden);
    expect(view.getByTestId(E2E_ID.home.portfolioBalanceLoading)).toBeTruthy();

    mockStartupReady = true;
    view.rerender(tree());
    expect(
      view.queryByTestId(E2E_ID.home.portfolioBalanceLoading, includingHidden),
    ).toBeNull();
    expect(view.getByTestId('balance-ticker', includingHidden)).toBe(ticker);
    expect(mockTickerMount).toHaveBeenCalledTimes(1);
    expect(mockTickerUnmount).not.toHaveBeenCalled();
  });
});
