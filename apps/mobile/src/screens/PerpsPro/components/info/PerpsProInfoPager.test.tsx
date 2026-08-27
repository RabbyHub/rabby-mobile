import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  PERPS_PRO_INFO_TOUCH_INTENT,
  type PerpsProInfoScrollBridgeController,
} from './usePerpsProInfoScrollBridge';

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
let mockQueueRunOnJS = false;
const mockRunOnJSQueue: Array<() => unknown> = [];

const flushMockRunOnJSQueue = () => {
  const queuedCallbacks = mockRunOnJSQueue.splice(0);
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
    runOnJS:
      (callback: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) => {
        if (mockQueueRunOnJS) {
          mockRunOnJSQueue.push(() => callback(...args));
          return;
        }
        return callback(...args);
      },
    useEvent:
      (handler: (event: object) => void, eventNames?: string[]) =>
      (event: { nativeEvent?: object }) =>
        handler({
          ...(event.nativeEvent ?? event),
          eventName: eventNames?.[0] ?? 'onPageScroll',
        }),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
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
  nativeVerticalScrollEnabled = true,
  onActivateOffset = jest.fn(),
  onPageDragStart = jest.fn(),
  onPagePreview = jest.fn(),
  onPageSelected = jest.fn(),
  ref,
  requestedTab = null,
  scrollBridge,
}: {
  activeTab?: PerpsProInfoTab;
  authorizeNativePageGestures?: boolean;
  nativeVerticalScrollEnabled?: boolean;
  onActivateOffset?: jest.Mock;
  onPageDragStart?: jest.Mock;
  onPagePreview?: jest.Mock;
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
      nativeVerticalScrollEnabled={nativeVerticalScrollEnabled}
      onActivateOffset={onActivateOffset}
      onActiveScroll={jest.fn()}
      onLayout={jest.fn()}
      onPageDragStart={onPageDragStart}
      onPagePreview={onPagePreview}
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
    mockQueueRunOnJS = false;
    mockRunOnJSQueue.splice(0);
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

  it('keeps Android list virtualization while delegating vertical touch input', () => {
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
    expect(onPageSelected).toHaveBeenCalledWith('openOrders');
  });

  it('previews the nearest tab at the midpoint only during a real drag', () => {
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager({ onPagePreview, onPageSelected });
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
    expect(onPagePreview).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
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
    expect(onPagePreview).toHaveBeenLastCalledWith('positions');
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.55, position: 0 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith('positions');

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
    expect(onPageSelected).toHaveBeenCalledWith('openOrders');

    act(flushMockRunOnJSQueue);
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);
  });

  it('keeps the destination preview when native idle arrives before selection', () => {
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
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);

    mockQueueRunOnJS = true;
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    act(flushMockRunOnJSQueue);
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);

    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageSelected).toHaveBeenCalledWith('openOrders');
    expect(onPagePreview.mock.calls).toEqual([['openOrders']]);
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
    expect(onPageSelected).toHaveBeenCalledWith('openOrders');

    act(flushMockRunOnJSQueue);
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

  it('rejects an Android native selection without horizontal touch intent', () => {
    const onActivateOffset = jest.fn();
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.pending;
    scrollBridge.touchSessionId.value = 1;
    renderPager({
      authorizeNativePageGestures: true,
      onActivateOffset,
      onPageSelected,
      scrollBridge,
    });

    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(0);
    expect(onActivateOffset).not.toHaveBeenCalled();
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(0);
    expect(scrollBridge.touchIntent.value).toBe(
      PERPS_PRO_INFO_TOUCH_INTENT.idle,
    );
  });

  it('commits an Android selection authorized by the current horizontal touch', () => {
    const onPageSelected = jest.fn();
    const scrollBridge = createScrollBridge();
    scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
    scrollBridge.touchSessionId.value = 3;
    scrollBridge.horizontalTouchSessionId.value = 3;
    renderPager({
      authorizeNativePageGestures: true,
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

    expect(onPageSelected).toHaveBeenCalledWith('openOrders');
    expect(mockSetPageWithoutAnimation).not.toHaveBeenCalled();
    expect(scrollBridge.activeIndex.value).toBe(1);
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

    expect(onPageSelected).toHaveBeenCalledWith('account');
  });

  it('mounts and jumps directly to a requested non-adjacent tab', () => {
    const ref = React.createRef<PerpsProInfoPagerHandle>();
    renderPager({ ref, requestedTab: 'account' });
    expect(
      screen.getByTestId('account-row', { includeHiddenElements: true }),
    ).toBeTruthy();

    act(() => ref.current?.setPage('account'));
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
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
