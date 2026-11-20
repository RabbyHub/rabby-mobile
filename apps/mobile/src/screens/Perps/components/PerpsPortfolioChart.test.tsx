import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { PortfolioData } from '@/hooks/perps/perpsPortfolio';
import { PerpsPortfolioChart } from './PerpsPortfolioChart';

const mockProviderRender = jest.fn();
const mockSurfaceRender = jest.fn();
const mockSurfaceMount = jest.fn();
const mockSurfaceUnmount = jest.fn();
const mockWithTiming = jest.fn<number, [number, object]>(value => value);
const mockCursor = {
  currentX: { value: 0 },
  currentY: { value: 0 },
  currentIndex: { value: -1 },
  isActive: { value: false },
};

// Component coverage: the real memoized Chart and period/geometry logic run;
// wagmi/Reanimated are boundary fakes, not native animation or gesture proof.
jest.mock('react-native-wagmi-charts', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  function LineChart(props) {
    mockSurfaceRender(props);
    ReactModule.useEffect(() => {
      mockSurfaceMount();
      return mockSurfaceUnmount;
    }, []);
    return ReactModule.createElement(View, {
      ...props,
      testID: 'chart-surface',
      accessibilityLabel: String(props.width),
    });
  }
  LineChart.Provider = function Provider({ data, children }) {
    mockProviderRender(data);
    return children;
  };
  LineChart.Path = View;
  LineChart.Gradient = () => null;
  LineChart.CursorLine = () => null;
  LineChart.CursorCrosshair = () => null;
  LineChart.useChart = () => mockCursor;
  return { LineChart };
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  Easing: { bezier: jest.fn() },
  useAnimatedProps: (factory: () => object) => factory(),
  useAnimatedStyle: (factory: () => object) => factory(),
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  withTiming: (value: number, config: object) => mockWithTiming(value, config),
}));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').Pressable,
}));
jest.mock('d3-shape', () => ({ curveMonotoneX: jest.fn() }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  AnimateableText: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) =>
    require('react').useMemo(() => {
      const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
      return { colors2024, styles: getStyle({ colors2024 }) };
    }, [getStyle]),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (value: unknown) => value,
}));
jest.mock('@/utils/number', () => ({ splitNumberByStep: String }));

const history = (endValue: string) => ({
  accountValueHistory: [
    [1, '10'],
    [2, endValue],
  ] as [number, string][],
  pnlHistory: [] as [number, string][],
  vlm: '0',
});
const portfolio = (): PortfolioData => ({
  day: history('20'),
  week: history('30'),
  month: history('40'),
  allTime: history('50'),
});
const latestPoints = () => mockProviderRender.mock.calls.at(-1)?.[0];

describe('PerpsPortfolioChart memo and period contracts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCursor.currentX.value = 0;
    mockCursor.currentY.value = 0;
    mockCursor.currentIndex.value = -1;
    mockCursor.isActive.value = false;
  });
  afterEach(() => jest.useRealTimers());

  it('skips equal props, but publishes new historical data and empty-state changes', () => {
    const data = portfolio();
    const props = { data, isEmpty: false, expanded: false, width: 300 };
    const screen = render(<PerpsPortfolioChart {...props} />);
    expect(latestPoints()).toEqual([
      { timestamp: 1, value: 10 },
      { timestamp: 2, value: 20 },
    ]);
    const renders = mockProviderRender.mock.calls.length;
    const surfaces = mockSurfaceRender.mock.calls.length;
    screen.rerender(<PerpsPortfolioChart {...props} />);
    expect(mockProviderRender).toHaveBeenCalledTimes(renders);
    expect(mockSurfaceRender).toHaveBeenCalledTimes(surfaces);

    const updated = { ...data, day: history('22') };
    screen.rerender(<PerpsPortfolioChart {...props} data={updated} />);
    expect(latestPoints().at(-1)).toEqual({ timestamp: 2, value: 22 });
    // Historical updates must not remount/restart the mini-chart reveal.
    expect(mockSurfaceMount).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ duration: 1000 }),
    );

    screen.rerender(<PerpsPortfolioChart {...props} isEmpty />);
    expect(latestPoints()).toEqual([
      { timestamp: 0, value: 0 },
      { timestamp: 1, value: 0 },
    ]);
    screen.rerender(<PerpsPortfolioChart {...props} data={null} />);
    expect(latestPoints().map(point => point.value)).toEqual([0, 0]);
  });

  it('keeps local period interactive and selected while width/history update', () => {
    const data = portfolio();
    const props = { data, isEmpty: false, expanded: true, width: 300 };
    const screen = render(<PerpsPortfolioChart {...props} />);
    expect(screen.getByTestId('chart-surface').props.accessibilityLabel).toBe(
      '288',
    );
    fireEvent.press(screen.getByText('1W'));
    expect(latestPoints().at(-1).value).toBe(30);
    const renders = mockProviderRender.mock.calls.length;
    screen.rerender(<PerpsPortfolioChart {...props} />);
    expect(mockProviderRender).toHaveBeenCalledTimes(renders);

    const mounts = mockSurfaceMount.mock.calls.length;
    screen.rerender(<PerpsPortfolioChart {...props} width={340} />);
    expect(screen.getByTestId('chart-surface').props.accessibilityLabel).toBe(
      '328',
    );
    expect(latestPoints().at(-1).value).toBe(30);
    expect(mockSurfaceMount).toHaveBeenCalledTimes(mounts);

    const updated = { ...data, week: history('35') };
    screen.rerender(
      <PerpsPortfolioChart {...props} data={updated} width={340} />,
    );
    expect(latestPoints().at(-1).value).toBe(35);
    expect(mockSurfaceMount).toHaveBeenCalledTimes(mounts);
    // A deliberate period change still remounts the reveal body.
    fireEvent.press(screen.getByText('1M'));
    expect(latestPoints().at(-1).value).toBe(40);
    expect(mockSurfaceMount).toHaveBeenCalledTimes(mounts + 1);
    expect(mockWithTiming).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ duration: 600 }),
    );
  });

  it('resets the period on a real collapse/expand and cleans up cursor timeout', () => {
    const data = portfolio();
    const props = { data, isEmpty: false, expanded: true, width: 300 };
    const screen = render(<PerpsPortfolioChart {...props} />);
    fireEvent.press(screen.getByText('1W'));
    fireEvent.press(screen.getByTestId('chart-surface'), {
      nativeEvent: { locationX: 294 },
    });
    expect(mockCursor.currentIndex.value).toBe(1);
    expect(mockCursor.isActive.value).toBe(true);
    const pending = jest.getTimerCount();
    expect(pending).toBeGreaterThan(0);

    screen.rerender(<PerpsPortfolioChart {...props} expanded={false} />);
    expect(jest.getTimerCount()).toBeLessThan(pending);
    expect(latestPoints().at(-1).value).toBe(20);
    expect(screen.queryByText('1W')).toBeNull();
    screen.rerender(<PerpsPortfolioChart {...props} />);
    expect(latestPoints().at(-1).value).toBe(20);
    expect(screen.getByText('1D')).toBeTruthy();

    fireEvent.press(screen.getByTestId('chart-surface'), {
      nativeEvent: { locationX: 6 },
    });
    expect(mockCursor.currentIndex.value).toBe(0);
    act(() => jest.advanceTimersByTime(2000));
    expect(mockCursor.isActive.value).toBe(false);
    expect(mockCursor.currentIndex.value).toBe(-1);
    screen.unmount();
    expect(mockSurfaceUnmount).toHaveBeenCalledTimes(
      mockSurfaceMount.mock.calls.length,
    );
  });
});
