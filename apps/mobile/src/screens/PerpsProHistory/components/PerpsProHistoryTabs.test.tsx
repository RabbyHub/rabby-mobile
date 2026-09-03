import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { PerpsProHistoryTab } from '../types';

const mockScrollTo = jest.fn();
let mockScrollHandlers: {
  onBeginDrag?: (event: { contentOffset: { x: number } }) => void;
  onScroll?: (event: { contentOffset: { x: number } }) => void;
} = {};
let mockAnimatedReactions: Array<{
  prepare: () => unknown;
  react: (current: unknown, previous?: unknown) => void;
}> = [];

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
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous?: unknown) => void,
    ) => {
      mockAnimatedReactions.push({ prepare, react });
    },
    useAnimatedRef: () => ReactModule.useRef(null),
    useAnimatedScrollHandler: (handlers: typeof mockScrollHandlers) => {
      mockScrollHandlers = handlers;
      return (event: { nativeEvent?: { contentOffset: { x: number } } }) =>
        handlers.onScroll?.(event.nativeEvent ?? event);
    },
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

import {
  getPerpsProHistoryStripOffset,
  PerpsProHistoryTabs,
  updatePerpsProHistoryTabFrame,
} from './PerpsProHistoryTabs';

const shared = <T,>(value: T) => ({ value } as SharedValue<T>);

const createMotion = (position = 0) => ({
  position: shared(position),
  transitionActive: shared(false),
  transitionAnimated: shared(true),
  transitionEpoch: shared(0),
  transitionStartPosition: shared(position),
  transitionTargetPosition: shared(position),
});

const renderTabs = ({
  activeTab = 'orders',
  motion = createMotion(),
  onChange = jest.fn(),
}: {
  activeTab?: PerpsProHistoryTab;
  motion?: ReturnType<typeof createMotion>;
  onChange?: jest.Mock;
} = {}) =>
  render(
    <PerpsProHistoryTabs
      activeTab={activeTab}
      onChange={onChange}
      {...motion}
    />,
  );

const tabLayouts = [
  { height: 32, width: 76, x: 0, y: 0 },
  { height: 32, width: 72, x: 76, y: 0 },
  { height: 32, width: 110, x: 148, y: 0 },
  { height: 32, width: 82, x: 258, y: 0 },
];

const publishAllTabLayouts = () => {
  ['orders', 'trade', 'transaction', 'funding'].forEach((tab, index) => {
    fireEvent(screen.getByTestId(`perps-pro-history-tab-${tab}`), 'layout', {
      nativeEvent: { layout: tabLayouts[index] },
    });
  });
};

const getLatestStripReaction = () => {
  const reaction = [...mockAnimatedReactions].reverse().find(candidate => {
    const value = candidate.prepare();
    return (
      typeof value === 'object' &&
      value !== null &&
      'geometryVersion' in value &&
      'position' in value
    );
  });
  if (!reaction) {
    throw new Error('Expected a strip animated reaction');
  }
  return reaction;
};

describe('PerpsProHistoryTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrollHandlers = {};
    mockAnimatedReactions = [];
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

    publishAllTabLayouts();
    expect(
      screen.queryByTestId('perps-pro-history-tab-indicator-fallback'),
    ).toBeNull();
    const indicator = screen.getByTestId('perps-pro-history-tab-indicator', {
      includeHiddenElements: true,
    });
    expect(indicator.parent?.children[0]).toBe(indicator);
    expect(
      screen.getAllByTestId('perps-pro-history-tab-indicator', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(1);
    expect(StyleSheet.flatten(indicator.props.style)).toMatchObject({
      backgroundColor: '#131416',
      borderRadius: 8,
      height: 30,
      top: 1,
      zIndex: 0,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-history-tab-orders').props.style,
      ),
    ).toMatchObject({ zIndex: 1 });
  });

  it('uses a hidden bold label to prevent width changes during emphasis', () => {
    const motion = createMotion(0.8);
    renderTabs({ motion });

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

  it('interpolates the strip from a real captured offset to the centered target', () => {
    const layouts = [
      { width: 80, x: 0 },
      { width: 80, x: 80 },
      { width: 100, x: 160 },
      { width: 80, x: 260 },
    ];
    const common = {
      contentWidth: 372,
      layouts,
      startOffset: 10,
      startPosition: 1,
      targetPosition: 3,
      viewportWidth: 200,
    };

    expect(getPerpsProHistoryStripOffset({ ...common, position: 1 })).toBe(10);
    expect(getPerpsProHistoryStripOffset({ ...common, position: 2 })).toBe(113);
    expect(getPerpsProHistoryStripOffset({ ...common, position: 3 })).toBe(172);
    expect(
      getPerpsProHistoryStripOffset({
        ...common,
        contentWidth: 180,
        position: 2,
      }),
    ).toBe(0);
  });

  it('lets a manual strip drag own the current generation and retakes next generation', () => {
    const motion = createMotion();
    renderTabs({ motion });
    publishAllTabLayouts();
    fireEvent(screen.getByTestId('perps-pro-history-tabs-scroll'), 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(
      screen.getByTestId('perps-pro-history-tabs-scroll'),
      'contentSizeChange',
      372,
      32,
    );

    let stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    mockScrollTo.mockClear();
    act(() => mockScrollHandlers.onBeginDrag?.({ contentOffset: { x: 50 } }));

    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 1;
    motion.position.value = 0.5;
    stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    expect(mockScrollTo).not.toHaveBeenCalled();

    motion.transitionEpoch.value = 1;
    motion.transitionActive.value = true;
    motion.transitionStartPosition.value = 0.5;
    motion.transitionTargetPosition.value = 1;
    act(() => stripReaction.react(stripReaction.prepare()));
    motion.position.value = 2;
    act(() => stripReaction.react(stripReaction.prepare()));
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('anchors a takeover generation at its current fractional frame', () => {
    const motion = createMotion(0.4);
    motion.transitionActive.value = true;
    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 1;
    renderTabs({ motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    const stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    act(() => mockScrollHandlers.onScroll?.({ contentOffset: { x: 60 } }));
    mockScrollTo.mockClear();

    motion.transitionEpoch.value = 1;
    motion.transitionStartPosition.value = 1;
    motion.transitionTargetPosition.value = 0;
    act(() => stripReaction.react(stripReaction.prepare()));
    expect(mockScrollTo).not.toHaveBeenCalled();

    motion.position.value = 0.3;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo.mock.calls[0]?.[1]).toBeCloseTo(
      getPerpsProHistoryStripOffset({
        contentWidth: 372,
        layouts: tabLayouts.map(({ width, x }) => ({ width, x })),
        position: 0.3,
        startOffset: 60,
        startPosition: 0.4,
        targetPosition: 0,
        viewportWidth: 200,
      }),
    );
  });

  it('returns a cancelled pager motion to the captured manual offset without a terminal jump', () => {
    const motion = createMotion();
    renderTabs({ motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    let stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    act(() => mockScrollHandlers.onBeginDrag?.({ contentOffset: { x: 50 } }));
    mockScrollTo.mockClear();

    motion.transitionEpoch.value = 1;
    motion.transitionActive.value = true;
    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 1;
    stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    motion.position.value = 0.4;
    act(() => stripReaction.react(stripReaction.prepare()));
    motion.position.value = 0;
    act(() => stripReaction.react(stripReaction.prepare()));
    const callsBeforeTerminal = mockScrollTo.mock.calls.length;
    expect(mockScrollTo).toHaveBeenLastCalledWith(
      expect.anything(),
      50,
      0,
      false,
    );

    motion.transitionActive.value = false;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(callsBeforeTerminal);
  });

  it('keeps a successful 0 to 3 terminal centered without restoring the origin offset', () => {
    const motion = createMotion();
    renderTabs({ motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    const stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    mockScrollTo.mockClear();

    motion.transitionEpoch.value = 1;
    motion.transitionActive.value = true;
    motion.transitionAnimated.value = true;
    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 3;
    act(() => stripReaction.react(stripReaction.prepare()));
    motion.position.value = 3;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenLastCalledWith(
      expect.anything(),
      172,
      0,
      false,
    );
    const callsBeforeTerminal = mockScrollTo.mock.calls.length;

    motion.transitionActive.value = false;
    motion.transitionAnimated.value = false;
    motion.transitionStartPosition.value = 3;
    motion.transitionTargetPosition.value = 3;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(callsBeforeTerminal);
  });

  it('recenters inactive terminal presentation after real geometry changes', () => {
    const motion = createMotion(2);
    motion.transitionAnimated.value = true;
    renderTabs({ activeTab: 'transaction', motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    let stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    mockScrollTo.mockClear();
    fireEvent(
      screen.getByTestId('perps-pro-history-tab-transaction'),
      'layout',
      {
        nativeEvent: {
          layout: { ...tabLayouts[2], width: 120 },
        },
      },
    );
    fireEvent(screen.getByTestId('perps-pro-history-tab-funding'), 'layout', {
      nativeEvent: {
        layout: { ...tabLayouts[3], x: 268 },
      },
    });
    fireEvent(scroll, 'contentSizeChange', 382, 32);
    stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo.mock.calls[0]?.[3]).toBe(false);
  });

  it('reanchors an active transition at its current position after geometry changes', () => {
    const motion = createMotion(0.5);
    motion.transitionActive.value = true;
    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 2;
    renderTabs({ motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    let stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    act(() => mockScrollHandlers.onScroll?.({ contentOffset: { x: 60 } }));
    mockScrollTo.mockClear();
    fireEvent(
      screen.getByTestId('perps-pro-history-tab-transaction'),
      'layout',
      {
        nativeEvent: {
          layout: { ...tabLayouts[2], width: 120 },
        },
      },
    );
    fireEvent(screen.getByTestId('perps-pro-history-tab-funding'), 'layout', {
      nativeEvent: {
        layout: { ...tabLayouts[3], x: 268 },
      },
    });
    fireEvent(scroll, 'contentSizeChange', 382, 32);
    stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    expect(mockScrollTo).not.toHaveBeenCalled();

    motion.position.value = 1;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo.mock.calls[0]?.[1]).toBeCloseTo(
      getPerpsProHistoryStripOffset({
        contentWidth: 382,
        layouts: [
          { width: 76, x: 0 },
          { width: 72, x: 76 },
          { width: 120, x: 148 },
          { width: 82, x: 268 },
        ],
        position: 1,
        startOffset: 60,
        startPosition: 0.5,
        targetPosition: 2,
        viewportWidth: 200,
      }),
    );
  });

  it('reanchors active motion when viewport and content widths change', () => {
    const motion = createMotion(0.5);
    motion.transitionActive.value = true;
    motion.transitionStartPosition.value = 0;
    motion.transitionTargetPosition.value = 2;
    renderTabs({ motion });
    publishAllTabLayouts();
    const scroll = screen.getByTestId('perps-pro-history-tabs-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 200, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 372, 32);

    let stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    act(() => mockScrollHandlers.onScroll?.({ contentOffset: { x: 60 } }));
    mockScrollTo.mockClear();
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 32, width: 220, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 400, 32);
    stripReaction = getLatestStripReaction();
    act(() => stripReaction.react(stripReaction.prepare()));
    expect(mockScrollTo).not.toHaveBeenCalled();

    motion.position.value = 1;
    act(() => stripReaction.react(stripReaction.prepare()));

    expect(mockScrollTo).toHaveBeenCalledTimes(1);
    expect(mockScrollTo.mock.calls[0]?.[1]).toBeCloseTo(
      getPerpsProHistoryStripOffset({
        contentWidth: 400,
        layouts: tabLayouts.map(({ width, x }) => ({ width, x })),
        position: 1,
        startOffset: 60,
        startPosition: 0.5,
        targetPosition: 2,
        viewportWidth: 220,
      }),
    );
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
