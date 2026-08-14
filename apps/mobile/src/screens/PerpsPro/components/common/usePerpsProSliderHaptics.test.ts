import { act, renderHook } from '@testing-library/react-native';

const mockTriggerImpact = jest.fn();

jest.mock('@/utils/common', () => ({
  triggerImpact: (...args: unknown[]) => mockTriggerImpact(...args),
}));

import {
  changesPerpsProSliderStep,
  PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS,
  usePerpsProSliderHaptics,
} from './usePerpsProSliderHaptics';

describe('changesPerpsProSliderStep', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 1],
    [0, 100],
    [100, 0],
  ])('detects discrete step changes from %p to %p', (previous, next) => {
    expect(
      changesPerpsProSliderStep({
        maximumValue: 100,
        minimumValue: 0,
        nextValue: next,
        previousValue: previous,
        step: 1,
      }),
    ).toBe(true);
  });

  it('uses the configured step for dynamic leverage ranges', () => {
    expect(
      changesPerpsProSliderStep({
        maximumValue: 40,
        minimumValue: 1,
        nextValue: 2,
        previousValue: 1,
        step: 1,
      }),
    ).toBe(true);
    expect(
      changesPerpsProSliderStep({
        maximumValue: 40,
        minimumValue: 1,
        nextValue: 1.4,
        previousValue: 1,
        step: 1,
      }),
    ).toBe(false);
  });

  it.each([
    { maximumValue: 100, minimumValue: 0, nextValue: 0.4, previousValue: 0 },
    { maximumValue: 100, minimumValue: 0, nextValue: 25, previousValue: 25 },
    { maximumValue: 1, minimumValue: 1, nextValue: 1, previousValue: 0 },
    { maximumValue: 100, minimumValue: 0, nextValue: 50, previousValue: NaN },
  ])('does not report a step change for %p', values => {
    expect(
      changesPerpsProSliderStep({
        ...values,
        step: 1,
      }),
    ).toBe(false);
  });
});

describe('usePerpsProSliderHaptics', () => {
  let now = 1_000;

  beforeEach(() => {
    now = 1_000;
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fires once for a fast multi-step jump and disables long iOS fallback', () => {
    const { result } = renderHook(() =>
      usePerpsProSliderHaptics({
        maximumValue: 100,
        minimumValue: 0,
        step: 1,
        value: 0,
      }),
    );

    act(() => {
      result.current.onSlidingStart(0);
      result.current.onValueChange(100);
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
    expect(mockTriggerImpact).toHaveBeenCalledWith({
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
  });

  it('applies the 80ms cooldown without queuing skipped feedback', () => {
    const { result } = renderHook(() =>
      usePerpsProSliderHaptics({
        maximumValue: 100,
        minimumValue: 0,
        step: 1,
        value: 0,
      }),
    );

    act(() => {
      result.current.onSlidingStart(0);
      result.current.onValueChange(1);
      now += PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS - 1;
      result.current.onValueChange(2);
      now += 1;
      result.current.onValueChange(3);
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(2);
  });

  it('fires for every unit during a slow drag', () => {
    const { result } = renderHook(() =>
      usePerpsProSliderHaptics({
        maximumValue: 100,
        minimumValue: 0,
        step: 1,
        value: 0,
      }),
    );

    act(() => {
      result.current.onSlidingStart(0);
      result.current.onValueChange(1);
      now += PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS;
      result.current.onValueChange(2);
      now += PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS;
      result.current.onValueChange(3);
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(3);
  });

  it('does not repeat feedback for duplicate callbacks in the same step', () => {
    const { result } = renderHook(() =>
      usePerpsProSliderHaptics({
        maximumValue: 100,
        minimumValue: 0,
        step: 1,
        value: 0,
      }),
    );

    act(() => {
      result.current.onSlidingStart(0);
      result.current.onValueChange(1);
      now += PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS;
      result.current.onValueChange(1);
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
  });

  it('supports the touch-track callback order and ignores prop-only updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) =>
        usePerpsProSliderHaptics({
          maximumValue: 100,
          minimumValue: 0,
          step: 1,
          value,
        }),
      { initialProps: { value: 0 } },
    );

    rerender({ value: 20 });
    expect(mockTriggerImpact).not.toHaveBeenCalled();

    act(() => {
      result.current.onValueChange(50);
      result.current.onSlidingStart(50);
      result.current.onSlidingComplete();
    });

    expect(mockTriggerImpact).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled', () => {
    const { result } = renderHook(() =>
      usePerpsProSliderHaptics({
        disabled: true,
        maximumValue: 100,
        minimumValue: 0,
        step: 1,
        value: 0,
      }),
    );

    act(() => {
      result.current.onSlidingStart(0);
      result.current.onValueChange(100);
    });

    expect(mockTriggerImpact).not.toHaveBeenCalled();
  });
});
