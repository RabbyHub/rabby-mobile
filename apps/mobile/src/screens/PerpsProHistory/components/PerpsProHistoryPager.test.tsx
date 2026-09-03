import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHideFeeTipsPopup = jest.fn();
const mockListRender = jest.fn();
let mockTabsPosition: SharedValue<number> | null = null;
let mockTabsTransitionActive: SharedValue<boolean> | null = null;
let mockTabsTransitionAnimated: SharedValue<boolean> | null = null;
let mockDeferRunOnJS = false;
let mockRunOnJSQueue: Array<() => void> = [];

jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHideFeeTipsPopup,
}));

jest.mock('@/screens/PerpsPro/components/common/PerpsProTabIndicator', () => ({
  snapPerpsProTabIndicator: (position: SharedValue<number>, target: number) => {
    position.value = target;
  },
}));

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ReactModule.forwardRef(
    (
      { children, ...props }: { children: React.ReactNode },
      ref: React.Ref<unknown>,
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return ReactModule.createElement(View, props, children);
    },
  );
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    runOnJS:
      (callback: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        if (mockDeferRunOnJS) {
          mockRunOnJSQueue.push(() => callback(...args));
          return;
        }
        callback(...args);
      },
    useEvent:
      (handler: (event: object) => void) => (event: { nativeEvent?: object }) =>
        handler(event.nativeEvent ?? event),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

jest.mock('./PerpsProHistoryTabs', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  const tabs = ['orders', 'trade', 'transaction', 'funding'];
  return {
    PerpsProHistoryTabs: ({
      activeTab,
      onChange,
      position,
      transitionActive,
      transitionAnimated,
    }: {
      activeTab: string;
      onChange: (tab: string) => void;
      position: SharedValue<number>;
      transitionActive: SharedValue<boolean>;
      transitionAnimated: SharedValue<boolean>;
    }) => {
      mockTabsPosition = position;
      mockTabsTransitionActive = transitionActive;
      mockTabsTransitionAnimated = transitionAnimated;
      return ReactModule.createElement(
        View,
        null,
        tabs.map(tab =>
          ReactModule.createElement(Pressable, {
            accessibilityState: { selected: tab === activeTab },
            key: tab,
            onPress: () => onChange(tab),
            testID: `perps-pro-history-tab-${tab}`,
          }),
        ),
      );
    },
  };
});

jest.mock('./PerpsProHistoryList', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryList: (props: { active: boolean; tab: string }) => {
      mockListRender(props);
      return ReactModule.createElement(View, {
        testID: `history-list-${props.tab}-${
          props.active ? 'active' : 'preview'
        }`,
      });
    },
  };
});

import {
  createPerpsProHistoryState,
  type PerpsProHistoryControllerState,
} from '../scene/perpsProHistoryControllerState';
import type { PerpsProHistoryTab } from '../types';
import { PerpsProHistoryPager } from './PerpsProHistoryPager';

const defaultOnLoadEarlier = jest.fn();
const defaultOnRefresh = jest.fn();

const renderPager = ({
  active = true,
  activeTab = 'orders',
  onChange = jest.fn(),
  state = createPerpsProHistoryState(),
}: {
  active?: boolean;
  activeTab?: PerpsProHistoryTab;
  onChange?: jest.Mock;
  state?: PerpsProHistoryControllerState;
} = {}) =>
  render(
    <PerpsProHistoryPager
      active={active}
      activeTab={activeTab}
      amountUnit="base"
      onChange={onChange}
      onLoadEarlier={defaultOnLoadEarlier}
      onRefresh={defaultOnRefresh}
      state={state}
    />,
  );

const getPager = () =>
  screen.getByTestId('perps-pro-history-pager', {
    includeHiddenElements: true,
  });
const fireScroll = (position: number, offset: number) =>
  fireEvent(getPager(), 'pageScroll', {
    nativeEvent: { offset, position },
  });
const fireSelected = (position: number) =>
  fireEvent(getPager(), 'pageSelected', { nativeEvent: { position } });
const fireState = (pageScrollState: 'dragging' | 'idle' | 'settling') =>
  fireEvent(getPager(), 'pageScrollStateChanged', {
    nativeEvent: { pageScrollState },
  });
const useAndroidPagerEvents = () =>
  jest.replaceProperty(Platform, 'OS', 'android');
const flushRunOnJSQueue = () => {
  while (mockRunOnJSQueue.length > 0) {
    mockRunOnJSQueue.shift()?.();
  }
};

describe('PerpsProHistoryPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsPosition = null;
    mockTabsTransitionActive = null;
    mockTabsTransitionAnimated = null;
    mockDeferRunOnJS = false;
    mockRunOnJSQueue = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps all four lists mounted and only the committed page active', () => {
    renderPager();

    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    for (const tab of ['trade', 'transaction', 'funding']) {
      expect(
        screen.getByTestId(`history-list-${tab}-preview`, {
          includeHiddenElements: true,
        }),
      ).toBeTruthy();
    }
  });

  it('retains every native page on Android', () => {
    useAndroidPagerEvents();
    renderPager();

    expect(getPager().props.offscreenPageLimit).toBe(3);
  });

  it('waits for gesture idle, snaps on UI, then commits business state', () => {
    const terminalPositions: number[] = [];
    const onChange = jest.fn(() => {
      terminalPositions.push(mockTabsPosition?.value ?? -1);
    });
    renderPager({ onChange });

    fireState('dragging');
    fireScroll(0, 0.78);
    fireSelected(1);

    expect(mockTabsPosition?.value).toBe(0.78);
    expect(onChange).not.toHaveBeenCalled();

    fireState('idle');

    expect(mockTabsPosition?.value).toBe(1);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(onChange).toHaveBeenCalledWith('trade');
    expect(terminalPositions).toEqual([1]);
  });

  it('converges when native idle arrives before selected', () => {
    const onChange = jest.fn();
    renderPager({ onChange });

    fireState('dragging');
    fireScroll(0, 0.7);
    fireState('idle');
    expect(mockTabsPosition?.value).toBe(0.7);
    expect(onChange).not.toHaveBeenCalled();

    fireSelected(1);
    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('keeps an adjacent tab animation fractional until native terminal', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
    fireScroll(0, 0.64);
    fireSelected(1);

    expect(mockTabsPosition?.value).toBe(0.64);
    expect(onChange).not.toHaveBeenCalled();

    fireState('idle');
    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('handles selected after programmatic idle without a duplicate commit', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireScroll(0, 0.7);
    fireState('idle');
    expect(onChange).not.toHaveBeenCalled();

    fireSelected(1);
    fireState('idle');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('commits an iOS programmatic transition from native animation completion', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const terminalPositions: number[] = [];
    const onChange = jest.fn(() => {
      terminalPositions.push(mockTabsPosition?.value ?? -1);
    });
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireScroll(0, 0.73);
    fireSelected(1);

    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
    expect(terminalPositions).toEqual([1]);
  });

  it('uses the UI-settled page when a press beats the terminal JS callback', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockDeferRunOnJS = true;
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireSelected(1);
    expect(mockTabsPosition?.value).toBe(1);

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));
    expect(mockSetPage.mock.calls).toEqual([[1], [0]]);

    flushRunOnJSQueue();
    fireSelected(0);
    flushRunOnJSQueue();

    expect(mockTabsPosition?.value).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('snaps a distant direct tab before issuing the native jump', () => {
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(mockTabsPosition?.value).toBe(3);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    fireSelected(3);
    expect(onChange).toHaveBeenCalledWith('funding');
  });

  it('serializes rapid requests and commits only the latest destination', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    expect(mockSetPage.mock.calls).toEqual([[1]]);

    fireState('idle');
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPage.mock.calls).toEqual([[1]]);

    fireState('settling');
    fireSelected(1);
    fireState('idle');
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPage.mock.calls).toEqual([[1], [2]]);

    fireState('settling');
    fireSelected(2);
    fireState('idle');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('transaction');
  });

  it('continues from a gesture terminal to the latest queued tab', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireState('dragging');
    fireScroll(0, 0.75);
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireSelected(1);
    fireState('idle');

    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPage).toHaveBeenCalledWith(2);

    fireState('settling');
    fireSelected(2);
    fireState('idle');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('transaction');
  });

  it('uses a direct follow-up for the latest distant rapid request', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    fireState('settling');
    fireSelected(1);
    fireState('idle');

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(mockTabsPosition?.value).toBe(3);
    expect(onChange).not.toHaveBeenCalled();

    fireSelected(3);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('funding');
  });

  it('does not publish a superseded destination when reversing to origin', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));
    fireState('settling');
    fireSelected(1);
    fireState('idle');
    expect(mockSetPage.mock.calls).toEqual([[1], [0]]);
    expect(onChange).not.toHaveBeenCalled();

    fireState('settling');
    fireSelected(0);
    fireState('idle');
    expect(onChange).not.toHaveBeenCalled();
    expect(mockTabsPosition?.value).toBe(0);
  });

  it('adopts an early programmatic selection as a new gesture origin', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireScroll(0, 0.4);
    fireSelected(1);
    fireState('dragging');
    fireScroll(0, 0.58);
    fireSelected(1);
    fireState('idle');

    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('returns a canceled gesture to its committed origin', () => {
    const onChange = jest.fn();
    renderPager({ onChange });

    fireState('dragging');
    fireScroll(0, 0.4);
    fireScroll(0, 0);
    fireState('idle');

    expect(mockTabsPosition?.value).toBe(0);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts the next tab request after a zero-distance gesture', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    renderPager({ onChange });

    fireState('dragging');
    fireState('idle');
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));

    expect(mockSetPage).toHaveBeenCalledWith(1);
    fireState('settling');
    fireSelected(1);
    fireState('idle');
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('adopts a scroll-first gesture without resetting its progress', () => {
    renderPager();

    fireScroll(0, 0.25);
    expect(mockTabsPosition?.value).toBe(0.25);
    fireState('dragging');
    expect(mockTabsPosition?.value).toBe(0.25);
    fireScroll(0, 0.4);
    expect(mockTabsPosition?.value).toBe(0.4);
  });

  it('commits a selected-only native change after snapping presentation', () => {
    const terminalPositions: number[] = [];
    const onChange = jest.fn(() => {
      terminalPositions.push(mockTabsPosition?.value ?? -1);
    });
    renderPager({ onChange });

    fireSelected(1);

    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
    expect(terminalPositions).toEqual([1]);
  });

  it('ignores all native callbacks while inactive', () => {
    const onChange = jest.fn();
    renderPager({ active: false, onChange });

    fireState('dragging');
    fireScroll(0, 0.8);
    fireSelected(1);

    expect(mockTabsPosition?.value).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(getPager().props.scrollEnabled).toBe(false);
  });

  it('invalidates an in-flight transition when presentation deactivates', () => {
    useAndroidPagerEvents();
    const onChange = jest.fn();
    const view = renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireState('settling');
    fireSelected(1);
    view.rerender(
      <PerpsProHistoryPager
        active={false}
        activeTab="orders"
        amountUnit="base"
        onChange={onChange}
        onLoadEarlier={defaultOnLoadEarlier}
        onRefresh={defaultOnRefresh}
        state={createPerpsProHistoryState()}
      />,
    );
    fireState('idle');

    expect(mockTabsPosition?.value).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('isolates a single tab state update from the other list bodies', () => {
    const initialState = createPerpsProHistoryState();
    const view = renderPager({ state: initialState });
    mockListRender.mockClear();
    const nextState = {
      ...initialState,
      trade: {
        ...initialState.trade,
        status: 'empty' as const,
      },
    };

    view.rerender(
      <PerpsProHistoryPager
        active
        activeTab="orders"
        amountUnit="base"
        onChange={jest.fn()}
        onLoadEarlier={defaultOnLoadEarlier}
        onRefresh={defaultOnRefresh}
        state={nextState}
      />,
    );

    expect(mockListRender).toHaveBeenCalledTimes(1);
    expect(mockListRender.mock.calls[0][0].tab).toBe('trade');
  });
});
