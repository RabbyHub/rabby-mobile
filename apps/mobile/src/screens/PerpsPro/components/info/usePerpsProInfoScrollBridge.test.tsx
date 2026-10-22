import { act, renderHook } from '@testing-library/react-native';
import type { PerpsProInfoTab } from '@/core/services/perpsService';

type MockNativeList = { tag: number };
type MockRefObserver = (tag: number | null) => (() => void) | undefined;
type MockAnimatedRef = {
  (component: MockNativeList | null): void;
  current: MockNativeList | null;
  observe: (observer: MockRefObserver) => () => void;
};

const mockScrollListeners = new Map<number, Set<(offset: number) => void>>();
const mockScrollTo = jest.fn();

jest.mock('react-native-reanimated', () => {
  const React = require('react') as typeof import('react');
  return {
    runOnUI: (callback: (...args: unknown[]) => unknown) => callback,
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedRef: () => {
      const stableRef = React.useRef<MockAnimatedRef | null>(null);
      if (!stableRef.current) {
        const observers = new Map<MockRefObserver, (() => void) | undefined>();
        const ref: MockAnimatedRef = Object.assign(
          (component: MockNativeList | null) => {
            // Preserve the real native boundary's detach behavior: null does
            // not clear the tag or notify observers. Active-only subscription
            // cleanup must stop the previous tab from following this list.
            if (!component) {
              return;
            }
            ref.current = component;
            observers.forEach((cleanup, observer) => {
              cleanup?.();
              observers.set(observer, observer(component.tag));
            });
          },
          {
            current: null as MockNativeList | null,
            observe: (observer: MockRefObserver) => {
              observers.set(observer, observer(ref.current?.tag ?? null));
              return () => {
                observers.get(observer)?.();
                observers.delete(observer);
              };
            },
          },
        );
        stableRef.current = ref;
      }
      return stableRef.current;
    },
    useScrollViewOffset: (
      ref: MockAnimatedRef | null,
      providedOffset: { value: number },
    ) => {
      // The real hook binds its first providedOffset for its whole lifetime.
      const offset = React.useRef(providedOffset).current;
      React.useEffect(() => {
        if (!ref) {
          return;
        }
        return ref.observe(tag => {
          if (tag == null) {
            return;
          }
          const listeners =
            mockScrollListeners.get(tag) ?? new Set<(offset: number) => void>();
          const listener = (value: number) => {
            offset.value = value;
          };
          listeners.add(listener);
          mockScrollListeners.set(tag, listeners);
          return () => {
            listeners.delete(listener);
          };
        });
      }, [offset, ref]);
      return offset;
    },
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
  };
});

import { usePerpsProInfoScrollBridge } from './usePerpsProInfoScrollBridge';

const nativeList = { tag: 17 };
const emitNativeScroll = (offset: number) => {
  act(() => {
    mockScrollListeners
      .get(nativeList.tag)
      ?.forEach(listener => listener(offset));
  });
};

describe('usePerpsProInfoScrollBridge single-list ownership', () => {
  beforeEach(() => {
    mockScrollListeners.clear();
    mockScrollTo.mockClear();
  });

  it('defaults to positions and keeps only the active tab subscribed', () => {
    const { result, unmount } = renderHook(() => usePerpsProInfoScrollBridge());
    const controller = result.current;
    act(() => {
      // Stale native tags may remain on refs from earlier attachments.
      controller.targets.forEach(target => target.ref(nativeList as never));
    });

    expect(controller.activeIndex.value).toBe(0);
    expect(mockScrollListeners.get(nativeList.tag)?.size).toBe(1);
    emitNativeScroll(180);
    expect(controller.targets.map(target => target.offset.value)).toEqual([
      180, 0, 0,
    ]);
    unmount();
    expect(mockScrollListeners.get(nativeList.tag)?.size).toBe(0);
  });

  it('seeds the shared offset before switching owners without copying maxOffset', () => {
    const { result, rerender, unmount } = renderHook(
      ({ tab }: { tab: PerpsProInfoTab }) => usePerpsProInfoScrollBridge(tab),
      { initialProps: { tab: 'positions' as PerpsProInfoTab } },
    );
    const controller = result.current;
    act(() => {
      controller.targets[0].ref(nativeList as never);
      controller.targets[0].maxOffset.value = 900;
      controller.targets[1].maxOffset.value = 280;
    });
    emitNativeScroll(210);

    rerender({ tab: 'openOrders' });
    expect(result.current).toBe(controller);
    expect(controller.activeIndex.value).toBe(1);
    expect(controller.targets[1].offset.value).toBe(210);
    expect(controller.targets[1].maxOffset.value).toBe(280);

    act(() => {
      controller.targets[0].ref(null as never);
      controller.targets[1].ref(nativeList as never);
    });
    expect(mockScrollListeners.get(nativeList.tag)?.size).toBe(1);
    emitNativeScroll(250);
    expect(controller.targets.map(target => target.offset.value)).toEqual([
      210, 250, 0,
    ]);

    rerender({ tab: 'account' });
    act(() => {
      controller.targets[1].ref(null as never);
      controller.targets[2].ref(nativeList as never);
    });
    expect(controller.activeIndex.value).toBe(2);
    expect(controller.targets[2].offset.value).toBe(250);
    expect(controller.targets[2].maxOffset.value).toBe(0);
    emitNativeScroll(170);
    expect(controller.targets.map(target => target.offset.value)).toEqual([
      210, 250, 170,
    ]);

    // Returning to a visited tab preserves the current shared offset, not its
    // old per-tab value. This switch emits no native scroll event.
    rerender({ tab: 'positions' });
    expect(controller.activeIndex.value).toBe(0);
    expect(controller.targets[0].offset.value).toBe(170);
    expect(mockScrollListeners.get(nativeList.tag)?.size).toBe(1);
    expect(mockScrollTo).not.toHaveBeenCalled();
    unmount();
    expect(mockScrollListeners.get(nativeList.tag)?.size).toBe(0);
  });

  it('starts on the selected tab and sanitizes an invalid outgoing offset', () => {
    const { result, rerender } = renderHook(
      ({ tab }: { tab: PerpsProInfoTab }) => usePerpsProInfoScrollBridge(tab),
      { initialProps: { tab: 'account' as PerpsProInfoTab } },
    );
    expect(result.current.activeIndex.value).toBe(2);
    act(() => {
      result.current.targets[2].offset.value = Number.NaN;
    });
    rerender({ tab: 'openOrders' });
    expect(result.current.activeIndex.value).toBe(1);
    expect(result.current.targets[1].offset.value).toBe(0);
  });
});
