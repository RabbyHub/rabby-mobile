import { renderHook } from '@testing-library/react-native';
import { Animated, Easing } from 'react-native';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

import { usePerpsProOrderBookPercentAnimation } from './usePerpsProOrderBookPercentAnimation';

const initialProps = {
  animationIdentity: 'BTC:5:null|both|6|content',
  hasValue: true,
  targetPercent: 50,
  valueIdentity: 'buy-ratio',
};

describe('usePerpsProOrderBookPercentAnimation', () => {
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
    [25, 25],
    [100, 100],
    [-1, 0],
    [101, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])('snaps initial percent %s to native percent %s', (input, expected) => {
    const { result } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps: { ...initialProps, targetPercent: input },
    });

    expect(result.current).toBeInstanceOf(Animated.Value);
    expect(setValue).toHaveBeenCalledWith(expected);
    expect(timing).not.toHaveBeenCalled();
  });

  it('retargets one native value without resetting or asynchronously stopping it', () => {
    const { result, rerender } = renderHook(
      usePerpsProOrderBookPercentAnimation,
      { initialProps },
    );
    const percent = result.current;
    setValue.mockClear();
    stopAnimation.mockClear();
    rerender({ ...initialProps, targetPercent: 75 });

    expect(result.current).toBe(percent);
    expect(timing).toHaveBeenCalledWith(percent, {
      toValue: 75,
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

    rerender({ ...initialProps, targetPercent: 75 });
    expect(timing).toHaveBeenCalledTimes(1);
    rerender({ ...initialProps, targetPercent: 25 });
    expect(timing).toHaveBeenLastCalledWith(
      percent,
      expect.objectContaining({ toValue: 25 }),
    );
    expect(start).toHaveBeenCalledTimes(2);
    expect(setValue).not.toHaveBeenCalled();
    expect(stopAnimation).not.toHaveBeenCalled();
  });

  it.each([
    ['animationIdentity', 'ETH:5:null|both|6|content'],
    ['animationIdentity', 'BTC:4:null|both|6|content'],
    ['animationIdentity', 'BTC:5:null|asks|12|content'],
    ['animationIdentity', 'BTC:5:null|both|6|skeleton'],
    ['valueIdentity', 'sell-ratio'],
  ])('snaps an in-flight target when %s becomes %s', (field, identity) => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps,
    });
    rerender({ ...initialProps, targetPercent: 75 });
    setValue.mockClear();

    // The same numeric target still has to cancel the old presentation.
    rerender({ ...initialProps, [field]: identity, targetPercent: 75 });
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenLastCalledWith(75);
    expect(timing).toHaveBeenCalledTimes(1);

    rerender({ ...initialProps, [field]: identity, targetPercent: 25 });
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing).toHaveBeenLastCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 25 }),
    );
  });

  it('snaps unavailable values and the first restored value before animating again', () => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps,
    });
    rerender({ ...initialProps, targetPercent: 75 });
    setValue.mockClear();

    rerender({ ...initialProps, hasValue: false, targetPercent: 0 });
    expect(setValue).toHaveBeenLastCalledWith(0);
    rerender({ ...initialProps, hasValue: false, targetPercent: 25 });
    expect(setValue).toHaveBeenLastCalledWith(25);
    rerender({ ...initialProps, hasValue: true, targetPercent: 25 });
    expect(setValue).toHaveBeenCalledTimes(3);
    expect(setValue).toHaveBeenLastCalledWith(25);
    expect(timing).toHaveBeenCalledTimes(1);

    rerender({ ...initialProps, targetPercent: 50 });
    expect(timing).toHaveBeenCalledTimes(2);
  });

  it('snaps the first available value after mounting without a value', () => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps: { ...initialProps, hasValue: false, targetPercent: 0 },
    });
    setValue.mockClear();
    rerender({ ...initialProps, hasValue: true, targetPercent: 75 });
    expect(setValue).toHaveBeenCalledWith(75);
    expect(timing).not.toHaveBeenCalled();
  });

  it.each([
    [100, 101],
    [0, -1],
    [Number.NaN, Number.POSITIVE_INFINITY],
  ])('does not retarget equivalent normalized values %s and %s', (from, to) => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps: { ...initialProps, targetPercent: from },
    });
    setValue.mockClear();
    rerender({ ...initialProps, targetPercent: to });
    expect(setValue).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
  });

  it('normalizes a changed animation target before passing it to native timing', () => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps,
    });
    rerender({ ...initialProps, targetPercent: 101 });
    expect(timing).toHaveBeenLastCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 100 }),
    );
    rerender({ ...initialProps, targetPercent: Number.NaN });
    expect(timing).toHaveBeenLastCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({ toValue: 0 }),
    );
  });

  it('snaps retained target changes when reduced motion is enabled', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps,
    });
    setValue.mockClear();
    rerender({ ...initialProps, targetPercent: 75 });
    expect(setValue).toHaveBeenCalledWith(75);
    expect(timing).not.toHaveBeenCalled();
  });

  it('snaps an in-flight target if reduced motion changes on a later render', () => {
    const { rerender } = renderHook(usePerpsProOrderBookPercentAnimation, {
      initialProps,
    });
    rerender({ ...initialProps, targetPercent: 75 });
    setValue.mockClear();

    // The mock changes a hook input, not the real OS setting subscription.
    mockUseReducedMotion.mockReturnValue(true);
    rerender({ ...initialProps, targetPercent: 75 });
    expect(setValue).toHaveBeenCalledWith(75);
    expect(timing).toHaveBeenCalledTimes(1);

    mockUseReducedMotion.mockReturnValue(false);
    rerender({ ...initialProps, targetPercent: 75 });
    expect(timing).toHaveBeenCalledTimes(1);
    rerender({ ...initialProps, targetPercent: 25 });
    expect(timing).toHaveBeenCalledTimes(2);
  });

  it('stops on unmount without scheduling another target', () => {
    const { rerender, unmount } = renderHook(
      usePerpsProOrderBookPercentAnimation,
      { initialProps },
    );
    rerender({ ...initialProps, targetPercent: 75 });
    stopAnimation.mockClear();
    setValue.mockClear();

    unmount();
    expect(stopAnimation).toHaveBeenCalledTimes(1);
    expect(stopAnimation).toHaveBeenCalledWith();
    expect(setValue).not.toHaveBeenCalled();
    expect(timing).toHaveBeenCalledTimes(1);
  });
});
