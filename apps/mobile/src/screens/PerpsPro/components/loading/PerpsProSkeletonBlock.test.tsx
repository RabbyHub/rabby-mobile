import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';

import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';

import { PerpsProMarketBarSkeleton } from './PerpsProSceneSkeleton';
import { PerpsProSkeletonBlock } from './PerpsProSkeletonBlock';

jest.mock('@rneui/themed', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    Skeleton: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'custom-skeleton',
      }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({
      colors2024: {
        'neutral-bg-1': '#ffffff',
        'neutral-info': '#c5c5cf',
      },
    }),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('../orderbook/PerpsProOrderBookSkeleton', () => ({
  PerpsProOrderBookSkeleton: require('react-native').View,
}));

describe('PerpsProSkeletonBlock', () => {
  let pulses: { start: jest.Mock; stop: jest.Mock; reset: jest.Mock }[];

  beforeEach(() => {
    pulses = [];
    jest.spyOn(Animated, 'loop').mockImplementation(() => {
      const pulse = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      pulses.push(pulse);
      return pulse;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps one pulse animation and uses a visible token-backed base', () => {
    render(
      <PerpsProSkeletonBlock
        height={8}
        style={{ borderRadius: 4 }}
        width={24}
      />,
    );

    const skeleton = screen.getByTestId('custom-skeleton');
    expect(skeleton.props.animation).toBe('none');
    expect(StyleSheet.flatten(skeleton.props.style)).toMatchObject({
      backgroundColor: '#c5c5cf',
      borderRadius: 4,
    });
    expect(pulses).toHaveLength(1);
    expect(pulses[0].start).toHaveBeenCalledTimes(1);
  });

  it('reacts to the same activity scope through a memoized parent and cleans up', () => {
    const scope = createStoreActivityScope({ active: false });
    const parentRender = jest.fn();
    const MemoParent = React.memo(function MemoParent() {
      parentRender();
      return <PerpsProSkeletonBlock height={8} width={24} />;
    });
    const { unmount } = render(
      <StoreActivityProvider scope={scope}>
        <MemoParent />
      </StoreActivityProvider>,
    );

    expect(pulses).toHaveLength(0);
    const inner = screen.getByTestId('custom-skeleton');
    act(() => scope.setActive(true));
    expect(pulses).toHaveLength(1);
    expect(pulses[0].start).toHaveBeenCalledTimes(1);
    expect(parentRender).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('custom-skeleton')).toBe(inner);

    act(() => scope.setActive(false));
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);
    act(() => scope.setActive(false));
    expect(pulses).toHaveLength(1);
    act(() => scope.setActive(true));
    expect(pulses).toHaveLength(2);
    expect(pulses[1].start).toHaveBeenCalledTimes(1);
    expect(parentRender).toHaveBeenCalledTimes(1);

    unmount();
    expect(pulses[1].stop).toHaveBeenCalledTimes(1);
    act(() => scope.setActive(false));
    act(() => scope.setActive(true));
    expect(pulses).toHaveLength(2);
    scope.dispose();
  });

  it('switches activity subscriptions when the provider scope changes', () => {
    const first = createStoreActivityScope({ active: true });
    const second = createStoreActivityScope({ active: false });
    const { rerender, unmount } = render(
      <StoreActivityProvider scope={first}>
        <PerpsProSkeletonBlock height={8} width={24} />
      </StoreActivityProvider>,
    );
    expect(pulses).toHaveLength(1);

    rerender(
      <StoreActivityProvider scope={second}>
        <PerpsProSkeletonBlock height={8} width={24} />
      </StoreActivityProvider>,
    );
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);
    act(() => first.setActive(false));
    act(() => first.setActive(true));
    expect(pulses).toHaveLength(1);
    act(() => second.setActive(true));
    expect(pulses).toHaveLength(2);

    unmount();
    expect(pulses[1].stop).toHaveBeenCalledTimes(1);
    first.dispose();
    second.dispose();
  });

  it('leaves the header divider as the only line above the skeleton market bar', () => {
    render(<PerpsProMarketBarSkeleton />);

    const style = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-bar-skeleton').props.style,
    );
    expect(style).toMatchObject({ backgroundColor: '#ffffff', height: 40 });
    expect(style.borderTopWidth).toBeUndefined();
  });
});
