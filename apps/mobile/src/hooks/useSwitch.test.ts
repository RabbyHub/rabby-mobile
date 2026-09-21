import { act, renderHook } from '@testing-library/react-native';

import { useSwitch } from './useSwitch';

describe('useSwitch', () => {
  it('coerces the initial state to boolean', () => {
    const { result: truthyResult } = renderHook(() => useSwitch('1' as any));
    const { result: falsyResult } = renderHook(() => useSwitch(0 as any));

    expect(truthyResult.current.on).toBe(true);
    expect(falsyResult.current.on).toBe(false);
  });

  it('supports turnOn, turnOff, and direct turn', () => {
    const { result } = renderHook(() => useSwitch(false));

    act(() => {
      result.current.turnOn();
    });
    expect(result.current.on).toBe(true);

    act(() => {
      result.current.turn(false);
    });
    expect(result.current.on).toBe(false);

    act(() => {
      result.current.turnOff();
    });
    expect(result.current.on).toBe(false);
  });

  it('toggles once when called once', () => {
    const { result } = renderHook(() => useSwitch(false));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.on).toBe(true);
  });

  it('still toggles only once when toggle is called twice in the same act', () => {
    const { result } = renderHook(() => useSwitch(false));

    act(() => {
      result.current.toggle();
      result.current.toggle();
    });

    expect(result.current.on).toBe(true);
  });
});
