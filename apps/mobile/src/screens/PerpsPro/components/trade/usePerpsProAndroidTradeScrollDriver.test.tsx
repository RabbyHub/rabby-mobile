import { act, renderHook } from '@testing-library/react-native';

const mockCancelAnimation = jest.fn();
const mockDispatchCommand = jest.fn();
const mockScrollTo = jest.fn();
const mockWithDecay = jest.fn((..._args: unknown[]) => 150);
let mockAnimatedReactions: Array<{
  prepare: () => unknown;
  react: (value: any) => void;
}> = [];
let mockGestureHandlers: Record<string, (...args: any[]) => void> = {};

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const gesture: Record<string, (...args: any[]) => any> = {};
      ['manualActivation', 'maxPointers', 'shouldCancelWhenOutside'].forEach(
        method => {
          gesture[method] = () => gesture;
        },
      );
      [
        'onTouchesDown',
        'onTouchesMove',
        'onStart',
        'onUpdate',
        'onEnd',
        'onFinalize',
      ].forEach(method => {
        gesture[method] = (handler: (...args: any[]) => void) => {
          mockGestureHandlers[method] = handler;
          return gesture;
        };
      });
      return gesture;
    },
  },
}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    cancelAnimation: (...args: unknown[]) => mockCancelAnimation(...args),
    dispatchCommand: (...args: unknown[]) => mockDispatchCommand(...args),
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: any) => void,
    ) => {
      mockAnimatedReactions.push({ prepare, react });
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    withDecay: (...args: unknown[]) => mockWithDecay(...args),
  };
});

import type { PerpsProInfoScrollBridgeController } from '../info/usePerpsProInfoScrollBridge';
import {
  getPerpsProAndroidTradeScrollIntent,
  getPerpsProAndroidTradeScrollVelocity,
  usePerpsProAndroidTradeScrollDriver,
} from './usePerpsProAndroidTradeScrollDriver';

const createController = () => {
  const shared = <T,>(value: T) => ({ value });
  return {
    activeIndex: shared(0),
    epoch: shared(0),
    pageGestureActive: shared(false),
    targets: [0, 1, 2].map(index => ({
      maxOffset: shared(300),
      offset: shared(index === 0 ? 100 : 0),
      ref: jest.fn(),
    })),
  } as unknown as PerpsProInfoScrollBridgeController;
};

const touch = (absoluteX: number, absoluteY: number) => ({
  allTouches: [{ absoluteX, absoluteY }],
});

describe('usePerpsProAndroidTradeScrollDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnimatedReactions = [];
    mockGestureHandlers = {};
  });

  it('keeps sub-slop movement pending and gives horizontal intent away', () => {
    expect(getPerpsProAndroidTradeScrollIntent({ deltaX: 2, deltaY: 4 })).toBe(
      'pending',
    );
    expect(getPerpsProAndroidTradeScrollIntent({ deltaX: 12, deltaY: 4 })).toBe(
      'fail',
    );
    expect(
      getPerpsProAndroidTradeScrollIntent({ deltaX: 4, deltaY: -12 }),
    ).toBe('activate');
    expect(
      getPerpsProAndroidTradeScrollIntent({
        deltaX: Number.NaN,
        deltaY: Number.POSITIVE_INFINITY,
      }),
    ).toBe('pending');
  });

  it('does not activate for a stationary touch and activates only after vertical slop', () => {
    const controller = createController();
    renderHook(() =>
      usePerpsProAndroidTradeScrollDriver({ controller, enabled: true }),
    );
    const stateManager = {
      activate: jest.fn(),
      fail: jest.fn(),
    };

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), stateManager);
      mockGestureHandlers.onTouchesMove(touch(22, 196), stateManager);
    });
    expect(stateManager.activate).not.toHaveBeenCalled();
    expect(stateManager.fail).not.toHaveBeenCalled();
    expect(mockDispatchCommand).toHaveBeenCalledWith(
      controller.targets[0].ref,
      'scrollTo',
      [0, 100, false],
    );

    act(() => {
      mockGestureHandlers.onTouchesMove(touch(22, 188), stateManager);
      mockGestureHandlers.onTouchesMove(touch(60, 187), stateManager);
    });
    expect(stateManager.activate).toHaveBeenCalledTimes(1);
    expect(stateManager.fail).not.toHaveBeenCalled();
  });

  it('mirrors stable absolute-Y deltas and stops after its epoch is invalidated', () => {
    const controller = createController();
    renderHook(() =>
      usePerpsProAndroidTradeScrollDriver({ controller, enabled: true }),
    );

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), {
        activate: jest.fn(),
        fail: jest.fn(),
      });
      mockGestureHandlers.onStart({ absoluteY: 190 });
      mockGestureHandlers.onUpdate({ absoluteY: 170 });
      const offsetReaction = mockAnimatedReactions[1];
      offsetReaction.react(offsetReaction.prepare());
    });
    expect(mockScrollTo).toHaveBeenCalledWith(
      controller.targets[0].ref,
      0,
      120,
      false,
    );

    controller.epoch.value += 1;
    act(() => {
      const invalidationReaction = mockAnimatedReactions[0];
      invalidationReaction.react(invalidationReaction.prepare());
      mockGestureHandlers.onUpdate({ absoluteY: 150 });
      const offsetReaction = mockAnimatedReactions[1];
      offsetReaction.react(offsetReaction.prepare());
    });
    expect(mockCancelAnimation).toHaveBeenCalled();
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('maps finger velocity to bounded forward decay', () => {
    const controller = createController();
    renderHook(() =>
      usePerpsProAndroidTradeScrollDriver({ controller, enabled: true }),
    );

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), {
        activate: jest.fn(),
        fail: jest.fn(),
      });
      mockGestureHandlers.onStart({ absoluteY: 190 });
      mockGestureHandlers.onEnd({ velocityY: -600 });
    });
    expect(mockWithDecay).toHaveBeenCalledWith(
      { clamp: [0, 300], velocity: 600 },
      expect.any(Function),
    );
    expect(getPerpsProAndroidTradeScrollVelocity(600)).toBe(-600);
    expect(getPerpsProAndroidTradeScrollVelocity(Number.NaN)).toBe(0);
  });

  it('fails before activation while the horizontal pager owns the gesture', () => {
    const controller = createController();
    controller.pageGestureActive.value = true;
    renderHook(() =>
      usePerpsProAndroidTradeScrollDriver({ controller, enabled: true }),
    );
    const stateManager = { activate: jest.fn(), fail: jest.fn() };

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), stateManager);
    });

    expect(stateManager.fail).toHaveBeenCalledTimes(1);
    expect(mockDispatchCommand).not.toHaveBeenCalled();
  });
});
