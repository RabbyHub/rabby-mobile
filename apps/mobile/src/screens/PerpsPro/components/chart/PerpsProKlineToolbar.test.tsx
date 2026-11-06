import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { PERPS_PRO_CANDLE_INTERVAL_OPTIONS } from '@/hooks/perps/candles/interval';

import { PerpsProKlineToolbar } from './PerpsProKlineToolbar';

type Point = { x: number; y: number };
const mockScrollTo = jest.fn();
const mockTap: {
  onBegin?: (event: Point) => void;
  onEnd?: (event: Point, success: boolean) => void;
  onFinalize?: () => void;
} = {};
let mockScrollHandlers: {
  onScroll: (event: { contentOffset: Point }) => void;
  onBeginDrag: () => void;
  onEndDrag: () => void;
};

// Exercise our UI-thread callbacks without claiming native gesture arbitration.
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Native: () => {
      const native: Record<string, jest.Mock> = {};
      native.disallowInterruption = jest.fn(() => native);
      native.onFinalize = jest.fn(() => native);
      return native;
    },
    Tap: () => {
      const tap: Record<string, jest.Mock> = {};
      for (const name of [
        'enabled',
        'maxDistance',
        'cancelsTouchesInView',
        'simultaneousWithExternalGesture',
      ]) {
        tap[name] = jest.fn(() => tap);
      }
      for (const name of ['onBegin', 'onEnd', 'onFinalize'] as const) {
        tap[name] = jest.fn(callback => {
          mockTap[name] = callback;
          return tap;
        });
      }
      return tap;
    },
  },
}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: { ScrollView: require('react-native').ScrollView },
    runOnUI: (callback: unknown) => callback,
    runOnJS: (callback: unknown) => callback,
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedRef: () => ReactModule.useRef(null),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedScrollHandler: (handlers: typeof mockScrollHandlers) => {
      mockScrollHandlers = handlers;
      return jest.fn();
    },
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

describe('PerpsProKlineToolbar', () => {
  beforeEach(() => jest.clearAllMocks());

  const measure = () => {
    const scroll = screen.getByTestId('perps-pro-kline-interval-scroll');
    fireEvent(scroll, 'layout', { nativeEvent: { layout: { width: 240 } } });
    fireEvent(scroll, 'contentSizeChange', 600, 36);
    PERPS_PRO_CANDLE_INTERVAL_OPTIONS.forEach((option, index) => {
      fireEvent(
        screen.getByTestId(`perps-pro-kline-interval-${option.value}`),
        'layout',
        {
          nativeEvent: { layout: { x: index * 50, width: 50 } },
        },
      );
    });
  };

  it('renders the Simple interval set with the design typography', () => {
    const onSelect = jest.fn();
    render(<PerpsProKlineToolbar interval="15m" onSelect={onSelect} />);

    expect(screen.getAllByRole('radio')).toHaveLength(
      PERPS_PRO_CANDLE_INTERVAL_OPTIONS.length,
    );
    ['1m', '4h', '12h', '1D', '3D', '1W', '1M'].forEach(label => {
      expect(screen.getByText(label)).toBeTruthy();
    });
    expect(
      screen.getByTestId('perps-pro-kline-interval-15m').props
        .accessibilityState,
    ).toMatchObject({ checked: true, disabled: false });
    expect(StyleSheet.flatten(screen.getByText('15m').props.style)).toEqual(
      expect.objectContaining({
        color: 'neutral-title-1',
        fontSize: 12,
        fontWeight: '700',
        lineHeight: 16,
      }),
    );
    expect(StyleSheet.flatten(screen.getByText('5m').props.style)).toEqual(
      expect.objectContaining({
        color: 'neutral-secondary',
        fontWeight: '500',
      }),
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-kline-interval-1h').props.style,
      ),
    ).toMatchObject({
      height: 36,
      minWidth: 44,
      paddingHorizontal: 16,
    });
    fireEvent(
      screen.getByTestId('perps-pro-kline-interval-3d'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'activate' },
      },
    );
    expect(onSelect).toHaveBeenCalledWith('3d');
  });

  it('blocks selection while the shared preference is hydrating', () => {
    const onSelect = jest.fn();
    render(
      <PerpsProKlineToolbar disabled interval="15m" onSelect={onSelect} />,
    );

    fireEvent(
      screen.getByTestId('perps-pro-kline-interval-1h'),
      'accessibilityTap',
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('stops at the current offset and selects the recorded tab only on release', () => {
    const onSelect = jest.fn();
    render(<PerpsProKlineToolbar interval="15m" onSelect={onSelect} />);
    measure();
    act(() => mockScrollHandlers.onScroll({ contentOffset: { x: 150, y: 0 } }));
    act(() => mockTap.onBegin?.({ x: 65, y: 18 }));
    // Android can report drag-begin merely because this DOWN stopped a fling.
    act(() => mockScrollHandlers.onBeginDrag());
    expect(mockScrollTo).toHaveBeenLastCalledWith(
      expect.anything(),
      150,
      0,
      false,
    );
    expect(onSelect).not.toHaveBeenCalled();
    act(() => {
      mockTap.onEnd?.({ x: 67, y: 18 }, true);
      mockTap.onFinalize?.();
      mockScrollHandlers.onEndDrag();
    });
    expect(onSelect.mock.calls).toEqual([['1h']]);
  });

  it('does not select after native scrolling, cancellation, or release over another tab', () => {
    const onSelect = jest.fn();
    render(<PerpsProKlineToolbar interval="15m" onSelect={onSelect} />);
    measure();
    act(() => {
      mockTap.onBegin?.({ x: 45, y: 18 });
      mockScrollHandlers.onBeginDrag();
      mockScrollHandlers.onScroll({ contentOffset: { x: 2, y: 0 } });
      mockScrollHandlers.onEndDrag();
      mockTap.onEnd?.({ x: 46, y: 18 }, true);
      mockTap.onFinalize?.();
      mockTap.onBegin?.({ x: 45, y: 18 });
      mockTap.onEnd?.({ x: 45, y: 18 }, false);
      mockTap.onFinalize?.();
      mockTap.onBegin?.({ x: 45, y: 18 });
      mockTap.onEnd?.({ x: 51, y: 18 }, true);
      mockTap.onFinalize?.();
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps visible selections stationary and only reveals a clipped edge', () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <PerpsProKlineToolbar interval="15m" onSelect={onSelect} />,
    );
    measure();
    mockScrollTo.mockClear();
    rerender(<PerpsProKlineToolbar interval="30m" onSelect={onSelect} />);
    expect(mockScrollTo).not.toHaveBeenCalled();
    rerender(<PerpsProKlineToolbar interval="1h" onSelect={onSelect} />);
    expect(mockScrollTo).toHaveBeenLastCalledWith(
      expect.anything(),
      10,
      0,
      false,
    );
    rerender(<PerpsProKlineToolbar interval="1m" onSelect={onSelect} />);
    expect(mockScrollTo).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      0,
      false,
    );
  });
});
