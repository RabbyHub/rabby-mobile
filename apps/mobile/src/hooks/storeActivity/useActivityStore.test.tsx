import React, { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { createStore } from 'zustand/vanilla';

import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from './StoreActivityProvider';
import { useActivityStore } from './useActivityStore';

type TestState = {
  count: number;
  unrelated: number;
};

function createWrapper(
  scope: ReturnType<typeof createStoreActivityScope>,
  strict = false,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const content = (
      <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
}

describe('useActivityStore', () => {
  it('stops store-driven renders while inactive and catches up once', () => {
    const store = createStore<TestState>(() => ({
      count: 0,
      unrelated: 0,
    }));
    const scope = createStoreActivityScope({ active: true, label: 'home' });
    const selector = jest.fn((state: TestState) => state.count);
    let renderCount = 0;

    const { result, rerender } = renderHook(
      ({ marker }) => {
        renderCount += 1;
        return {
          marker,
          value: useActivityStore(store, selector, Object.is, {
            storeLabel: 'test',
          }),
        };
      },
      {
        initialProps: { marker: 0 },
        wrapper: createWrapper(scope),
      },
    );

    expect(result.current.value).toBe(0);

    act(() => {
      store.setState({ count: 1, unrelated: 0 });
    });

    expect(result.current.value).toBe(1);
    const activeRenderCount = renderCount;

    act(() => {
      scope.setActive(false);
    });
    const selectorCallsAfterBlur = selector.mock.calls.length;

    act(() => {
      for (let count = 2; count <= 100; count += 1) {
        store.setState({ count, unrelated: count });
      }
    });

    expect(result.current.value).toBe(1);
    expect(renderCount).toBe(activeRenderCount);
    expect(selector).toHaveBeenCalledTimes(selectorCallsAfterBlur);

    rerender({ marker: 1 });
    expect(result.current).toEqual({ marker: 1, value: 1 });

    const renderCountBeforeResume = renderCount;
    act(() => {
      scope.setActive(true);
    });

    expect(result.current.value).toBe(100);
    expect(renderCount).toBe(renderCountBeforeResume + 1);
    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({
        label: 'test',
        catchUpCount: 1,
      }),
    ]);
  });

  it('uses selector equality to avoid unrelated renders while active', () => {
    const store = createStore<TestState>(() => ({
      count: 0,
      unrelated: 0,
    }));
    const scope = createStoreActivityScope({ active: true });
    let renderCount = 0;

    const { result } = renderHook(
      () => {
        renderCount += 1;
        return useActivityStore(store, state => state.count);
      },
      {
        wrapper: createWrapper(scope),
      },
    );

    act(() => {
      store.setState({ count: 0, unrelated: 1 });
    });

    expect(result.current).toBe(0);
    expect(renderCount).toBe(1);
  });

  it('keeps subscription counts stable under StrictMode and cleans up', () => {
    const store = createStore<TestState>(() => ({
      count: 0,
      unrelated: 0,
    }));
    const scope = createStoreActivityScope({ active: true });

    const { unmount } = renderHook(
      () => useActivityStore(store, state => state.count),
      {
        wrapper: createWrapper(scope, true),
      },
    );

    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({
        consumerCount: 1,
        sourceSubscribed: true,
      }),
    ]);

    unmount();

    expect(scope.getDiagnostics().stores).toEqual([
      expect.objectContaining({
        consumerCount: 0,
        sourceSubscribed: false,
      }),
    ]);
  });

  it('falls back to an always-active scope outside a provider', () => {
    const store = createStore<TestState>(() => ({
      count: 0,
      unrelated: 0,
    }));
    const { result } = renderHook(() =>
      useActivityStore(store, state => state.count),
    );

    act(() => {
      store.setState({ count: 1, unrelated: 0 });
    });

    expect(result.current).toBe(1);
  });
});
