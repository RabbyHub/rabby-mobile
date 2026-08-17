import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { createRef } from 'react';
import { StyleSheet, View } from 'react-native';

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

const renderPager = (
  onPageSelected = jest.fn(),
  ref = createRef<PerpsProMarketPagerHandle>(),
) => {
  render(
    <PerpsProMarketPager
      initialPage={1}
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
        directionalLockEnabled: true,
        horizontal: true,
        pagingEnabled: true,
        showsHorizontalScrollIndicator: false,
      }),
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('page-new').props.style),
    ).toEqual(
      expect.objectContaining({
        flex: 1,
        height: '100%',
        width: 320,
      }),
    );

    fireEvent(pager, 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 320, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
        targetContentOffset: { x: 640, y: 0 },
      },
    });
    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 640, y: 0 },
        layoutMeasurement: { height: 500, width: 320 },
      },
    });

    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith(2);
  });

  it('keeps Android on the native PagerView contract', () => {
    mockIsIOS = false;
    const onPageSelected = jest.fn();
    const ref = renderPager(onPageSelected);
    const pager = screen.getByTestId('market-pager');

    expect(mockNativePagerRender).toHaveBeenCalledTimes(1);
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 2 } });
    expect(onPageSelected).toHaveBeenCalledWith(2);

    act(() => {
      ref.current?.setPage(1);
      ref.current?.setPageWithoutAnimation(0);
    });
    expect(mockNativeSetPage).toHaveBeenCalledWith(1);
    expect(mockNativeSetPageWithoutAnimation).toHaveBeenCalledWith(0);
  });
});
