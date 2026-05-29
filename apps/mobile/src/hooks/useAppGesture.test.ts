import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { useHandleBackPressClosable } from './useAppGesture';

const mockAddEventListener = jest.fn();

jest.mock('react-native', () => ({
  BackHandler: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

describe('useHandleBackPressClosable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true from the hardware handler when requestBack rejects closing', () => {
    const remove = jest.fn();
    let handler: (() => boolean) | undefined;
    const requestBack = jest.fn(() => false);
    mockAddEventListener.mockImplementation(
      (event: string, nextHandler: () => boolean) => {
        handler = nextHandler;
        return { remove };
      },
    );

    const { result } = renderHook(() =>
      useHandleBackPressClosable(requestBack),
    );
    const dispose = result.current.onHardwareBackHandler();

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
    expect(handler?.()).toBe(true);
    expect(requestBack).toHaveBeenCalledTimes(1);

    dispose();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('uses the ref value when deciding whether the hardware event can bubble', () => {
    let handler: (() => boolean) | undefined;
    const closableRef = React.createRef<boolean>();
    closableRef.current = true;
    mockAddEventListener.mockImplementation(
      (_event: string, nextHandler: () => boolean) => {
        handler = nextHandler;
        return { remove: jest.fn() };
      },
    );

    const { result } = renderHook(() =>
      useHandleBackPressClosable(closableRef),
    );

    result.current.onHardwareBackHandler();

    expect(handler?.()).toBe(false);

    closableRef.current = false;

    expect(handler?.()).toBe(true);
  });

  it('subscribes automatically when enabled and removes the listener when disabled', () => {
    const remove = jest.fn();
    mockAddEventListener.mockReturnValue({ remove });

    const { rerender, unmount } = renderHook(
      ({ autoEffectEnabled }) =>
        useHandleBackPressClosable(() => true, { autoEffectEnabled }),
      {
        initialProps: { autoEffectEnabled: true },
      },
    );

    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    rerender({ autoEffectEnabled: false });

    expect(remove).toHaveBeenCalledTimes(1);

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
