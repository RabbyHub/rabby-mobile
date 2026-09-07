import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import type { SharedValue } from 'react-native-reanimated';
import {
  PERPS_PRO_INFO_TOUCH_INTENT,
  type PerpsProInfoScrollBridgeController,
} from './usePerpsProInfoScrollBridge';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockCancelAnimation = jest.fn();
const mockWithTiming = jest.fn((target: number, _config?: object) => target);
let mockQueueRunOnJS = false;
const mockRunOnJSQueue: Array<() => unknown> = [];
let mockQueueRunOnUI = false;
let mockIsOnUI = false;
let mockDeferJSSharedWrites = false;
const mockRunOnUIQueue: Array<() => unknown> = [];
const mockJSSharedWrites: Array<() => void> = [];
const mockOnUI = (callback: () => unknown) => {
  const previous = mockIsOnUI;
  mockIsOnUI = true;
  try {
    return callback();
  } finally {
    mockIsOnUI = previous;
  }
};
const flushMockRunOnUIQueue = () => {
  mockRunOnUIQueue.splice(0).forEach(callback => mockOnUI(callback));
};

const flushMockRunOnJSQueue = () => {
  const queuedCallbacks = mockRunOnJSQueue.splice(0);
  queuedCallbacks.forEach(callback => callback());
};

const flushMockRunOnJSQueueInReverse = () => {
  const queuedCallbacks = mockRunOnJSQueue.splice(0).reverse();
  queuedCallbacks.forEach(callback => callback());
};

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return ReactModule.forwardRef(
    (
      { children, ...props }: { children: React.ReactNode },
      ref: React.Ref<unknown>,
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        setPage: mockSetPage,
        setPageWithoutAnimation: mockSetPageWithoutAnimation,
      }));
      return ReactModule.createElement(NativeView, props, children);
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
    cancelAnimation: (value: unknown) => mockCancelAnimation(value),
    dispatchCommand: (
      ref: { current: Record<string, (...args: unknown[]) => void> },
      name: string,
      args: unknown[],
    ) => {
      expect(mockIsOnUI).toBe(true);
      ref.current[name](...args);
    },
    runOnUI:
      (callback: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) => {
        if (mockQueueRunOnUI) {
          mockRunOnUIQueue.push(() => callback(...args));
        } else {
          mockOnUI(() => callback(...args));
        }
      },
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const ref = (instance: unknown) => {
          ref.current = instance;
        };
        ref.current = null;
        return ref;
      }, []),
    Easing: { bezier: jest.fn(() => 'ease-out') },
    ReduceMotion: { System: 'system' },
    runOnJS:
      (callback: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) => {
        const invoke = () => {
          const previous = mockIsOnUI;
          mockIsOnUI = false;
          try {
            return callback(...args);
          } finally {
            mockIsOnUI = previous;
          }
        };
        if (mockQueueRunOnJS) {
          mockRunOnJSQueue.push(invoke);
          return;
        }
        return invoke();
      },
    useEvent:
      (handler: (event: object) => void, eventNames?: string[]) =>
      (event: { nativeEvent?: object }) =>
        mockOnUI(() =>
          handler({
            ...(event.nativeEvent ?? event),
            eventName: eventNames?.[0] ?? 'onPageScroll',
          }),
        ),
    useSharedValue: (initialValue: unknown) =>
      ReactModule.useMemo(() => {
        let value = initialValue;
        return {
          get value() {
            return value;
          },
          set value(next) {
            if (mockDeferJSSharedWrites && !mockIsOnUI) {
              mockJSSharedWrites.push(() => {
                value = next;
              });
            } else {
              value = next;
            }
          },
        };
      }, []),
    withTiming: (target: number, config: object) =>
      mockWithTiming(target, config),
  };
});

import {
  getPerpsProInfoPagePreparedOffset,
  getPreparedPerpsProInfoTabs,
  PerpsProInfoPager,
  type PerpsProInfoPagerHandle,
} from './PerpsProInfoPager';

const data = {
  account: [{ key: 'account-row' }],
  positions: [{ key: 'position-row' }],
  openOrders: [{ key: 'open-order-row' }],
};

const createScrollBridge = (
  offsets: readonly [number, number, number] = [0, 0, 0],
) => {
  const shared = <T,>(value: T) => ({ value });
  return {
    activeIndex: shared(0),
    epoch: shared(0),
    horizontalTouchSessionId: shared(0),
    pageGestureActive: shared(false),
    touchIntent: shared(PERPS_PRO_INFO_TOUCH_INTENT.idle),
    touchSessionId: shared(0),
    targets: offsets.map(offset => ({
      maxOffset: shared(0),
      offset: shared(offset),
      ref: jest.fn(),
    })),
  } as unknown as PerpsProInfoScrollBridgeController;
};

const renderPager = ({
  activeTab = 'positions',
  authorizeNativePageGestures = false,
  indicatorPosition = { value: 0 } as SharedValue<number>,
  keepAllTabsMounted = false,
  nativeVerticalScrollEnabled = true,
  offscreenPageLimit,
  onActivateOffset = jest.fn(),
  onPageDragStart = jest.fn(),
  onPagePreview = jest.fn(),
  onPageRequestFinished = jest.fn(),
  onPageSelected = jest.fn(),
  ref,
  requestedTab = null,
  scrollBridge,
}: {
  activeTab?: PerpsProInfoTab;
  authorizeNativePageGestures?: boolean;
  indicatorPosition?: SharedValue<number>;
  keepAllTabsMounted?: boolean;
  nativeVerticalScrollEnabled?: boolean;
  offscreenPageLimit?: number;
  onActivateOffset?: jest.Mock;
  onPageDragStart?: jest.Mock;
  onPagePreview?: jest.Mock;
  onPageRequestFinished?: jest.Mock;
  onPageSelected?: jest.Mock;
  ref?: React.Ref<PerpsProInfoPagerHandle>;
  requestedTab?: PerpsProInfoTab | null;
  scrollBridge?: PerpsProInfoScrollBridgeController;
} = {}) =>
  render(
    <PerpsProInfoPager
      activeTab={activeTab}
      authorizeNativePageGestures={authorizeNativePageGestures}
      contentContainerStyle={{
        account: {},
        positions: {},
        openOrders: {},
      }}
      data={data}
      getActiveScrollOffset={() => 500}
      keepAllTabsMounted={keepAllTabsMounted}
      indicatorPosition={indicatorPosition}
      nativeVerticalScrollEnabled={nativeVerticalScrollEnabled}
      offscreenPageLimit={offscreenPageLimit}
      onActivateOffset={onActivateOffset}
      onActiveScroll={jest.fn()}
      onLayout={jest.fn()}
      onPageDragStart={onPageDragStart}
      onPagePreview={onPagePreview}
      onPageRequestFinished={onPageRequestFinished}
      onPageSelected={onPageSelected}
      ref={ref}
      renderItem={({ item }) => <View testID={item.key} />}
      renderListHeader={tab => <View testID={`header-${tab}`} />}
      requestedTab={requestedTab}
      scrollBridge={scrollBridge}
      stickyOffset={400}
    />,
  );

describe('PerpsProInfoPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetPage.mockReset();
    mockSetPageWithoutAnimation.mockReset();
    mockQueueRunOnJS = false;
    mockRunOnJSQueue.splice(0);
    mockQueueRunOnUI = false;
    mockIsOnUI = false;
    mockDeferJSSharedWrites = false;
    mockRunOnUIQueue.splice(0);
    mockJSSharedWrites.splice(0);
  });

  it('keeps current and adjacent virtual lists mounted for swipe preview', () => {
    renderPager();

    expect(screen.getByTestId('position-row')).toBeTruthy();
    expect(
      screen.getByTestId('open-order-row', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('account-row', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByTestId('perps-pro-scroll').props.scrollEnabled).toBe(
      true,
    );
    expect(
      screen.getByTestId('perps-pro-scroll-openOrders', {
        includeHiddenElements: true,
      }).props.scrollEnabled,
    ).toBe(false);
    expect(
      screen.getByTestId('perps-pro-info-page-positions').props,
    ).toMatchObject({
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
      pointerEvents: 'auto',
    });
    expect(
      screen.getByTestId('perps-pro-info-page-openOrders', {
        includeHiddenElements: true,
      }).props,
    ).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      pointerEvents: 'none',
    });
  });

  it('keeps every list mounted so preparation cannot miss a detached target', () => {
    const scrollBridge = createScrollBridge();
    renderPager({ keepAllTabsMounted: true, scrollBridge });

    expect(screen.getByTestId('position-row')).toBeTruthy();
    expect(
      screen.getByTestId('open-order-row', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('account-row', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByTestId('perps-pro-scroll').props.scrollEnabled).toBe(
      true,
    );
    expect(
      screen.getByTestId('perps-pro-scroll-account', {
        includeHiddenElements: true,
      }).props.scrollEnabled,
    ).toBe(false);
    expect(scrollBridge.targets[2].ref).toHaveBeenCalledWith(expect.anything());
  });

  it('forwards Android native page retention without changing the default', () => {
    const defaultPager = renderPager();
    expect(
      screen.getByTestId('perps-pro-info-pager').props.offscreenPageLimit,
    ).toBeUndefined();
    defaultPager.unmount();

    renderPager({ offscreenPageLimit: 2 });
    expect(
      screen.getByTestId('perps-pro-info-pager').props.offscreenPageLimit,
    ).toBe(2);
  });

  it('keeps adjacent-only mounting available while delegating vertical touch input', () => {
    const scrollBridge = createScrollBridge();
    renderPager({ nativeVerticalScrollEnabled: false, scrollBridge });

    const activeScroll = screen.getByTestId('perps-pro-scroll');
    expect(activeScroll.props.scrollEnabled).toBe(false);
    const initialEpoch = scrollBridge.epoch.value;
    fireEvent(activeScroll, 'scrollBeginDrag');
    expect(scrollBridge.epoch.value).toBe(initialEpoch);
    expect(screen.getByTestId('position-row')).toBeTruthy();
    expect(
      screen.getByTestId('open-order-row', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('prepares offsets at the sticky boundary and commits only on selection', () => {
    const onActivateOffset = jest.fn();
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge([500, 125, 0]);
    renderPager({
      onActivateOffset,
      onPageDragStart,
      onPagePreview,
      onPageSelected,
      scrollBridge,
    });

    fireEvent(
      screen.getByTestId('perps-pro-info-pager'),
      'pageScrollStateChanged',
      { nativeEvent: { pageScrollState: 'dragging' } },
    );
    expect(onPageDragStart).toHaveBeenCalledTimes(1);
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });
    expect(onActivateOffset).toHaveBeenCalledWith(125);
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
  });

  it('previews the nearest tab at the midpoint only during a real drag', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ indicatorPosition, onPagePreview, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.49);
    expect(onPagePreview).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.55);
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');
    expect(onPageSelected).not.toHaveBeenCalled();
    const midpointCallCount = onPagePreview.mock.calls.length;
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.8, position: 0 },
    });
    expect(onPagePreview).toHaveBeenCalledTimes(midpointCallCount);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'settling' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.45, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('positions');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');
  });

  it('clears a drag preview before a programmatic page command', () => {
    const onPagePreview = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({ onPagePreview, ref, requestedTab: 'account' });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');

    act(() => ref.current?.setPage('account'));
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 1 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
  });

  it('rejects a preview callback that arrives after page selection', () => {
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ onPagePreview, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');

    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.45, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();

    act(flushMockRunOnJSQueue);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);
  });

  it('keeps the destination preview when native idle arrives before selection', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ indicatorPosition, onPagePreview, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);

    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    act(flushMockRunOnJSQueue);
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();
    act(flushMockRunOnJSQueue);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);
    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('ignores a delayed idle completion after the destination was selected', () => {
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ onPagePreview, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();

    act(flushMockRunOnJSQueue);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);
  });

  it('clears the preview when a drag settles back on the active page', () => {
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ onPagePreview, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
    expect(onPageSelected).not.toHaveBeenCalled();
  });

  it('tracks Android native progress before the current touch is horizontally authorized', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 3;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageDragStart,
      onPagePreview,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.2, position: 0 },
    });

    expect(indicatorPosition.value).toBe(0.2);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.pageGestureActive.value).toBe(false);

    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.horizontalTouchSessionId.value = 3;
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });

    expect(indicatorPosition.value).toBe(0.4);
    expect(onPageDragStart).toHaveBeenCalledTimes(1);
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(scrollBridge.pageGestureActive.value).toBe(true);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('openOrders');
  });

  it('rolls Android visual-only progress back without committing a vertical touch', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 5;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageDragStart,
      onPagePreview,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.3, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.3);

    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.vertical;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(indicatorPosition.value).toBe(0);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });

  it('rejects an Android native selection without horizontal touch intent', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onActivateOffset = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 1;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onActivateOffset,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.25, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.25);

    fireEvent(pager, 'pageSelected', {
      nativeEvent: { position: 1 },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    expect(onActivateOffset).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(indicatorPosition.value).toBe(0);
    expect(scrollBridge.activeIndex.value).toBe(0);
    expect(scrollBridge.touchIntent.value).toBe(
      PERPS_PRO_INFO_TOUCH_INTENT.idle,
    );
  });

  it('ignores Android progress that has no native dragging owner', () => {
    const indicatorPosition = { value: 2 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.activeIndex.value = 2;
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 17;
    renderPager({
      activeTab: 'account',
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageDragStart,
      onPagePreview,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.2, position: 1 },
    });

    expect(indicatorPosition.value).toBe(2);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPagePreview).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });

  it('keeps Account selected after an unauthorized Android selection emits trailing progress', () => {
    const indicatorPosition = { value: 2 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.activeIndex.value = 2;
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 19;
    renderPager({
      activeTab: 'account',
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageDragStart,
      onPagePreview,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.2, position: 1 },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
    expect(indicatorPosition.value).toBe(2);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPagePreview).not.toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(2);
  });

  it('does not authorize an older Android visual transition with a newer touch session', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 23;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    scrollBridge.touchSessionId.value = 24;
    scrollBridge.horizontalTouchSessionId.value = 24;
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    expect(indicatorPosition.value).toBe(0);
    expect(onPageSelected).not.toHaveBeenCalled();
  });

  it('commits an Android selection authorized by the current horizontal touch', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 3;
    scrollBridge.horizontalTouchSessionId.value = 3;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.85, position: 0 },
    });

    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(1);
    expect(indicatorPosition.value).toBe(0.85);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('waits for Android idle after a programmatic selection while keeping native progress live', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      ref,
      requestedTab: 'openOrders',
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.82, position: 0 },
    });

    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(indicatorPosition.value).toBe(0.82);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('keeps a sub-midpoint Android programmatic target through idle-before-selected', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      ref,
      requestedTab: 'openOrders',
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(indicatorPosition.value).toBe(0.4);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.75, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.75);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(indicatorPosition.value).toBe(1);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('uses selected-before-idle as the Android no-progress fallback', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      ref,
      requestedTab: 'openOrders',
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(indicatorPosition.value).toBe(0);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('does not snap an Android programmatic transition backward when idle precedes selection', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      ref,
      requestedTab: 'openOrders',
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.63, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(indicatorPosition.value).toBe(0.63);
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(indicatorPosition.value).toBe(1);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('converges an Android transition when idle arrives before selection', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 11;
    scrollBridge.horizontalTouchSessionId.value = 11;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.72, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(indicatorPosition.value).toBe(0.72);
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(indicatorPosition.value).toBe(1);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
  });

  it('safely snaps an Android drag that rebounds without selection', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 13;
    scrollBridge.horizontalTouchSessionId.value = 13;
    renderPager({
      authorizeNativePageGestures: true,
      indicatorPosition,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.4);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    expect(indicatorPosition.value).toBe(0);
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('invalidates prior Android authorization when a new touch begins', () => {
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 7;
    scrollBridge.horizontalTouchSessionId.value = 7;
    renderPager({
      authorizeNativePageGestures: true,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    scrollBridge.touchSessionId.value = 8;
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(onPageSelected).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
  });

  it('allows an Android programmatic page command without touch authorization', () => {
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    renderPager({
      authorizeNativePageGestures: true,
      onPageSelected,
      ref,
      requestedTab: 'account',
      scrollBridge,
    });

    act(() => ref.current?.setPage('account'));
    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 2 },
    });

    expect(onPageSelected).toHaveBeenCalledWith('account', expect.any(Number));
  });

  it('tracks an adjacent programmatic transition from native pager progress', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPagePreview = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({
      indicatorPosition,
      onPageDragStart,
      onPagePreview,
      ref,
      requestedTab: 'openOrders',
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockWithTiming).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0.4);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPagePreview.mock.calls).toEqual([[null]]);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.8, position: 0 },
    });
    expect(indicatorPosition.value).toBe(1);
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('starts an immediate reverse iOS drag after selection without waiting for idle', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageDragStart = jest.fn();
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({
      indicatorPosition,
      onPageDragStart,
      onPageSelected,
      ref,
      requestedTab: 'openOrders',
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('openOrders'));
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(indicatorPosition.value).toBe(1);

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.4, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });

    expect(onPageDragStart).toHaveBeenCalledTimes(1);
    expect(onPageSelected.mock.calls.map(call => [call[0]])).toEqual([
      ['openOrders'],
      ['positions'],
    ]);
    expect(indicatorPosition.value).toBe(0.4);
    expect(mockWithTiming).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });
    expect(indicatorPosition.value).toBe(0);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('keeps iOS gesture progress native-owned until the exact final scroll', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    renderPager({ indicatorPosition });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.75, position: 0 },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    expect(indicatorPosition.value).toBe(0.75);
    expect(mockWithTiming).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 1 },
    });
    expect(indicatorPosition.value).toBe(1);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('ignores an iOS selection from a superseded programmatic target', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({
      indicatorPosition,
      onPageSelected,
      ref,
      requestedTab: 'account',
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => {
      ref.current?.setPage('openOrders');
      ref.current?.setPage('account');
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(onPageSelected.mock.calls.map(call => [call[0]])).toEqual([
      ['account'],
    ]);
    expect(indicatorPosition.value).toBe(2);
  });

  it('returns to the settled iOS page after an in-flight target completes late', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({
      indicatorPosition,
      onPageSelected,
      ref,
      requestedTab: 'openOrders',
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => {
      ref.current?.setPage('openOrders');
      ref.current?.returnToPage('positions');
    });
    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(mockSetPage).toHaveBeenLastCalledWith(0);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(indicatorPosition.value).toBe(0);
  });

  it('drops a queued selected callback from an older reverse-swipe epoch', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    renderPager({
      indicatorPosition,
      onPageSelected,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    mockQueueRunOnJS = false;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0, position: 0 },
    });

    act(flushMockRunOnJSQueueInReverse);

    expect(onPageSelected.mock.calls.map(call => [call[0]])).toEqual([
      ['positions'],
    ]);
    expect(indicatorPosition.value).toBe(0);
  });

  it('keeps an older selected commit when the newer reverse gesture cancels', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const onPageSelected = jest.fn();
    renderPager({ indicatorPosition, onPageSelected });
    const pager = screen.getByTestId('perps-pro-info-pager');

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    mockQueueRunOnJS = false;

    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 1, position: 0 },
    });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });

    act(flushMockRunOnJSQueue);

    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
    expect(indicatorPosition.value).toBe(1);
  });

  it('installs an Android correction on UI before delayed JS callbacks run', () => {
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 21;
    renderPager({
      authorizeNativePageGestures: true,
      onPageSelected,
      scrollBridge,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');

    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    mockQueueRunOnJS = false;
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 22;
    scrollBridge.horizontalTouchSessionId.value = 22;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });

    act(flushMockRunOnJSQueue);

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(
      'openOrders',
      expect.any(Number),
    );
  });

  it('mounts and snaps directly to a requested non-adjacent tab', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({ indicatorPosition, ref, requestedTab: 'account' });
    expect(
      screen.getByTestId('account-row', { includeHiddenElements: true }),
    ).toBeTruthy();

    act(() => ref.current?.setPage('account'));
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(indicatorPosition.value).toBe(2);
    mockCancelAnimation.mockClear();
    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 2 },
    });
    fireEvent(
      screen.getByTestId('perps-pro-info-pager'),
      'pageScrollStateChanged',
      {
        nativeEvent: { pageScrollState: 'idle' },
      },
    );
    expect(mockCancelAnimation).toHaveBeenCalledWith(indicatorPosition);
    expect(indicatorPosition.value).toBe(2);
  });

  it('starts adjacent native progress from a settled non-adjacent snap', () => {
    const indicatorPosition = { value: 0 } as SharedValue<number>;
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({ indicatorPosition, ref, requestedTab: 'account' });
    const pager = screen.getByTestId('perps-pro-info-pager');

    act(() => ref.current?.setPage('account'));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(indicatorPosition.value).toBe(2);

    act(() => ref.current?.setPage('openOrders'));
    expect(mockSetPage).toHaveBeenLastCalledWith(1);
    expect(indicatorPosition.value).toBe(2);

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.7, position: 1 },
    });
    expect(indicatorPosition.value).toBe(1.7);
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('installs the UI owner before a native command can synchronously select', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    const onPageSelected = jest.fn();
    const onPageRequestFinished = jest.fn();
    renderPager({
      ref,
      scrollBridge,
      onPageSelected,
      onPageRequestFinished,
      authorizeNativePageGestures: true,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');
    mockQueueRunOnUI = true;
    mockDeferJSSharedWrites = true;
    mockSetPage.mockImplementation(position => {
      fireEvent(pager, 'pageSelected', { nativeEvent: { position } });
      fireEvent(pager, 'pageScroll', { nativeEvent: { position, offset: 0 } });
      fireEvent(pager, 'pageScrollStateChanged', {
        nativeEvent: { pageScrollState: 'idle' },
      });
    });
    act(() => ref.current?.setPage('openOrders', 1));
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockJSSharedWrites).toHaveLength(0);
    act(flushMockRunOnUIQueue);
    expect(onPageSelected).toHaveBeenCalledWith('openOrders', 1);
    expect(onPageRequestFinished).toHaveBeenCalledWith(1);
    expect(scrollBridge.activeIndex.value).toBe(1);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
  });

  it('coalesces rapid endpoint requests without activating the superseded page', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge([120, 400, 650]);
    const onPageSelected = jest.fn();
    const onActivateOffset = jest.fn();
    renderPager({
      ref,
      scrollBridge,
      onPageSelected,
      onActivateOffset,
      authorizeNativePageGestures: true,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');
    act(() => {
      ref.current?.setPage('account', 1);
      ref.current?.returnToPage('positions', 2);
      ref.current?.setPage('account', 3);
      ref.current?.returnToPage('positions', 4);
      ref.current?.setPage('openOrders', 5);
    });
    expect(mockSetPageWithoutAnimation.mock.calls).toEqual([[2]]);
    expect(mockSetPage).not.toHaveBeenCalled();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(mockSetPage).toHaveBeenLastCalledWith(1);
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(onActivateOffset).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(0);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(scrollBridge.activeIndex.value).toBe(0);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected.mock.calls).toEqual([['openOrders', 5]]);
    expect(onActivateOffset).toHaveBeenCalledWith(400);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });

  it('finishes repeated requests for a native-selected page without another callback', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    const onPageRequestFinished = jest.fn();
    renderPager({
      ref,
      scrollBridge,
      onPageRequestFinished,
      authorizeNativePageGestures: true,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');
    act(() => ref.current?.setPage('account', 1));
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    // No idle is synthesized for this non-animated command.
    act(() => ref.current?.setPage('account', 2));
    expect(mockSetPageWithoutAnimation.mock.calls).toEqual([[2]]);
    expect(onPageRequestFinished.mock.calls).toEqual([[1], [2]]);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
    act(() => ref.current?.setPage('openOrders', 3));
    expect(mockSetPage).toHaveBeenCalledWith(1);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageRequestFinished).toHaveBeenLastCalledWith(3);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });

  it('releases a same-page manual return even when UIKit omits selected', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const scrollBridge = createScrollBridge();
    const onPageSelected = jest.fn();
    const onPageRequestFinished = jest.fn();
    renderPager({ ref, scrollBridge, onPageSelected, onPageRequestFinished });
    const pager = screen.getByTestId('perps-pro-info-pager');
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { position: 0, offset: 0.6 },
    });
    act(() => ref.current?.returnToPage('positions', 1));
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
    expect(onPageRequestFinished).toHaveBeenCalledWith(1);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(0);
    expect(mockSetPage).toHaveBeenLastCalledWith(0);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 0 } });
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });

  it.each(['vertical', 'idle', 'replacement'] as const)(
    'rejects %s gesture progress before it changes the indicator or preview',
    reason => {
      const scrollBridge = createScrollBridge();
      const indicatorPosition = { value: 0 } as SharedValue<number>;
      const onPagePreview = jest.fn();
      scrollBridge.touchSessionId.value = 1;
      scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
      renderPager({
        scrollBridge,
        indicatorPosition,
        onPagePreview,
        authorizeNativePageGestures: true,
      });
      const pager = screen.getByTestId('perps-pro-info-pager');
      fireEvent(pager, 'pageScrollStateChanged', {
        nativeEvent: { pageScrollState: 'dragging' },
      });
      fireEvent(pager, 'pageScroll', {
        nativeEvent: { position: 0, offset: 0.25 },
      });
      expect(indicatorPosition.value).toBe(0.25);
      if (reason === 'replacement') {
        scrollBridge.touchSessionId.value = 2;
      } else {
        scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT[reason];
      }
      fireEvent(pager, 'pageScroll', {
        nativeEvent: { position: 0, offset: 0.6 },
      });
      expect(indicatorPosition.value).toBe(0);
      expect(onPagePreview).not.toHaveBeenCalledWith('openOrders');
      expect(scrollBridge.pageGestureActive.value).toBe(false);
    },
  );

  it('drops queued gesture preparation and selection after a newer click', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    const onPageDragStart = jest.fn();
    const onPageSelected = jest.fn();
    const onPageRequestFinished = jest.fn();
    renderPager({
      ref,
      onPageDragStart,
      onPageSelected,
      onPageRequestFinished,
    });
    const pager = screen.getByTestId('perps-pro-info-pager');
    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    act(() => ref.current?.setPage('account', 1));
    act(flushMockRunOnJSQueue);
    expect(onPageDragStart).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(onPageRequestFinished).not.toHaveBeenCalled();
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    act(flushMockRunOnJSQueue);
    expect(onPageSelected.mock.calls).toEqual([['account', 1]]);
  });

  it('normalizes preview offsets without losing an already-deep tab', () => {
    expect(
      getPerpsProInfoPagePreparedOffset({
        activeOffset: 200,
        stickyOffset: 400,
        storedOffset: 700,
      }),
    ).toBe(200);
    expect(
      getPerpsProInfoPagePreparedOffset({
        activeOffset: 500,
        stickyOffset: 400,
        storedOffset: 700,
      }),
    ).toBe(700);
    expect([...getPreparedPerpsProInfoTabs('positions', null)]).toEqual([
      'positions',
      'openOrders',
    ]);
    expect([...getPreparedPerpsProInfoTabs('positions', null, true)]).toEqual([
      'positions',
      'openOrders',
      'account',
    ]);
  });

  it('publishes native list bounds and invalidates the trade bridge on page changes', () => {
    const scrollBridge = createScrollBridge();
    renderPager({ scrollBridge });
    const scroll = screen.getByTestId('perps-pro-scroll');

    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 600, width: 393, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 393, 1000);
    expect(scrollBridge.targets[0].maxOffset.value).toBe(400);
    expect(scrollBridge.targets[0].ref).toHaveBeenCalled();

    const initialEpoch = scrollBridge.epoch.value;
    fireEvent(scroll, 'scrollBeginDrag');
    expect(scrollBridge.epoch.value).toBe(initialEpoch + 1);

    fireEvent(
      screen.getByTestId('perps-pro-info-pager'),
      'pageScrollStateChanged',
      { nativeEvent: { pageScrollState: 'dragging' } },
    );
    expect(scrollBridge.epoch.value).toBe(initialEpoch + 2);
    expect(scrollBridge.pageGestureActive.value).toBe(true);

    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });
    expect(scrollBridge.activeIndex.value).toBe(1);
    expect(scrollBridge.epoch.value).toBe(initialEpoch + 3);
    expect(scrollBridge.pageGestureActive.value).toBe(false);
  });
});
