import React from 'react';
import {
  act,
  cleanup,
  render,
  renderHook,
} from '@testing-library/react-native';
import type { NativeScrollEvent, View } from 'react-native';
import {
  ANIMATION_STATUS,
  KEYBOARD_STATUS,
  SCROLLABLE_STATUS,
  SHEET_STATE,
  useScrollEventsHandlersDefault,
  type ScrollEventsHandlersHookType,
} from '@gorhom/bottom-sheet';
import { State } from 'react-native-gesture-handler';
import type { AnimatedRef } from 'react-native-reanimated';
import {
  PositionTpSlAndroidScrollContext,
  usePositionTpSlAndroidScrollRestoration,
} from './usePositionTpSlAndroidScrollRestoration';

const shared = <T,>(value: T) => ({
  value,
  get() {
    return this.value;
  },
  set(next: T | ((old: T) => T)) {
    this.value =
      typeof next === 'function' ? (next as (old: T) => T)(this.value) : next;
  },
});
const mockSheet = {
  animatedAnimationState: shared({ status: 2, isForcedClosing: false }),
  animatedSheetState: shared(2),
  animatedScrollableState: shared({ contentOffsetY: 0 }),
  animatedScrollableStatus: shared(1),
  animatedPosition: shared(120),
  animatedDetentsState: shared({ detents: [120] }),
  animatedKeyboardState: shared<{ status: number; target?: number }>({
    status: 2,
  }),
  animatedLayoutState: shared({ handleHeight: 40 }),
  animatedContentGestureState: shared(0),
  animatedHandleGestureState: shared(0),
};
const mockReactions = new Set<() => void>();
const mockGeometry = {
  contentHeight: 688,
  viewportHeight: 640,
  offset: 0,
  available: true,
};
const mockScrollTo = jest.fn((_ref: unknown, _x: number, y: number) => {
  mockGeometry.offset = Math.max(
    0,
    Math.min(y, mockGeometry.contentHeight - mockGeometry.viewportHeight),
  );
});

// Run the installed library's real handlers. Only its native context and
// Reanimated/geometry/scheduling boundary are controlled by this test.
jest.mock(
  '@gorhom/bottom-sheet/lib/commonjs/hooks/useBottomSheetInternal',
  () => ({
    useBottomSheetInternal: () => mockSheet,
  }),
);
jest.mock('@gorhom/bottom-sheet', () => ({
  ...require('@gorhom/bottom-sheet/lib/commonjs/constants'),
  useBottomSheetInternal: () => mockSheet,
  useScrollEventsHandlersDefault:
    require('@gorhom/bottom-sheet/lib/commonjs/hooks/useScrollEventsHandlersDefault')
      .useScrollEventsHandlersDefault,
}));
jest.mock('react-native-reanimated', () => {
  const base = require('react-native-reanimated/mock');
  const ReactModule = require('react');
  return {
    ...base,
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    runOnUI: (fn: (...args: any[]) => unknown) => fn,
    scrollTo: (...args: Parameters<typeof mockScrollTo>) =>
      mockScrollTo(...args),
    measure: (ref: { current: string }) =>
      !mockGeometry.available
        ? null
        : {
            x: 0,
            y: 0,
            width: 393,
            height:
              ref.current === 'content'
                ? mockGeometry.contentHeight
                : mockGeometry.viewportHeight,
            pageX: 0,
            pageY: 50 + (ref.current === 'content' ? -mockGeometry.offset : 0),
          },
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (next: unknown, previous: unknown) => void,
    ) => {
      const previous = ReactModule.useRef(null);
      ReactModule.useLayoutEffect(() => {
        const run = () => {
          const next = prepare();
          if (JSON.stringify(next) !== JSON.stringify(previous.current)) {
            const last = previous.current;
            previous.current = next;
            react(next, last);
          }
        };
        mockReactions.add(run);
        return () => mockReactions.delete(run);
      }, [prepare, react]);
    },
  };
});

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const nativeScrollRef = {
  current: 'scroll',
} as unknown as Parameters<ScrollEventsHandlersHookType>[0];
const contentRef = { current: 'content' } as unknown as AnimatedRef<View>;
const offset = shared(0);
const touchRevision = shared(0);
let handlers: ReturnType<ScrollEventsHandlersHookType>;
const Consumer = () => {
  handlers = usePositionTpSlAndroidScrollRestoration(
    nativeScrollRef,
    offset as any,
  );
  return null;
};
const options = (
  override: Partial<
    React.ContextType<typeof PositionTpSlAndroidScrollContext>
  > = {},
) => ({
  contentRef,
  enabled: true,
  fixedHeaderHeight: 0,
  pageKey: 'add:1',
  targetHeight: 680,
  touchRevision: touchRevision as any,
  ...override,
});
const tree = (override: Parameters<typeof options>[0] = {}) => (
  <PositionTpSlAndroidScrollContext.Provider value={options(override)}>
    <Consumer />
  </PositionTpSlAndroidScrollContext.Provider>
);
const react = () => act(() => mockReactions.forEach(run => run()));
const frame = () =>
  act(() => {
    const current = [...frames.values()];
    frames.clear();
    current.forEach(callback => callback(0));
  });
const event = (): NativeScrollEvent => ({
  contentOffset: { x: 0, y: mockGeometry.offset },
  contentInset: { top: 0, right: 0, bottom: 0, left: 0 },
  contentSize: { width: 393, height: mockGeometry.contentHeight },
  layoutMeasurement: { width: 393, height: mockGeometry.viewportHeight },
  zoomScale: 1,
});
const openKeyboard = (initialOffset = 0) => {
  react();
  mockSheet.animatedKeyboardState.value = {
    status: KEYBOARD_STATUS.SHOWN,
    target: 7,
  };
  mockSheet.animatedPosition.value = 0;
  mockGeometry.viewportHeight = 350;
  mockGeometry.offset = initialOffset;
  react();
};
const hideKeyboard = (notify = true) => {
  mockSheet.animatedKeyboardState.value = { status: KEYBOARD_STATUS.HIDDEN };
  mockSheet.animatedAnimationState.value.status = ANIMATION_STATUS.RUNNING;
  mockSheet.animatedSheetState.value = SHEET_STATE.OPENED;
  mockSheet.animatedScrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
  if (notify) {
    react();
  }
};
const restoreFrame = (
  progress: number,
  finalHeight = 640,
  viewportProgress = progress,
) => {
  mockSheet.animatedPosition.value = 120 * progress;
  mockGeometry.viewportHeight = 350 + (finalHeight - 350) * viewportProgress;
  // Android clamps native offset when its viewport grows.
  mockGeometry.offset = Math.max(
    0,
    Math.min(
      mockGeometry.offset,
      mockGeometry.contentHeight - mockGeometry.viewportHeight,
    ),
  );
  if (progress === 1) {
    mockSheet.animatedAnimationState.value.status = ANIMATION_STATUS.STOPPED;
    mockSheet.animatedScrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
    mockSheet.animatedSheetState.value = SHEET_STATE.EXTENDED;
  }
  frame();
  act(() =>
    handlers.handleOnScroll?.(event(), {
      shouldLockInitialPosition: false,
    } as never),
  );
};

describe('Android TP/SL restoration with installed Gorhom handlers (JS/native boundary)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    frames.clear();
    mockReactions.clear();
    Object.assign(mockGeometry, {
      contentHeight: 688,
      viewportHeight: 640,
      offset: 0,
      available: true,
    });
    mockSheet.animatedKeyboardState.value = { status: KEYBOARD_STATUS.HIDDEN };
    mockSheet.animatedAnimationState.value = {
      status: ANIMATION_STATUS.STOPPED,
      isForcedClosing: false,
    };
    mockSheet.animatedSheetState.value = SHEET_STATE.EXTENDED;
    mockSheet.animatedScrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
    mockSheet.animatedPosition.value = 120;
    mockSheet.animatedContentGestureState.value = State.UNDETERMINED;
    mockSheet.animatedHandleGestureState.value = State.UNDETERMINED;
    mockSheet.animatedScrollableState.value = { contentOffsetY: 0 };
    touchRevision.value = 0;
    offset.value = 0;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++frameId, callback);
      return frameId;
    });
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('reproduces the default locked reset and lack of automatic restoration on unlock', () => {
    const original = renderHook(() =>
      useScrollEventsHandlersDefault(nativeScrollRef, offset as any),
    );
    mockGeometry.offset = 48;
    mockSheet.animatedSheetState.value = SHEET_STATE.OPENED;
    mockSheet.animatedScrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
    act(() =>
      original.result.current.handleOnScroll?.(event(), {
        shouldLockInitialPosition: false,
      } as never),
    );
    expect(mockGeometry.offset).toBe(0);
    mockSheet.animatedScrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
    act(() => original.result.current.handleOnScroll?.(event(), {} as never));
    expect(mockGeometry.offset).toBe(0);
  });

  it.each([
    ['add:appear', 636, 688, 0, 680],
    ['add:disappear', 688, 636, 48, 680],
    ['add:unchanged', 688, 688, 48, 680],
    ['modify:appear', 562, 588, 0, 604],
    ['modify:disappear', 588, 562, 24, 604],
    ['modify:unchanged', 588, 588, 24, 604],
  ])(
    'restores %s continuously while content and viewport can overflow',
    (page, before, after, start, height) => {
      render(tree({ pageKey: page as string, targetHeight: height as number }));
      mockGeometry.contentHeight = before as number;
      openKeyboard(start as number);
      mockGeometry.contentHeight = after as number;
      hideKeyboard();
      const finalHeight = (height as number) - 40;
      const target = Math.max(0, (after as number) - finalHeight);
      const observed: number[] = [];
      for (const progress of [0.25, 0.5, 0.75, 1]) {
        restoreFrame(progress, finalHeight);
        observed.push(mockGeometry.offset);
        expect(mockGeometry.offset).toBeCloseTo(
          (start as number) + (target - (start as number)) * progress,
        );
      }
      expect(observed.at(-1)).toBe(target);
      expect(frames.size).toBe(0);
      const count = mockScrollTo.mock.calls.length;
      frame();
      react();
      expect(mockScrollTo).toHaveBeenCalledTimes(count);
      expect(mockSheet.animatedScrollableState.value.contentOffsetY).toBe(
        target,
      );
    },
  );

  it('continues the same restoration when the content mask finishes after the sheet position', () => {
    render(tree());
    openKeyboard();
    hideKeyboard();
    restoreFrame(1, 640, 0.5);
    expect(mockGeometry.offset).toBe(24);
    expect(frames.size).toBe(1);
    restoreFrame(1, 640, 0.75);
    expect(mockGeometry.offset).toBe(36);
    restoreFrame(1);
    expect(mockGeometry.offset).toBe(48);
    expect(frames.size).toBe(0);
  });

  it.each([
    ['add', 704, 0],
    ['modify', 604, 0],
    ['position-modify', 598, 0],
    ['modify-safe-area', 638, 34],
    ['small-screen', 437, 0],
  ] as const)(
    'restores %s with a fixed header and errors without a second scroll after settling',
    (pageKey, targetHeight, bottomExtra) => {
      render(tree({ pageKey, targetHeight, fixedHeaderHeight: 56 }));
      const finalHeight = targetHeight - 40 - 56;
      // Scrolling content includes normal hints, both errors and a wrapped hint.
      mockGeometry.contentHeight = 680 + bottomExtra;
      openKeyboard(60);
      hideKeyboard();
      restoreFrame(0.5, finalHeight);
      const target = mockGeometry.contentHeight - finalHeight;
      expect(mockGeometry.offset).toBeCloseTo(60 + (target - 60) * 0.5);
      restoreFrame(1, finalHeight, 0.75);
      expect(frames.size).toBe(1);
      restoreFrame(1, finalHeight);
      expect(mockGeometry.offset).toBe(target);
      expect(mockSheet.animatedScrollableState.value.contentOffsetY).toBe(
        target,
      );
      expect(frames.size).toBe(0);
      const calls = mockScrollTo.mock.calls.length;
      frame();
      react();
      expect(mockScrollTo).toHaveBeenCalledTimes(calls);
    },
  );

  it('starts in the scroll callback if a native layout event arrives before the keyboard reaction', () => {
    render(tree());
    openKeyboard(80);
    hideKeyboard(false);
    act(() => handlers.handleOnScroll?.(event(), {} as never));
    expect(mockGeometry.offset).toBe(80);
    react();
    expect(frames.size).toBe(1);
    restoreFrame(0.5);
    expect(mockGeometry.offset).toBe(64);
  });

  it('keeps late end-drag and momentum callbacks from restoring the default zero lock', () => {
    render(tree());
    openKeyboard(80);
    hideKeyboard();
    restoreFrame(0.5);
    for (const handler of [
      handlers.handleOnEndDrag,
      handlers.handleOnMomentumEnd,
    ]) {
      act(() => handler?.(event(), {} as never));
      expect(mockGeometry.offset).toBe(64);
      expect(offset.value).toBe(64);
    }
  });

  it('rebases a native content layout onto the remaining motion instead of jumping midway', () => {
    render(tree());
    openKeyboard();
    hideKeyboard();
    restoreFrame(0.5);
    expect(mockGeometry.offset).toBe(24);
    mockGeometry.contentHeight += 26;
    frame();
    expect(mockGeometry.offset).toBe(24);
    restoreFrame(0.75);
    expect(mockGeometry.offset).toBe(49);
    restoreFrame(1);
    expect(mockGeometry.offset).toBe(74);
  });

  it.each([
    'touch',
    'drag',
    'handle',
    'handle-began',
    'content-gesture',
    'reopen',
    'focus-before-show',
    'review',
    'page',
    'unmount',
    'close',
    'missing-node',
  ])(
    'drops pending UI frames after %s and leaves native handlers available',
    action => {
      const view = render(tree());
      openKeyboard();
      hideKeyboard();
      restoreFrame(0.25);
      if (action === 'touch') {
        touchRevision.value++;
      }
      if (action === 'drag') {
        act(() => handlers.handleOnBeginDrag?.(event(), {} as never));
      }
      if (action === 'handle') {
        mockSheet.animatedHandleGestureState.value = State.ACTIVE;
      }
      if (action === 'handle-began') {
        mockSheet.animatedHandleGestureState.value = State.BEGAN;
      }
      if (action === 'content-gesture') {
        mockSheet.animatedContentGestureState.value = State.ACTIVE;
      }
      if (action === 'reopen') {
        mockSheet.animatedKeyboardState.value = {
          status: KEYBOARD_STATUS.SHOWN,
          target: 8,
        };
      }
      if (action === 'focus-before-show') {
        mockSheet.animatedKeyboardState.value.target = 8;
      }
      if (action === 'review') {
        view.rerender(tree({ enabled: false }));
      }
      if (action === 'page') {
        view.rerender(tree({ pageKey: 'modify:2' }));
      }
      if (action === 'unmount') {
        view.unmount();
      }
      if (action === 'close') {
        mockSheet.animatedAnimationState.value.isForcedClosing = true;
      }
      if (action === 'missing-node') {
        mockGeometry.available = false;
      }
      const count = mockScrollTo.mock.calls.length;
      frame();
      expect(mockScrollTo).toHaveBeenCalledTimes(count);
      expect(frames.size).toBe(0);
    },
  );

  it('does not let a stale frame enter a later keyboard session', () => {
    render(tree());
    openKeyboard();
    hideKeyboard();
    const stale = [...frames.values()][0];
    frames.clear();
    openKeyboard(100);
    hideKeyboard();
    act(() => stale(0));
    expect(frames.size).toBe(1);
    restoreFrame(0.5);
    expect(mockGeometry.offset).toBe(74);
  });

  it('uses the already restored native geometry for an instantaneous/reduced-motion close', () => {
    render(tree());
    openKeyboard();
    mockGeometry.viewportHeight = 640;
    mockSheet.animatedPosition.value = 120;
    mockSheet.animatedKeyboardState.value = { status: KEYBOARD_STATUS.HIDDEN };
    react();
    expect(mockGeometry.offset).toBe(48);
    expect(frames.size).toBe(0);
  });

  it('does not arm from a missing focus, an inactive page, or hide alone', () => {
    const view = render(tree({ enabled: false }));
    openKeyboard();
    hideKeyboard();
    expect(frames.size).toBe(0);
    view.rerender(tree());
    react();
    mockSheet.animatedKeyboardState.value = { status: KEYBOARD_STATUS.SHOWN };
    react();
    hideKeyboard();
    expect(frames.size).toBe(0);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('rejects a new touch between native hide and its reaction, but accepts editing touches while shown', () => {
    render(tree());
    openKeyboard(80);
    touchRevision.value++;
    react();
    hideKeyboard(false);
    touchRevision.value++;
    act(() => handlers.handleOnScroll?.(event(), {} as never));
    expect(frames.size).toBe(0);
    react();
    expect(frames.size).toBe(0);
    openKeyboard(80);
    touchRevision.value++;
    react();
    hideKeyboard();
    restoreFrame(0.5);
    expect(mockGeometry.offset).toBe(64);
  });
});
