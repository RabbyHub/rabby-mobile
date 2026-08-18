import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { createRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  PerpsProMarketPager,
  type PerpsProMarketPagerHandle,
} from './PerpsProMarketPager';

let mockIsIOS = true;
const mockNativeSetPage = jest.fn();
const mockNativeSetPageWithoutAnimation = jest.fn();
const mockNativePagerRender = jest.fn();

jest.mock('@/core/native/utils', () => ({
  get IS_IOS() {
    return mockIsIOS;
  },
}));

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        mockNativePagerRender(props);
        ReactModule.useImperativeHandle(ref, () => ({
          setPage: mockNativeSetPage,
          setPageWithoutAnimation: mockNativeSetPageWithoutAnimation,
        }));
        return ReactModule.createElement(NativeView, props, children);
      },
    ),
  };
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      ScrollView: ReactNative.ScrollView,
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedScrollHandler:
      (handlers: { onScroll: (event: unknown) => void }) =>
      (event: { nativeEvent?: unknown }) =>
        handlers.onScroll(event.nativeEvent ?? event),
    useEvent:
      (handler: (event: object) => void) => (event: { nativeEvent?: object }) =>
        handler({
          ...(event.nativeEvent ?? event),
          eventName: 'onPageScroll',
        }),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

const renderPager = (
  onPageSelected = jest.fn(),
  ref = createRef<PerpsProMarketPagerHandle>(),
  initialPage = 1,
  onPagePreview = jest.fn(),
) => {
  render(
    <PerpsProMarketPager
      initialPage={initialPage}
      onPagePreview={onPagePreview}
      onPageSelected={onPageSelected}
      pageWidth={320}
      ref={ref}
      style={{ flex: 1 }}
      testID="market-pager">
      <View key="all" style={{ flex: 1 }} testID="page-all" />
      <View key="new" style={{ flex: 1 }} testID="page-new" />
      <View key="defi" style={{ flex: 1 }} testID="page-defi" />
    </PerpsProMarketPager>,
  );
  return ref;
};

const ControlledPager = ({
  onPageSelected,
}: {
  onPageSelected: (position: number) => void;
}) => {
  const [activePage, setActivePage] = React.useState(0);
  return (
    <PerpsProMarketPager
      initialPage={activePage}
      onPagePreview={jest.fn()}
      onPageSelected={position => {
        setActivePage(position);
        onPageSelected(position);
      }}
      pageWidth={320}
      testID="controlled-market-pager">
      <View key="all" style={{ flex: 1 }} testID="controlled-page-all" />
      <View key="new" style={{ flex: 1 }} testID="controlled-page-new" />
      <View key="defi" style={{ flex: 1 }} testID="controlled-page-defi" />
    </PerpsProMarketPager>
  );
};

describe('PerpsProMarketPager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsIOS = true;
  });

  it('uses a view-controller-free paged ScrollView on iOS', () => {
    const onPageSelected = jest.fn();
    renderPager(onPageSelected);

    const pager = screen.getByTestId('market-pager');
    expect(mockNativePagerRender).not.toHaveBeenCalled();
    expect(pager.props).toEqual(
      expect.objectContaining({
        bounces: false,
        contentOffset: { x: 320, y: 0 },
        decelerationRate: 'fast',
        directionalLockEnabled: true,
        disableIntervalMomentum: true,
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        snapToAlignment: 'start',
        snapToInterval: 320,
      }),
    );
    expect(pager.props.pagingEnabled).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByTestId('market-pager-page-1').props.style),
    ).toEqual(
      expect.objectContaining({
        flexBasis: 320,
        flexGrow: 0,
        flexShrink: 0,
        height: '100%',
        width: 320,
      }),
    );

    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 480, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
        targetContentOffset: { x: 640, y: 0 },
      },
    });
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 640, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
      },
    });

    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(2);
  });

  it('previews the nearest iOS page at the midpoint without committing it', () => {
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    renderPager(
      onPageSelected,
      createRef<PerpsProMarketPagerHandle>(),
      0,
      onPagePreview,
    );
    const pager = screen.getByTestId('market-pager');

    fireEvent.scroll(pager, {
      nativeEvent: { contentOffset: { x: 159, y: 0 } },
    });
    expect(onPagePreview).not.toHaveBeenCalled();

    fireEvent.scroll(pager, {
      nativeEvent: { contentOffset: { x: 160, y: 0 } },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(1);
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent.scroll(pager, {
      nativeEvent: { contentOffset: { x: 220, y: 0 } },
    });
    expect(onPagePreview).toHaveBeenCalledTimes(1);

    fireEvent.scroll(pager, {
      nativeEvent: { contentOffset: { x: 150, y: 0 } },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(0);
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent.scroll(pager, {
      nativeEvent: { contentOffset: { x: 180, y: 0 } },
    });
    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 320, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
      },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(1);
  });

  it('does not feed a settled page back into the native offset mid-momentum', () => {
    const onPageSelected = jest.fn();
    render(<ControlledPager onPageSelected={onPageSelected} />);
    const pager = screen.getByTestId('controlled-market-pager');

    expect(pager.props.contentOffset).toEqual({ x: 0, y: 0 });
    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 180, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
        targetContentOffset: { x: 320, y: 0 },
      },
    });
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 320, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
      },
    });

    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(1);
    expect(
      screen.getByTestId('controlled-market-pager').props.contentOffset,
    ).toEqual({ x: 0, y: 0 });

    fireEvent(
      screen.getByTestId('controlled-market-pager'),
      'momentumScrollEnd',
      {
        nativeEvent: {
          contentOffset: { x: 320, y: 0 },
          layoutMeasurement: { height: 500, width: 320 },
        },
      },
    );
    expect(onPageSelected).toHaveBeenCalledTimes(1);
  });

  it('commits an exact page on a drag without remaining momentum', () => {
    const onPageSelected = jest.fn();
    renderPager(onPageSelected);
    const pager = screen.getByTestId('market-pager');

    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 640, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
        targetContentOffset: { x: 640, y: 0 },
      },
    });

    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(2);
  });

  it('waits for an animated command to settle and commits a direct jump once', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const onPageSelected = jest.fn();
    const ref = createRef<PerpsProMarketPagerHandle>();
    renderPager(onPageSelected, ref);

    act(() => {
      ref.current?.setPage(2);
    });
    expect(scrollTo).toHaveBeenCalledWith({
      animated: true,
      x: 640,
      y: 0,
    });
    expect(onPageSelected).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('market-pager'), 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 640, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
      },
    });
    expect(onPageSelected).toHaveBeenLastCalledWith(2);

    act(() => {
      ref.current?.setPageWithoutAnimation(0);
    });
    expect(scrollTo).toHaveBeenLastCalledWith({
      animated: false,
      x: 0,
      y: 0,
    });
    expect(onPageSelected).toHaveBeenLastCalledWith(0);
    expect(onPageSelected).toHaveBeenCalledTimes(2);

    scrollTo.mockRestore();
  });

  it('realigns the settled page without animation when page width changes', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const onPageSelected = jest.fn();
    const { rerender } = render(
      <PerpsProMarketPager
        initialPage={1}
        onPagePreview={jest.fn()}
        onPageSelected={onPageSelected}
        pageWidth={320}
        testID="resized-market-pager">
        <View key="all" style={{ flex: 1 }} />
        <View key="new" style={{ flex: 1 }} />
        <View key="defi" style={{ flex: 1 }} />
      </PerpsProMarketPager>,
    );

    rerender(
      <PerpsProMarketPager
        initialPage={1}
        onPagePreview={jest.fn()}
        onPageSelected={onPageSelected}
        pageWidth={375}
        testID="resized-market-pager">
        <View key="all" style={{ flex: 1 }} />
        <View key="new" style={{ flex: 1 }} />
        <View key="defi" style={{ flex: 1 }} />
      </PerpsProMarketPager>,
    );

    expect(scrollTo).toHaveBeenCalledWith({
      animated: false,
      x: 375,
      y: 0,
    });
    expect(onPageSelected).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('resized-market-pager').props.contentOffset,
    ).toEqual({ x: 320, y: 0 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('resized-market-pager-page-1').props.style,
      ),
    ).toEqual(
      expect.objectContaining({
        flexBasis: 375,
        width: 375,
      }),
    );

    scrollTo.mockRestore();
  });

  it('keeps Android on the native PagerView contract', () => {
    mockIsIOS = false;
    const onPagePreview = jest.fn();
    const onPageSelected = jest.fn();
    const ref = renderPager(
      onPageSelected,
      createRef<PerpsProMarketPagerHandle>(),
      1,
      onPagePreview,
    );
    const pager = screen.getByTestId('market-pager');

    expect(mockNativePagerRender).toHaveBeenCalledTimes(1);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 1 },
    });
    expect(onPagePreview).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.5, position: 1 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(2);
    expect(onPageSelected).not.toHaveBeenCalled();
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { offset: 0.49, position: 1 },
    });
    expect(onPagePreview).toHaveBeenLastCalledWith(1);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(onPagePreview).toHaveBeenLastCalledWith(null);
    expect(onPageSelected).toHaveBeenCalledWith(2);

    act(() => {
      ref.current?.setPage(1);
      ref.current?.setPageWithoutAnimation(0);
    });
    expect(mockNativeSetPage).toHaveBeenCalledWith(1);
    expect(mockNativeSetPageWithoutAnimation).toHaveBeenCalledWith(0);
  });
});
