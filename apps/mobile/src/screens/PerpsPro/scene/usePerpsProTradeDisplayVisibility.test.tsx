import { act, renderHook } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';

type PreparedVisibility = { generation: number; visible: boolean };
type MockReaction = {
  prepare: () => PreparedVisibility;
  previous: { current: PreparedVisibility | null };
  react: (
    current: PreparedVisibility,
    previous: PreparedVisibility | null,
  ) => void;
};

let mockReaction: MockReaction | null = null;
let mockUiThread = false;
let mockJsQueue: Array<() => void> = [];
const mockRunOnJS = jest.fn(
  (callback: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      mockJsQueue.push(() => callback(...args));
    },
);

// Only the native worklet/scheduler boundary is replaced. Preserve previous
// across mapper rebuilds and queue JS delivery separately from UI evaluation.
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof import('react');
  return {
    runOnJS: (...args: Parameters<typeof mockRunOnJS>) => mockRunOnJS(...args),
    useAnimatedReaction: (
      prepare: MockReaction['prepare'],
      react: MockReaction['react'],
      dependencies: unknown[],
    ) => {
      const previous = ReactModule.useRef<PreparedVisibility | null>(null);
      ReactModule.useEffect(() => {
        const reaction = { prepare, previous, react };
        mockReaction = reaction;
        return () => {
          if (mockReaction === reaction) {
            mockReaction = null;
          }
        };
        // Native mapper registration follows the supplied worklet inputs.
      }, dependencies);
    },
  };
});

import {
  isPerpsProTradeDisplayVisible,
  usePerpsProTradeDisplayVisibility,
} from './usePerpsProTradeDisplayVisibility';

const geometry = { tradeTop: 100, tradeBottom: 500, viewportHeight: 800 };

const createScroll = (initialOffset = 0) => {
  let offset = initialOffset;
  return {
    shared: {
      get value() {
        if (!mockUiThread) {
          throw new Error('scrollY must only be read on the UI thread');
        }
        return offset;
      },
    } as SharedValue<number>,
    move: (nextOffset: number) => {
      offset = nextOffset;
    },
  };
};

const evaluateUi = () => {
  if (!mockReaction) {
    throw new Error('No mounted UI reaction');
  }
  mockUiThread = true;
  try {
    const current = mockReaction.prepare();
    mockReaction.react(current, mockReaction.previous.current);
    mockReaction.previous.current = current;
  } finally {
    mockUiThread = false;
  }
};

const flushJs = () => {
  act(() => {
    const pending = mockJsQueue;
    mockJsQueue = [];
    pending.forEach(callback => callback());
  });
};

describe('isPerpsProTradeDisplayVisible', () => {
  it.each([
    [0, true],
    [499, true],
    [500, true],
    [547, true],
    [548, false],
    [900, false],
    [-747, true],
    [-748, false],
  ])(
    'allows partial visibility and 48dp overscan at offset %s',
    (scrollY, visible) => {
      expect(isPerpsProTradeDisplayVisible({ ...geometry, scrollY })).toBe(
        visible,
      );
    },
  );

  it.each([
    { tradeTop: null },
    { tradeBottom: null },
    { viewportHeight: null },
    { viewportHeight: 0 },
    { viewportHeight: -1 },
    { tradeTop: -1 },
    { tradeBottom: 100 },
    { tradeBottom: 99 },
    { scrollY: Number.NaN },
    { scrollY: Number.POSITIVE_INFINITY },
    { tradeTop: Number.NaN },
    { tradeBottom: Number.POSITIVE_INFINITY },
    { viewportHeight: Number.NaN },
  ])('allows display for unknown or invalid geometry %o', invalid => {
    expect(
      isPerpsProTradeDisplayVisible({ ...geometry, scrollY: 900, ...invalid }),
    ).toBe(true);
  });
});

describe('usePerpsProTradeDisplayVisibility', () => {
  beforeEach(() => {
    mockReaction = null;
    mockUiThread = false;
    mockJsQueue = [];
    mockRunOnJS.mockClear();
  });

  it('starts permissive without a JS shared-value read and publishes only visibility edges', () => {
    const scroll = createScroll();
    const rendered: boolean[] = [];
    const hook = renderHook(() => {
      const visible = usePerpsProTradeDisplayVisibility({
        ...geometry,
        accountIdentity: 'account-a',
        scrollY: scroll.shared,
      });
      rendered.push(visible);
      return visible;
    });

    expect(hook.result.current).toBe(true);
    for (const offset of [0, 100, 499, 547]) {
      scroll.move(offset);
      evaluateUi();
    }
    expect(mockRunOnJS).not.toHaveBeenCalled();
    expect(rendered).toEqual([true]);

    for (const offset of [548, 600, 900, 1000]) {
      scroll.move(offset);
      evaluateUi();
    }
    expect(mockRunOnJS).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBe(true);
    const hiddenNotification = mockJsQueue[0]!;
    flushJs();
    expect(hook.result.current).toBe(false);
    const rendersAfterHiding = rendered.length;
    act(() => hiddenNotification());
    expect(rendered).toHaveLength(rendersAfterHiding);

    scroll.move(547);
    evaluateUi();
    evaluateUi();
    expect(mockRunOnJS).toHaveBeenCalledTimes(2);
    flushJs();
    expect(hook.result.current).toBe(true);
  });

  it('resets on geometry changes and re-evaluates even when the UI boolean stays false', () => {
    const scroll = createScroll(1000);
    const hook = renderHook(
      ({ tradeBottom }: { tradeBottom: number | null }) =>
        usePerpsProTradeDisplayVisibility({
          ...geometry,
          accountIdentity: 'account-a',
          scrollY: scroll.shared,
          tradeBottom,
        }),
      { initialProps: { tradeBottom: 500 as number | null } },
    );
    evaluateUi();
    flushJs();
    expect(hook.result.current).toBe(false);

    hook.rerender({ tradeBottom: 600 });
    expect(hook.result.current).toBe(true);
    evaluateUi();
    expect(mockRunOnJS).toHaveBeenCalledTimes(2);
    flushJs();
    expect(hook.result.current).toBe(false);

    hook.rerender({ tradeBottom: null });
    expect(hook.result.current).toBe(true);
    evaluateUi();
    expect(mockJsQueue).toHaveLength(0);
    hook.rerender({ tradeBottom: 600 });
    evaluateUi();
    flushJs();
    expect(hook.result.current).toBe(false);
  });

  it('ignores a queued notification from the previous account and preserves steady props', () => {
    const scroll = createScroll(1000);
    const hook = renderHook(
      ({ accountIdentity }: { accountIdentity: string }) =>
        usePerpsProTradeDisplayVisibility({
          ...geometry,
          accountIdentity,
          scrollY: scroll.shared,
        }),
      { initialProps: { accountIdentity: 'account-a' } },
    );
    evaluateUi();
    hook.rerender({ accountIdentity: 'account-b' });
    flushJs();
    expect(hook.result.current).toBe(true);

    evaluateUi();
    flushJs();
    expect(hook.result.current).toBe(false);
    hook.rerender({ accountIdentity: 'account-b' });
    expect(hook.result.current).toBe(false);
    evaluateUi();
    expect(mockRunOnJS).toHaveBeenCalledTimes(2);
  });

  it('ignores queued notifications from stale geometry or an unmounted hook', () => {
    const scroll = createScroll(1000);
    const rendered: boolean[] = [];
    const hook = renderHook(
      ({ viewportHeight }: { viewportHeight: number }) => {
        const visible = usePerpsProTradeDisplayVisibility({
          ...geometry,
          accountIdentity: 'account-a',
          scrollY: scroll.shared,
          viewportHeight,
        });
        rendered.push(visible);
        return visible;
      },
      { initialProps: { viewportHeight: 800 } },
    );
    evaluateUi();
    hook.rerender({ viewportHeight: 0 });
    const rendersBeforeStaleNotification = rendered.length;
    flushJs();
    expect(hook.result.current).toBe(true);
    expect(rendered).toHaveLength(rendersBeforeStaleNotification);

    hook.rerender({ viewportHeight: 800 });
    evaluateUi();
    expect(mockJsQueue).toHaveLength(1);
    hook.unmount();
    const rendersAfterUnmount = rendered.length;
    flushJs();
    expect(rendered).toHaveLength(rendersAfterUnmount);
    expect(mockReaction).toBeNull();
  });
});
