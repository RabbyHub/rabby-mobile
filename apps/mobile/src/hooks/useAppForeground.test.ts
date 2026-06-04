import { act, renderHook } from '@testing-library/react-native';

import { useAppForeground } from './useAppForeground';

const mockAddEventListener = jest.fn();
let mockCurrentState = 'active';

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockCurrentState;
    },
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

describe('useAppForeground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentState = 'active';
  });

  it('calls the latest foreground callback after the app returns from background', () => {
    const remove = jest.fn();
    let listener: ((state: string) => void) | undefined;

    mockAddEventListener.mockImplementation(
      (event: string, nextListener: (state: string) => void) => {
        listener = nextListener;
        return { remove };
      },
    );

    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ onForeground }) => useAppForeground({ onForeground }),
      {
        initialProps: { onForeground: firstCallback },
      },
    );

    rerender({ onForeground: secondCallback });

    act(() => {
      listener?.('background');
      listener?.('active');
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('fires once on mount-time active state when the app was already backgrounded', () => {
    const onForeground = jest.fn();
    let listener: ((state: string) => void) | undefined;
    mockCurrentState = 'background';
    mockAddEventListener.mockImplementation(
      (_event: string, nextListener: (state: string) => void) => {
        listener = nextListener;
        return { remove: jest.fn() };
      },
    );

    renderHook(() => useAppForeground({ onForeground }));

    act(() => {
      listener?.('active');
      listener?.('active');
    });

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe while disabled and resubscribes when enabled', () => {
    const remove = jest.fn();
    const onForeground = jest.fn();
    mockAddEventListener.mockReturnValue({ remove });

    const { rerender } = renderHook(
      ({ enabled }) => useAppForeground({ enabled, onForeground }),
      {
        initialProps: { enabled: false },
      },
    );

    expect(mockAddEventListener).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
