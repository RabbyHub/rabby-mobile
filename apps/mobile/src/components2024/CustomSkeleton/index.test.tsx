import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';

import { CustomSkeleton } from './index';

jest.mock('@rneui/themed', () => ({
  Skeleton: require('react-native').View,
}));

type Pulse = {
  start: jest.Mock;
  stop: jest.Mock;
  reset: jest.Mock;
};

describe('CustomSkeleton outer pulse', () => {
  let pulses: Pulse[];

  beforeEach(() => {
    pulses = [];
    jest.spyOn(Animated, 'timing');
    jest.spyOn(Animated, 'loop').mockImplementation(() => {
      const pulse = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      pulses.push(pulse);
      return pulse;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves the default native pulse and stops it on unmount', () => {
    const { unmount } = render(
      <CustomSkeleton height={8} testID="skeleton" width={24} />,
    );

    expect(Animated.timing).toHaveBeenNthCalledWith(
      1,
      expect.any(Animated.Value),
      { toValue: 1, duration: 300, useNativeDriver: true },
    );
    expect(Animated.timing).toHaveBeenNthCalledWith(
      2,
      expect.any(Animated.Value),
      { toValue: 0.3, duration: 300, useNativeDriver: true },
    );
    expect(pulses).toHaveLength(1);
    expect(pulses[0].start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('skeleton').props).toMatchObject({
      height: 8,
      width: 24,
    });
    expect(screen.getByTestId('skeleton').props.pulseEnabled).toBeUndefined();

    unmount();
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the inner skeleton and dimensions without starting an inactive pulse', () => {
    render(
      <CustomSkeleton
        animation="none"
        height={8}
        pulseEnabled={false}
        style={{ borderRadius: 4 }}
        testID="skeleton"
        width="48%"
      />,
    );

    expect(Animated.timing).not.toHaveBeenCalled();
    expect(Animated.loop).not.toHaveBeenCalled();
    expect(screen.getByTestId('skeleton').props).toMatchObject({
      animation: 'none',
      height: 8,
      style: { borderRadius: 4 },
      width: '48%',
    });
    expect(screen.getByTestId('skeleton').props.pulseEnabled).toBeUndefined();
  });

  it('stops and resumes once per activity change without remounting the inner skeleton', () => {
    const content = (pulseEnabled: boolean) => (
      <CustomSkeleton
        height={8}
        pulseEnabled={pulseEnabled}
        testID="skeleton"
        width={24}
      />
    );
    const { rerender, unmount } = render(content(true));
    const inner = screen.getByTestId('skeleton');

    rerender(content(false));
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('skeleton')).toBe(inner);
    rerender(content(false));
    expect(pulses).toHaveLength(1);
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);

    rerender(content(true));
    expect(pulses).toHaveLength(2);
    expect(pulses[1].start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('skeleton')).toBe(inner);
    rerender(content(true));
    expect(pulses).toHaveLength(2);

    unmount();
    expect(pulses[0].stop).toHaveBeenCalledTimes(1);
    expect(pulses[1].stop).toHaveBeenCalledTimes(1);
  });

  it('uses the current speed when enabled after inactive prop updates', () => {
    const { rerender } = render(
      <CustomSkeleton pulseEnabled={false} speed={200} />,
    );
    rerender(<CustomSkeleton pulseEnabled={false} speed={500} />);
    expect(Animated.loop).not.toHaveBeenCalled();

    rerender(<CustomSkeleton pulseEnabled speed={500} />);
    expect(Animated.timing).toHaveBeenNthCalledWith(
      1,
      expect.any(Animated.Value),
      { toValue: 1, duration: 500, useNativeDriver: true },
    );
    expect(Animated.timing).toHaveBeenNthCalledWith(
      2,
      expect.any(Animated.Value),
      { toValue: 0.3, duration: 500, useNativeDriver: true },
    );
    expect(pulses).toHaveLength(1);
  });
});
