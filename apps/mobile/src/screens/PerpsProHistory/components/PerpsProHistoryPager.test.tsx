import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHideFeeTipsPopup = jest.fn();
let mockTabsPosition: SharedValue<number> | null = null;
let mockTabsTransitionActive: SharedValue<boolean> | null = null;
let mockTabsTransitionAnimated: SharedValue<boolean> | null = null;

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
      (...args: unknown[]) =>
        callback(...args),
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
    PerpsProHistoryList: ({ active, tab }: { active: boolean; tab: string }) =>
      ReactModule.createElement(View, {
        testID: `history-list-${tab}-${active ? 'active' : 'preview'}`,
      }),
  };
});

import { createPerpsProHistoryState } from '../scene/perpsProHistoryControllerState';
import type { PerpsProHistoryTab } from '../types';
import {
  getPreparedPerpsProHistoryTabs,
  PerpsProHistoryPager,
} from './PerpsProHistoryPager';

const renderPager = ({
  active = true,
  activeTab = 'orders',
  onChange = jest.fn(),
}: {
  active?: boolean;
  activeTab?: PerpsProHistoryTab;
  onChange?: jest.Mock;
} = {}) =>
  render(
    <PerpsProHistoryPager
      active={active}
      activeTab={activeTab}
      amountUnit="base"
      onChange={onChange}
      onLoadEarlier={jest.fn()}
      onRefresh={jest.fn()}
      state={createPerpsProHistoryState()}
    />,
  );

const getPager = () => screen.getByTestId('perps-pro-history-pager');

describe('PerpsProHistoryPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsPosition = null;
    mockTabsTransitionActive = null;
    mockTabsTransitionAnimated = null;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps only the committed list active while adjacent pages stay prepared', () => {
    renderPager();

    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.queryByTestId('history-list-funding-preview')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-history-tab-orders').props
        .accessibilityState,
    ).toEqual({ selected: true });
  });

  it('tracks native swipe progress in both directions and commits only selection', () => {
    const onChange = jest.fn();
    const view = renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.35, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.35);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.78, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.78);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockTabsPosition?.value).toBe(0.78);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');

    view.rerender(
      <PerpsProHistoryPager
        active
        activeTab="trade"
        amountUnit="base"
        onChange={onChange}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(mockTabsPosition?.value).toBe(1);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.72, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.72);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.28, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.28);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps an adjacent tap on native progress and settles selected before idle', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(mockTabsPosition?.value).toBe(0);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.64, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.64);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).toHaveBeenCalledWith('trade');
    expect(mockTabsPosition?.value).toBe(1);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps progress when idle precedes selected and converges without a second commit', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.7, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(mockTabsPosition?.value).toBe(0.7);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockTabsPosition?.value).toBe(1);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('uses programmatic selected as a terminal fallback when no progress arrives', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    expect(mockTabsPosition?.value).toBe(0);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(mockTabsPosition?.value).toBe(1);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(2);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(2);
  });

  it('waits for Android programmatic idle after its early selected callback', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'settling' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(mockTabsPosition?.value).toBe(0.4);
    expect(mockSetPage).not.toHaveBeenCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    expect(mockTabsPosition?.value).toBe(1);
    expect(mockSetPage).not.toHaveBeenCalledWith(2);
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adopts an Android early programmatic selection as the origin of a user drag', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'settling' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockTabsPosition?.value).toBe(0.4);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    expect(mockTabsPosition?.value).toBe(0.4);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.58, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.58);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.32, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.32);
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockTabsPosition?.value).toBe(1);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('closes the owned fee tip on a selected-only native page change', () => {
    const onChange = jest.fn();
    renderPager({ onChange });

    fireEvent(getPager(), 'pageSelected', { nativeEvent: { position: 1 } });

    expect(onChange).toHaveBeenCalledWith('trade');
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale idle cancel a new drag before its first progress', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.25, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.25);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockTabsPosition?.value).toBe(0.25);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });

    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('preserves a scroll-first gesture when dragging arrives afterward', () => {
    renderPager();
    const pager = getPager();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.25, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.25);
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    expect(mockTabsPosition?.value).toBe(0.25);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });

    expect(mockTabsPosition?.value).toBe(0.4);
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
  });

  it('adopts a scroll-first gesture before a tab request is issued', () => {
    renderPager();
    const pager = getPager();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.25, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    expect(mockTabsPosition?.value).toBe(0.25);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
  });

  it('finishes a zero-distance gesture before accepting the next tab', () => {
    renderPager();
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));

    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('keeps sub-midpoint progress through idle until native selection arrives', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(mockTabsPosition?.value).toBe(0.4);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(mockTabsPosition?.value).toBe(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('keeps gesture origin and destination mounted through the active-tab acknowledgement', () => {
    const onChange = jest.fn();
    const state = createPerpsProHistoryState();
    const view = render(
      <PerpsProHistoryPager
        active
        activeTab="orders"
        amountUnit="base"
        onChange={onChange}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={state}
      />,
    );
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.62, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    view.rerender(
      <PerpsProHistoryPager
        active
        activeTab="trade"
        amountUnit="base"
        onChange={onChange}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={state}
      />,
    );

    expect(
      screen.getByTestId('history-list-orders-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByTestId('history-list-trade-active')).toBeTruthy();
    expect(
      screen.queryByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(
      screen.getByTestId('history-list-orders-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByTestId('history-list-trade-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('returns the presentation to the committed tab when a gesture is cancelled', () => {
    const onChange = jest.fn();
    renderPager({ activeTab: 'trade', onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.62, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.62);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(
      screen.getByTestId('history-list-orders-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockTabsPosition?.value).toBe(1);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('centers a successful multi-page gesture terminal instead of restoring its origin offset', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.7, position: 2 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 3 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 3 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockTabsPosition?.value).toBe(3);
    expect(mockTabsTransitionActive?.value).toBe(false);
    expect(mockTabsTransitionAnimated?.value).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('funding');
  });

  it('snaps a distant tab and prepares it before the direct native jump', () => {
    renderPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(mockTabsPosition?.value).toBe(3);
    expect(
      screen.getByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('snaps a distant page and its tab presentation in the same prepared frame', () => {
    let queuedFrame: ((time: number) => void) | null = null;
    jest
      .mocked(global.requestAnimationFrame)
      .mockImplementationOnce(callback => {
        queuedFrame = callback;
        return 41;
      });
    renderPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    expect(mockTabsPosition?.value).toBe(0);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    act(() => queuedFrame?.(0));
    expect(mockTabsPosition?.value).toBe(3);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
  });

  it('does not swallow A to B to A and ignores the superseded B settlement', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));
    expect(mockSetPage.mock.calls).toEqual([[1]]);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPage.mock.calls).toEqual([[1], [0]]);
    expect(mockSetPage).toHaveBeenLastCalledWith(0);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(mockTabsPosition?.value).toBe(0);
  });

  it('keeps following the in-flight native page before reversing to latest desire', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));
    expect(mockSetPage.mock.calls).toEqual([[1]]);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.6, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.6);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.8, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.8);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(onChange).not.toHaveBeenCalled();
    expect(mockTabsPosition?.value).toBe(1);
    expect(mockSetPage.mock.calls).toEqual([[1], [0]]);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.7, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.7);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('finishes a gesture rebound to the current tab without a phantom command', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));

    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.2, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.2);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockTabsPosition?.value).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('waits for a superseded gesture final scroll before issuing the latest tab', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(mockTabsPosition?.value).toBe(0.4);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.8, position: 0 },
    });
    expect(mockTabsPosition?.value).toBe(0.8);
    expect(mockSetPage).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });

    expect(mockTabsPosition?.value).toBe(1);
    expect(mockSetPage).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('transaction');
  });

  it('resumes the latest tab after a superseded gesture rebounds without selected', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the native gesture page prepared before mounting its follow-up', () => {
    renderPager();
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('mounts the follow-up page after the current native destination settles', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));

    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(
      screen.queryByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPage).toHaveBeenLastCalledWith(2);
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('transaction');
  });

  it('serializes A to B to C to D around one native destination', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(mockSetPage.mock.calls).toEqual([[1]]);
    expect(screen.getByTestId('history-list-orders-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(
      screen.queryByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 3 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('funding');
  });

  it('keeps the physical page and issued target until a later desire can mount', () => {
    let queuedFrame: ((time: number) => void) | null = null;
    renderPager();
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(
      screen.getByTestId('history-list-trade-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeNull();

    jest
      .mocked(global.requestAnimationFrame)
      .mockImplementationOnce(callback => {
        queuedFrame = callback;
        return 79;
      });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });

    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('history-list-funding-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(mockSetPage).not.toHaveBeenCalledWith(3);
    act(() => queuedFrame?.(0));
    expect(mockSetPage).toHaveBeenCalledWith(3);
  });

  it('replaces a queued resume with the latest rapid target', () => {
    let queuedFrame: ((time: number) => void) | null = null;
    const cancelFrame = jest.spyOn(global, 'cancelAnimationFrame');
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    jest
      .mocked(global.requestAnimationFrame)
      .mockImplementationOnce(callback => {
        queuedFrame = callback;
        return 77;
      });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockSetPage).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(cancelFrame).toHaveBeenCalledWith(77);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(3);
    expect(onChange).not.toHaveBeenCalled();
    act(() => queuedFrame?.(0));
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
  });

  it('commits an observed native page when its queued follow-up is cancelled', () => {
    let queuedFrame: ((time: number) => void) | null = null;
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-transaction'));
    jest
      .mocked(global.requestAnimationFrame)
      .mockImplementationOnce(callback => {
        queuedFrame = callback;
        return 78;
      });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');
    act(() => queuedFrame?.(0));
    expect(mockSetPage).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
  });

  it('does not duplicate a committed selection when the next gesture rebounds', () => {
    const onChange = jest.fn();
    renderPager({ onChange });
    const pager = getPager();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.8, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('trade');
  });

  it('serializes a newer desire behind the already-issued reverse command', () => {
    renderPager();
    const pager = getPager();

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-trade'));
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-orders'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));

    expect(mockSetPage.mock.calls).toEqual([[1], [0]]);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(3);
  });

  it('cancels a queued command and ignores native callbacks while inactive', () => {
    let queuedFrame: ((time: number) => void) | null = null;
    jest
      .mocked(global.requestAnimationFrame)
      .mockImplementationOnce(callback => {
        queuedFrame = callback;
        return 23;
      });
    const cancelFrame = jest.spyOn(global, 'cancelAnimationFrame');
    const onChange = jest.fn();
    const view = renderPager({ onChange });

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    view.rerender(
      <PerpsProHistoryPager
        active={false}
        activeTab="orders"
        amountUnit="base"
        onChange={onChange}
        onLoadEarlier={jest.fn()}
        onRefresh={jest.fn()}
        state={createPerpsProHistoryState()}
      />,
    );

    expect(cancelFrame).toHaveBeenCalledWith(23);
    act(() => queuedFrame?.(0));
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    fireEvent(
      screen.getByTestId('perps-pro-history-pager', {
        includeHiddenElements: true,
      }),
      'pageSelected',
      { nativeEvent: { position: 3 } },
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('bounds prepared pages to committed, native and latest desired', () => {
    expect([...getPreparedPerpsProHistoryTabs('trade', null)]).toEqual([
      'orders',
      'trade',
      'transaction',
    ]);
    expect([
      ...getPreparedPerpsProHistoryTabs('orders', 'transaction', 'trade'),
    ]).toEqual(['orders', 'trade', 'transaction']);
    expect([
      ...getPreparedPerpsProHistoryTabs('orders', 'funding', 'trade'),
    ]).toEqual(['orders', 'trade', 'funding']);
  });

  it('restores the adjacent prepared window after the controller acknowledges selection', () => {
    const ControlledPager = () => {
      const [tab, setTab] = React.useState<PerpsProHistoryTab>('orders');
      return (
        <PerpsProHistoryPager
          active
          activeTab={tab}
          amountUnit="base"
          onChange={setTab}
          onLoadEarlier={jest.fn()}
          onRefresh={jest.fn()}
          state={createPerpsProHistoryState()}
        />
      );
    };
    render(<ControlledPager />);

    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    fireEvent(getPager(), 'pageSelected', { nativeEvent: { position: 3 } });

    expect(screen.getByTestId('history-list-funding-active')).toBeTruthy();
    expect(
      screen.getByTestId('history-list-transaction-preview', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.queryByTestId('history-list-orders-preview')).toBeNull();
  });
});
