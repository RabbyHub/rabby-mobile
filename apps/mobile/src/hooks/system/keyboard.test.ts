import { act, renderHook } from '@testing-library/react-native';
import { useOnKeyboardDismissed } from './keyboard';

const mockAddListener = jest.fn();
let mockIsAndroid = true;

jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockIsAndroid;
  },
}));

jest.mock('react-native', () => ({
  Keyboard: {
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

describe('useOnKeyboardDismissed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsAndroid = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('subscribes to keyboardDidHide on android and removes the listener on unmount', () => {
    const remove = jest.fn();
    const subscription = jest.fn();
    let capturedListener:
      | ((evt: { endCoordinates?: { height: number } }) => void)
      | undefined;

    mockAddListener.mockImplementation(
      (
        event: string,
        listener: (evt: { endCoordinates?: { height: number } }) => void,
      ) => {
        capturedListener = listener;
        return { remove };
      },
    );

    const { unmount } = renderHook(() => useOnKeyboardDismissed(subscription));

    expect(mockAddListener).toHaveBeenCalledWith(
      'keyboardDidHide',
      expect.any(Function),
    );

    act(() => {
      capturedListener?.({ endCoordinates: { height: 0 } });
    });

    expect(subscription).toHaveBeenCalledWith({
      endCoordinates: { height: 0 },
    });

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('delays keyboardWillHide callbacks on ios by 350ms', () => {
    const subscription = jest.fn();
    let capturedListener: ((evt: { duration: number }) => void) | undefined;
    mockIsAndroid = false;

    mockAddListener.mockImplementation(
      (event: string, listener: (evt: { duration: number }) => void) => {
        capturedListener = listener;
        return { remove: jest.fn() };
      },
    );

    renderHook(() => useOnKeyboardDismissed(subscription));

    expect(mockAddListener).toHaveBeenCalledWith(
      'keyboardWillHide',
      expect.any(Function),
    );

    act(() => {
      capturedListener?.({ duration: 100 });
    });

    expect(subscription).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(349);
    });

    expect(subscription).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(subscription).toHaveBeenCalledWith({ duration: 100 });
  });
});
