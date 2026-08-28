import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { usePerpsProDismissKeyboard } from './usePerpsProDismissKeyboard';

describe('usePerpsProDismissKeyboard', () => {
  const listeners = new Map<string, () => void>();

  beforeEach(() => {
    listeners.clear();
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, listener) => {
        listeners.set(event, listener as () => void);
        return { remove: jest.fn() } as never;
      });
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(jest.fn());
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs immediately on the next frame when the keyboard is hidden', () => {
    const action = jest.fn();
    const { result } = renderHook(() => usePerpsProDismissKeyboard());

    act(() => result.current(action));

    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('waits for keyboardDidHide before running the action', () => {
    const action = jest.fn();
    const { result } = renderHook(() => usePerpsProDismissKeyboard());

    act(() => listeners.get('keyboardDidShow')?.());
    act(() => result.current(action));
    expect(action).not.toHaveBeenCalled();

    act(() => listeners.get('keyboardDidHide')?.());
    expect(action).toHaveBeenCalledTimes(1);
  });
});
