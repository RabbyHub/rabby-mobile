import { act, renderHook } from '@testing-library/react-native';

import useAutoFocusInput from './useAutoFocusInput';

const mockAddListener = jest.fn();
const mockUseNavigation = jest.fn(() => ({
  addListener: mockAddListener,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockUseNavigation(),
}));

describe('useAutoFocusInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers a transitionEnd listener after the input ref is initialized', () => {
    const unsubscribe = jest.fn();
    mockAddListener.mockReturnValue(unsubscribe);

    const { result } = renderHook(() => useAutoFocusInput(false));

    const focus = jest.fn();
    act(() => {
      result.current.inputCallbackRef({
        focus,
      });
    });

    expect(mockAddListener).toHaveBeenCalledWith(
      'transitionEnd',
      expect.any(Function),
    );
    expect(result.current.inputRef.current).toEqual({ focus });
  });

  it('focuses the input after a non-closing transition ends', async () => {
    const unsubscribe = jest.fn();
    mockAddListener.mockReturnValue(unsubscribe);

    const { result } = renderHook(() => useAutoFocusInput(false));
    const focus = jest.fn();

    act(() => {
      result.current.inputCallbackRef({
        focus,
      });
    });

    const handler = mockAddListener.mock.calls[0]?.[1];

    act(() => {
      handler({
        data: {
          closing: false,
        },
      });
    });

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('does not register autofocus behavior when disabled', () => {
    renderHook(() => useAutoFocusInput(true));

    expect(mockAddListener).not.toHaveBeenCalled();
  });
});
