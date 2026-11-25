import { renderHook } from '@testing-library/react-native';
import { Animated, Easing } from 'react-native';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { usePerpsProOrderBookDepthAnimation } from './usePerpsProOrderBookDepthAnimation';

const initialProps = {
  animationIdentity: 'BTC:5:null|both|6|content',
  price: '100',
  targetPercent: 50,
};

describe('usePerpsProOrderBookDepthAnimation', () => {
  let timing: jest.SpyInstance<ReturnType<typeof Animated.timing>>;
  let setValue: jest.SpyInstance;
  let stopAnimation: jest.SpyInstance;
  const start = jest.fn();

  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
    start.mockClear();
    timing = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop: jest.fn(),
      reset: jest.fn(),
    });
    setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    stopAnimation = jest.spyOn(Animated.Value.prototype, 'stopAnimation');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [0, 0],
    [25, 0.25],
    [100, 1],
    [-1, 0],
    [101, 1],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])('snaps initial percent %s to native scale %s', (percent, scale) => {
    const { result } = renderHook(usePerpsProOrderBookDepthAnimation, {
      initialProps: { ...initialProps, targetPercent: percent },
    });

    expect(result.current).toBeInstanceOf(Animated.Value);
    expect(setValue).toHaveBeenCalledWith(scale);
    expect(timing).not.toHaveBeenCalled();
  });

  it('uses native non-interaction timing only for a retained price target change', () => {
    const { result, rerender } = renderHook(
      usePerpsProOrderBookDepthAnimation,
      { initialProps },
    );
    const scale = result.current;
    setValue.mockClear();
    rerender({ ...initialProps, targetPercent: 75 });

    expect(result.current).toBe(scale);
    expect(timing).toHaveBeenCalledWith(scale, {
      toValue: 0.75,
      duration: 250,
      easing: expect.any(Function),
      useNativeDriver: true,
      isInteraction: false,
    });
    const easing = timing.mock.calls[0][1].easing;
    const expectedEasing = Easing.bezier(0, 0, 0.2, 1);
    [0, 0.25, 0.5, 0.75, 1].forEach(progress => {
      expect(easing(progress)).toBeCloseTo(expectedEasing(progress));
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(setValue).not.toHaveBeenCalled();

    rerender({ ...initialProps, targetPercent: 75 });
    expect(timing).toHaveBeenCalledTimes(1);
    rerender({ ...initialProps, targetPercent: 25 });
    expect(timing).toHaveBeenLastCalledWith(
      scale,
      expect.objectContaining({ toValue: 0.25 }),
    );
    expect(setValue).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('snaps changed price or presentation identities without an animation', () => {
    const { rerender } = renderHook(usePerpsProOrderBookDepthAnimation, {
      initialProps,
    });
    rerender({ ...initialProps, targetPercent: 75 });
    setValue.mockClear();

    rerender({ ...initialProps, price: '101', targetPercent: 25 });
    expect(setValue).toHaveBeenLastCalledWith(0.25);
    rerender({
      ...initialProps,
      animationIdentity: 'ETH:5:null|both|6|content',
      price: '101',
      targetPercent: 25,
    });
    expect(setValue).toHaveBeenCalledTimes(2);
    expect(setValue).toHaveBeenLastCalledWith(0.25);
    expect(timing).toHaveBeenCalledTimes(1);
  });

  it('does not retarget when different inputs normalize to the same scale', () => {
    const { rerender } = renderHook(usePerpsProOrderBookDepthAnimation, {
      initialProps: { ...initialProps, targetPercent: 100 },
    });
    setValue.mockClear();
    rerender({ ...initialProps, targetPercent: 101 });
    expect(setValue).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it('snaps retained target changes with the system reduced-motion setting', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { rerender } = renderHook(usePerpsProOrderBookDepthAnimation, {
      initialProps,
    });
    setValue.mockClear();
    rerender({ ...initialProps, targetPercent: 75 });
    expect(setValue).toHaveBeenCalledWith(0.75);
    expect(timing).not.toHaveBeenCalled();
  });

  it('stops its animation on unmount without scheduling another target', () => {
    const { rerender, unmount } = renderHook(
      usePerpsProOrderBookDepthAnimation,
      { initialProps },
    );
    rerender({ ...initialProps, targetPercent: 75 });
    stopAnimation.mockClear();
    setValue.mockClear();
    unmount();
    expect(stopAnimation).toHaveBeenCalledTimes(1);
    expect(setValue).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledTimes(1);
  });
});
