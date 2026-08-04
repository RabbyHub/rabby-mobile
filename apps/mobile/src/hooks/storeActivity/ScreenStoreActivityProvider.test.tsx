import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { createStore } from 'zustand/vanilla';

import { ScreenStoreActivityProvider } from './ScreenStoreActivityProvider';
import { useActivityStore } from './useActivityStore';

const mockNavigationListeners: Partial<Record<'focus' | 'blur', () => void>> =
  {};
const mockNavigationUnsubscribers = {
  focus: jest.fn(),
  blur: jest.fn(),
};
const mockNavigation = {
  focused: true,
  isFocused: jest.fn(() => mockNavigation.focused),
  addListener: jest.fn((event: 'focus' | 'blur', listener: () => void) => {
    mockNavigationListeners[event] = listener;
    return mockNavigationUnsubscribers[event];
  }),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

describe('ScreenStoreActivityProvider', () => {
  beforeEach(() => {
    mockNavigation.focused = true;
    mockNavigation.isFocused.mockClear();
    mockNavigation.addListener.mockClear();
    mockNavigationUnsubscribers.focus.mockClear();
    mockNavigationUnsubscribers.blur.mockClear();
    delete mockNavigationListeners.focus;
    delete mockNavigationListeners.blur;
  });

  it('pauses and resumes store publication from navigation events', () => {
    const store = createStore(() => ({ count: 0 }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ScreenStoreActivityProvider label="home">
        {children}
      </ScreenStoreActivityProvider>
    );
    const { result, unmount } = renderHook(
      () => useActivityStore(store, state => state.count),
      { wrapper },
    );

    expect(result.current).toBe(0);

    act(() => {
      mockNavigation.focused = false;
      mockNavigationListeners.blur?.();
      store.setState({ count: 1 });
    });

    expect(result.current).toBe(0);

    act(() => {
      mockNavigation.focused = true;
      mockNavigationListeners.focus?.();
    });

    expect(result.current).toBe(1);

    unmount();
    expect(mockNavigationUnsubscribers.focus).toHaveBeenCalledTimes(1);
    expect(mockNavigationUnsubscribers.blur).toHaveBeenCalledTimes(1);
  });
});
