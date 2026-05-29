import { act, renderHook } from '@testing-library/react-native';

import { useMultiPress } from './tap';

describe('useMultiPress', () => {
  let now = 0;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    now = 1000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('fires only after the required number of quick presses and then resets', () => {
    const onMultiPress = jest.fn();
    const { result } = renderHook(() =>
      useMultiPress({
        requiredPresses: 3,
        timeout: 300,
        onMultiPress,
      }),
    );

    act(() => {
      result.current.handlePress();
      now += 100;
      result.current.handlePress();
    });
    expect(onMultiPress).not.toHaveBeenCalled();

    act(() => {
      now += 100;
      result.current.handlePress();
    });
    expect(onMultiPress).toHaveBeenCalledTimes(1);

    act(() => {
      now += 100;
      result.current.handlePress();
    });
    expect(onMultiPress).toHaveBeenCalledTimes(1);
  });

  it('restarts the press count after the timeout window', () => {
    const onMultiPress = jest.fn();
    const { result } = renderHook(() =>
      useMultiPress({
        requiredPresses: 2,
        timeout: 250,
        onMultiPress,
      }),
    );

    act(() => {
      result.current.handlePress();
      now += 251;
      result.current.handlePress();
    });
    expect(onMultiPress).not.toHaveBeenCalled();

    act(() => {
      now += 100;
      result.current.handlePress();
    });
    expect(onMultiPress).toHaveBeenCalledTimes(1);
  });
});
