import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { PerpsProHistoryTab } from '../types';

type MockScrollEvent = Readonly<{
  contentOffset: Readonly<{ x: number; y: number }>;
  targetContentOffset?: Readonly<{ x: number; y: number }>;
  velocity?: Readonly<{ x: number; y: number }>;
}>;
type MockAnimatedScrollHandlers = Readonly<{
  onBeginDrag?: (event: MockScrollEvent) => void;
  onEndDrag?: (event: MockScrollEvent) => void;
  onMomentumBegin?: (event: MockScrollEvent) => void;
  onMomentumEnd?: (event: MockScrollEvent) => void;
  onScroll?: (event: MockScrollEvent) => void;
}>;

let mockAnimatedScrollHandlers: MockAnimatedScrollHandlers | null = null;

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-svg', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: ReactNative.View,
    Path: ReactNative.View,
  };
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      ScrollView: ReactNative.ScrollView,
      Text: ReactNative.Text,
      View: ReactNative.View,
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    cancelAnimation: jest.fn(),
    useAnimatedProps: (updater: () => object) => updater(),
    useAnimatedScrollHandler: (handlers: MockAnimatedScrollHandlers) => {
      mockAnimatedScrollHandlers = handlers;
      return (event: { nativeEvent?: MockScrollEvent } | MockScrollEvent) =>
        handlers.onScroll?.(
          'nativeEvent' in event && event.nativeEvent
            ? event.nativeEvent
            : (event as MockScrollEvent),
        );
    },
    useAnimatedStyle: (updater: () => object) => updater(),
    useDerivedValue: (updater: () => unknown) => ({
      get value() {
        return updater();
      },
    }),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

import {
  getPerpsProHistoryIndicatorPath,
  getPerpsProHistoryStripOffset,
  getPerpsProHistoryTabStripAnchors,
  PerpsProHistoryTabs,
  updatePerpsProHistoryTabFrame,
} from './PerpsProHistoryTabs';

const shared = <T,>(value: T) => ({ value } as SharedValue<T>);

const renderTabs = ({
  activeTab = 'orders',
  onChange = jest.fn(),
  position = shared(0),
}: {
  activeTab?: PerpsProHistoryTab;
  onChange?: jest.Mock;
  position?: SharedValue<number>;
} = {}) =>
  render(
    <PerpsProHistoryTabs
      activeTab={activeTab}
      onChange={onChange}
      position={position}
    />,
  );

const tabLayouts = [
  { height: 32, width: 76, x: 0, y: 0 },
  { height: 32, width: 72, x: 76, y: 0 },
  { height: 32, width: 110, x: 148, y: 0 },
  { height: 32, width: 82, x: 258, y: 0 },
];
const indicatorLayouts = tabLayouts.map(({ width, x }) => ({ width, x }));

const publishAllTabLayouts = () => {
  ['orders', 'trade', 'transaction', 'funding'].forEach((tab, index) => {
    fireEvent(screen.getByTestId(`perps-pro-history-tab-${tab}`), 'layout', {
      nativeEvent: { layout: tabLayouts[index] },
    });
  });
};

const publishScrollableGeometry = () => {
  const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
  act(() => {
    publishAllTabLayouts();
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);
  });
  return scroll;
};

describe('PerpsProHistoryTabs', () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnimatedScrollHandlers = null;
  });

  it('renders one background pill behind stable-width labels', () => {
    const onChange = jest.fn();
    renderTabs({ onChange });

    expect(
      screen.getByTestId('perps-pro-history-tab-orders').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByTestId('perps-pro-history-tab-indicator-fallback'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    expect(onChange).toHaveBeenCalledWith('funding');

    act(publishAllTabLayouts);
    expect(
      screen.getByTestId('perps-pro-history-tab-indicator-fallback'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-history-tab-indicator', {
        includeHiddenElements: true,
      }).props.animatedProps.opacity,
    ).toBe(0);

    publishScrollableGeometry();
    expect(
      screen.queryByTestId('perps-pro-history-tab-indicator-fallback'),
    ).toBeNull();
    const indicator = screen.getByTestId('perps-pro-history-tab-indicator', {
      includeHiddenElements: true,
    });
    expect(
      screen.getAllByTestId('perps-pro-history-tab-indicator', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1);
    expect(indicator.props).toMatchObject({
      animatedProps: {
        opacity: 1,
      },
      fill: '#131416',
    });
    expect(indicator.props.animatedProps.d).not.toBe('');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-tab-orders').props.style,
      ),
    ).toMatchObject({ zIndex: 1 });
  });

  it('uses a hidden bold label to prevent width changes during emphasis', () => {
    renderTabs({ position: shared(0.8) });

    const selectedTab = screen.getByTestId('perps-pro-history-tab-orders');
    const visuallyActiveLabel = screen.getByTestId(
      'perps-pro-history-tab-label-trade',
    );
    const visuallyInactiveLabel = screen.getByTestId(
      'perps-pro-history-tab-label-orders',
    );
    expect(selectedTab.props.accessibilityState).toEqual({ selected: true });
    expect(StyleSheet.flatten(visuallyActiveLabel.props.style)).toMatchObject({
      color: 'neutral-contrast',
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
    });
    expect(StyleSheet.flatten(visuallyInactiveLabel.props.style)).toMatchObject(
      {
        color: 'neutral-secondary',
        fontFamily: 'SF Pro Rounded',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
      },
    );

    const hiddenOrdersLabel = screen
      .getAllByText('page.perps.pro.history.tabs.orders', {
        includeHiddenElements: true,
      })
      .find(node => StyleSheet.flatten(node.props.style)?.opacity === 0);
    expect(StyleSheet.flatten(hiddenOrdersLabel?.props.style)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      opacity: 0,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-tab-orders').props.style,
      ),
    ).toMatchObject({ height: 32, paddingHorizontal: 12 });
  });

  it('builds direction-safe strip anchors for unequal-width tabs', () => {
    expect(
      getPerpsProHistoryTabStripAnchors({
        contentWidth: 372,
        layouts: indicatorLayouts,
        viewportWidth: 200,
      }),
    ).toEqual([0, 28, 100, 172]);
    expect(
      getPerpsProHistoryTabStripAnchors({
        contentWidth: 180,
        layouts: indicatorLayouts,
        viewportWidth: 200,
      }),
    ).toEqual([0, 0, 0, 0]);
    expect(
      getPerpsProHistoryTabStripAnchors({
        contentWidth: 0,
        layouts: indicatorLayouts,
        viewportWidth: 200,
      }),
    ).toEqual([]);

    // Full target visibility and monotonic edges are geometrically
    // incompatible for this intentionally extreme alternating-width case.
    // The original edge flash must remain impossible even in that fallback.
    expect(
      getPerpsProHistoryTabStripAnchors({
        contentWidth: 252,
        layouts: [
          { width: 100, x: 0 },
          { width: 10, x: 100 },
          { width: 100, x: 110 },
          { width: 10, x: 210 },
        ],
        viewportWidth: 100,
      }),
    ).toEqual([16, 26, 36, 46]);
  });

  it('keeps both pill edges monotonic throughout adjacent transitions', () => {
    const anchors = getPerpsProHistoryTabStripAnchors({
      contentWidth: 372,
      layouts: indicatorLayouts,
      viewportWidth: 200,
    });
    const sampleFrame = (position: number) => {
      const fromIndex = Math.floor(position);
      const toIndex = Math.min(indicatorLayouts.length - 1, fromIndex + 1);
      const progress = position - fromIndex;
      const from = indicatorLayouts[fromIndex]!;
      const to = indicatorLayouts[toIndex]!;
      const width = from.width + (to.width - from.width) * progress;
      const x = from.x + (to.x - from.x) * progress;
      const stripOffset = getPerpsProHistoryStripOffset({
        anchors,
        bias: 0,
        maximumOffset: 172,
        position,
      });
      return {
        left: 16 + x - stripOffset,
        right: 16 + x + width - stripOffset,
      };
    };

    for (let index = 0; index < indicatorLayouts.length - 1; index += 1) {
      const forward = [0, 0.25, 0.5, 0.75, 1].map(progress =>
        sampleFrame(index + progress),
      );
      for (let sample = 1; sample < forward.length; sample += 1) {
        expect(forward[sample]!.left).toBeGreaterThanOrEqual(
          forward[sample - 1]!.left,
        );
        expect(forward[sample]!.right).toBeGreaterThanOrEqual(
          forward[sample - 1]!.right,
        );
      }
      const reverse = [...forward].reverse();
      for (let sample = 1; sample < reverse.length; sample += 1) {
        expect(reverse[sample]!.left).toBeLessThanOrEqual(
          reverse[sample - 1]!.left,
        );
        expect(reverse[sample]!.right).toBeLessThanOrEqual(
          reverse[sample - 1]!.right,
        );
      }
    }
  });

  it('drives strip offset and pill geometry from the same fractional position', () => {
    let position = shared(1);
    const onChange = jest.fn();
    const view = renderTabs({ activeTab: 'trade', onChange, position });
    publishScrollableGeometry();

    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 28, y: 0 } });
    position = shared(1.5);
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={onChange}
        position={position}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 64, y: 0 } });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('perps-pro-history-tab-indicator', {
        includeHiddenElements: true,
      }).props.animatedProps.d,
    ).toBe(
      getPerpsProHistoryIndicatorPath({
        frame: { width: 91, x: 112 },
        stripOffset: 64,
      }),
    );

    position = shared(2);
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={onChange}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 100, y: 0 } });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not start a second strip movement when business state commits', () => {
    const position = shared(2);
    const onChange = jest.fn();
    const view = renderTabs({ activeTab: 'trade', onChange, position });
    publishScrollableGeometry();
    const beforeCommit = screen.getByTestId('perps-pro-history-tabs-scroll')
      .props.animatedProps;

    view.rerender(
      <PerpsProHistoryTabs
        activeTab="transaction"
        onChange={onChange}
        position={position}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual(beforeCommit);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('reprojects the settled position directly after geometry changes', () => {
    renderTabs({ activeTab: 'transaction', position: shared(2) });
    const scroll = publishScrollableGeometry();
    expect(scroll.props.animatedProps).toEqual({
      contentOffset: { x: 100, y: 0 },
    });

    act(() => {
      fireEvent(scroll, 'layout', {
        nativeEvent: { layout: { height: 32, width: 220, x: 0, y: 0 } },
      });
    });

    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({
      contentOffset: { x: 90, y: 0 },
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('preserves a manual strip offset as a UI-thread bias', () => {
    let position = shared(1);
    const view = renderTabs({ activeTab: 'trade', position });
    publishScrollableGeometry();
    expect(mockAnimatedScrollHandlers).not.toBeNull();

    act(() => {
      mockAnimatedScrollHandlers?.onBeginDrag?.({
        contentOffset: { x: 60, y: 0 },
      });
    });
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={jest.fn()}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({});

    act(() => {
      mockAnimatedScrollHandlers?.onEndDrag?.({
        contentOffset: { x: 60, y: 0 },
      });
    });
    position = shared(1.5);
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={jest.fn()}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 96, y: 0 } });
  });

  it('keeps native momentum in control until the strip actually settles', () => {
    let position = shared(1);
    const view = renderTabs({ activeTab: 'trade', position });
    publishScrollableGeometry();

    act(() => {
      mockAnimatedScrollHandlers?.onBeginDrag?.({
        contentOffset: { x: 60, y: 0 },
      });
      mockAnimatedScrollHandlers?.onEndDrag?.({
        contentOffset: { x: 60, y: 0 },
        targetContentOffset: { x: 90, y: 0 },
        velocity: { x: 1, y: 0 },
      });
    });
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={jest.fn()}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({});

    act(() => {
      mockAnimatedScrollHandlers?.onMomentumBegin?.({
        contentOffset: { x: 60, y: 0 },
      });
      mockAnimatedScrollHandlers?.onScroll?.({
        contentOffset: { x: 90, y: 0 },
      });
      mockAnimatedScrollHandlers?.onMomentumEnd?.({
        contentOffset: { x: 90, y: 0 },
      });
    });
    position = shared(1.5);
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={jest.fn()}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 126, y: 0 } });
  });

  it('invalidates a manual bias when measured geometry changes', () => {
    const position = shared(1);
    const view = renderTabs({ activeTab: 'trade', position });
    const scroll = publishScrollableGeometry();

    act(() => {
      mockAnimatedScrollHandlers?.onBeginDrag?.({
        contentOffset: { x: 60, y: 0 },
      });
      mockAnimatedScrollHandlers?.onEndDrag?.({
        contentOffset: { x: 60, y: 0 },
      });
    });
    view.rerender(
      <PerpsProHistoryTabs
        activeTab="trade"
        onChange={jest.fn()}
        position={position}
      />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 60, y: 0 } });

    act(() => {
      fireEvent(scroll, 'layout', {
        nativeEvent: { layout: { height: 32, width: 220, x: 0, y: 0 } },
      });
    });
    expect(
      screen.getByTestId('perps-pro-history-tabs-scroll').props.animatedProps,
    ).toEqual({ contentOffset: { x: 18, y: 0 } });
  });

  it('snapshots native layout before a deferred state updater runs', () => {
    type SetTabFrames = Parameters<typeof updatePerpsProHistoryTabFrame>[2];
    type TabFramesUpdate = Parameters<SetTabFrames>[0];
    let deferredUpdate: TabFramesUpdate | undefined;
    const setTabFrames: SetTabFrames = update => {
      deferredUpdate = update;
    };
    const pooledEvent: {
      nativeEvent: {
        layout: { height: number; width: number; x: number; y: number };
      } | null;
    } = {
      nativeEvent: {
        layout: { height: 32, width: 112, x: 208, y: 0 },
      },
    };

    updatePerpsProHistoryTabFrame(
      'transaction',
      pooledEvent as Parameters<typeof updatePerpsProHistoryTabFrame>[1],
      setTabFrames,
    );
    pooledEvent.nativeEvent = null;

    if (typeof deferredUpdate !== 'function') {
      throw new Error('Expected a deferred tab-frame state updater');
    }
    const previous = {};
    const next = deferredUpdate(previous);
    expect(next).toEqual({
      transaction: { height: 32, width: 112, x: 208, y: 0 },
    });
    expect(deferredUpdate(next)).toBe(next);
  });
});
