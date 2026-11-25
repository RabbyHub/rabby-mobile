import { Skeleton } from '@rneui/base/dist/Skeleton/Skeleton';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Loop = {
  start: jest.Mock;
  stop: jest.Mock;
  reset: jest.Mock;
};

// Component unit contract for the installed dependency, not a replacement
// Skeleton. Only the native animation execution boundary is stubbed.
describe('RNEUI Skeleton animation lifecycle', () => {
  let loops: Loop[];

  beforeEach(() => {
    loops = [];
    jest.spyOn(Animated, 'timing');
    jest.spyOn(Animated.Value.prototype, 'setValue');
    jest.spyOn(Animated, 'loop').mockImplementation(() => {
      const loop = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
      loops.push(loop);
      return loop;
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('does not create an animation for none and keeps the static container', () => {
    render(
      <Skeleton
        animation="none"
        circle
        height={18}
        style={{ backgroundColor: '#123456', borderRadius: 6 }}
        width="40%"
      />,
    );

    const container = screen.getByTestId('RNE__Skeleton');
    expect(container.props.accessible).toBe(false);
    expect(container.props.accessibilityLabel).toBe('loading...');
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({
      width: '40%',
      height: 18,
      backgroundColor: '#123456',
      borderRadius: 6,
      overflow: 'hidden',
    });
    expect(screen.UNSAFE_queryAllByType(Animated.View)).toHaveLength(0);
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(Animated.loop).not.toHaveBeenCalled();
    expect(Animated.Value.prototype.setValue).not.toHaveBeenCalled();
  });

  it.each([undefined, 'pulse', 'wave'] as const)(
    'preserves the original timing for animation=%s',
    animation => {
      render(<Skeleton animation={animation} height={8} width={24} />);

      expect(Animated.timing).toHaveBeenCalledTimes(1);
      expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), {
        toValue: 2,
        delay: 400,
        duration: 1500,
        useNativeDriver: true,
      });
      expect(Animated.Value.prototype.setValue).toHaveBeenCalledWith(0);
      expect(loops).toHaveLength(1);
      expect(loops[0].start).toHaveBeenCalledTimes(1);
      expect(screen.UNSAFE_queryAllByType(Animated.View)).toHaveLength(1);
    },
  );

  it.each(['pulse', 'wave'] as const)(
    'stops its loop when animation=%s unmounts',
    animation => {
      const { unmount } = render(<Skeleton animation={animation} />);
      unmount();
      expect(loops[0].stop).toHaveBeenCalledTimes(1);
    },
  );

  it('starts and stops once across none transitions without remounting the container', () => {
    const { rerender, unmount } = render(<Skeleton animation="none" />);
    const container = screen.getByTestId('RNE__Skeleton');
    expect(loops).toHaveLength(0);

    rerender(<Skeleton animation="pulse" />);
    expect(screen.getByTestId('RNE__Skeleton')).toBe(container);
    expect(loops).toHaveLength(1);
    expect(loops[0].start).toHaveBeenCalledTimes(1);

    rerender(<Skeleton animation="none" />);
    expect(loops[0].stop).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_queryAllByType(Animated.View)).toHaveLength(0);
    rerender(<Skeleton animation="none" width={48} />);
    expect(loops).toHaveLength(1);
    expect(loops[0].stop).toHaveBeenCalledTimes(1);

    rerender(<Skeleton animation="wave" />);
    expect(loops).toHaveLength(2);
    expect(loops[1].start).toHaveBeenCalledTimes(1);
    expect(Animated.Value.prototype.setValue).toHaveBeenCalledTimes(2);
    unmount();
    expect(loops[0].stop).toHaveBeenCalledTimes(1);
    expect(loops[1].stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the running phase across pulse and wave changes and layout updates', () => {
    const { rerender } = render(<Skeleton animation="pulse" width={24} />);
    const setValue = jest.mocked(Animated.Value.prototype.setValue);
    setValue.mockClear();

    rerender(
      <Skeleton animation="wave" skeletonStyle={{ height: 7 }} width={48} />,
    );
    fireEvent(screen.getByTestId('RNE__Skeleton'), 'layout', {
      nativeEvent: { layout: { width: 48 } },
    });
    rerender(<Skeleton animation="pulse" width={48} />);

    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(loops).toHaveLength(1);
    expect(loops[0].start).toHaveBeenCalledTimes(1);
    expect(loops[0].stop).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('keeps gradient and skeleton styles on the animated child', () => {
    const Gradient = (props: object) => <View {...props} testID="gradient" />;
    render(
      <Skeleton
        animation="wave"
        height={12}
        LinearGradientComponent={Gradient}
        skeletonStyle={{ height: 9, backgroundColor: '#abcdef' }}
        width={36}
      />,
    );

    const animated = screen.UNSAFE_getByType(Animated.View);
    expect(StyleSheet.flatten(animated.props.style)).toMatchObject({
      height: 9,
      backgroundColor: '#abcdef',
    });
    expect(screen.getByTestId('gradient').props).toMatchObject({
      colors: expect.arrayContaining([expect.any(String)]),
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
    });
  });
});
