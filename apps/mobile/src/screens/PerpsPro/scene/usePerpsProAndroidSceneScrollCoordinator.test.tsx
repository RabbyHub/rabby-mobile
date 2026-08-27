import { act, renderHook } from '@testing-library/react-native';

const mockCancelAnimation = jest.fn();
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

import type { PerpsProInfoScrollBridgeController } from '../components/info/usePerpsProInfoScrollBridge';
import {
  getPerpsProAndroidSceneScrollIntent,
  getPerpsProAndroidSceneScrollVelocity,
  usePerpsProAndroidSceneScrollCoordinator,
} from './usePerpsProAndroidSceneScrollCoordinator';

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

describe('usePerpsProAndroidSceneScrollCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnimatedReactions = [];
    mockGestureHandlers = {};
  });

  it('keeps sub-slop movement pending and gives horizontal intent away', () => {
    expect(getPerpsProAndroidSceneScrollIntent({ deltaX: 2, deltaY: 4 })).toBe(
      'pending',
    );
    expect(getPerpsProAndroidSceneScrollIntent({ deltaX: 12, deltaY: 4 })).toBe(
      'fail',
    );
    expect(
      getPerpsProAndroidSceneScrollIntent({ deltaX: 4, deltaY: -12 }),
    ).toBe('activate');
    expect(
      getPerpsProAndroidSceneScrollIntent({
        deltaX: Number.NaN,
        deltaY: Number.POSITIVE_INFINITY,
      }),
    ).toBe('pending');
  });

  it('interrupts prior decay on touch-down without queuing a target command', () => {
    const controller = createController();
    renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );
    const stateManager = {
      activate: jest.fn(),
      fail: jest.fn(),
    };

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), stateManager);
      mockGestureHandlers.onTouchesMove(touch(22, 196), stateManager);
    });
    expect(controller.epoch.value).toBe(1);
    expect(mockCancelAnimation).toHaveBeenCalled();
    expect(stateManager.activate).not.toHaveBeenCalled();
    expect(stateManager.fail).not.toHaveBeenCalled();
    expect(mockScrollTo).not.toHaveBeenCalled();

    act(() => {
      mockGestureHandlers.onTouchesMove(touch(22, 188), stateManager);
    });
    expect(stateManager.activate).toHaveBeenCalledTimes(1);
  });

  it('uses one shared offset for the active list and Trade surface', () => {
    const controller = createController();
    const { result } = renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );

    act(() => {
      const synchronizationReaction = mockAnimatedReactions[0];
      synchronizationReaction.react(synchronizationReaction.prepare());
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
    expect(result.current.visualOffset.value).toBe(120);

    controller.epoch.value += 1;
    act(() => {
      const synchronizationReaction = mockAnimatedReactions[0];
      synchronizationReaction.react(synchronizationReaction.prepare());
      mockGestureHandlers.onUpdate({ absoluteY: 150 });
      const offsetReaction = mockAnimatedReactions[1];
      offsetReaction.react(offsetReaction.prepare());
    });
    expect(mockCancelAnimation).toHaveBeenCalled();
    expect(mockScrollTo).toHaveBeenCalledTimes(1);
  });

  it('follows external and selected-page offsets outside a gesture session', () => {
    const controller = createController();
    const { result } = renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );

    controller.targets[0].offset.value = 180;
    act(() => {
      const synchronizationReaction = mockAnimatedReactions[0];
      synchronizationReaction.react(synchronizationReaction.prepare());
    });
    expect(result.current.visualOffset.value).toBe(180);

    controller.activeIndex.value = 1;
    controller.targets[1].offset.value = 75;
    act(() => {
      const synchronizationReaction = mockAnimatedReactions[0];
      synchronizationReaction.react(synchronizationReaction.prepare());
    });
    expect(result.current.visualOffset.value).toBe(75);
  });

  it('maps finger velocity to bounded forward decay', () => {
    const controller = createController();
    renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );

    act(() => {
      const synchronizationReaction = mockAnimatedReactions[0];
      synchronizationReaction.react(synchronizationReaction.prepare());
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
    expect(getPerpsProAndroidSceneScrollVelocity(600)).toBe(-600);
    expect(getPerpsProAndroidSceneScrollVelocity(Number.NaN)).toBe(0);
  });

  it('holds the last visible offset while a new touch is still pending', () => {
    const controller = createController();
    const { result } = renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );
    const synchronizationReaction = mockAnimatedReactions[0];

    act(() => {
      synchronizationReaction.react(synchronizationReaction.prepare());
    });
    expect(result.current.visualOffset.value).toBe(100);

    controller.targets[0].offset.value = 92;
    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), {
        activate: jest.fn(),
        fail: jest.fn(),
      });
      synchronizationReaction.react(synchronizationReaction.prepare());
    });

    expect(result.current.visualOffset.value).toBe(100);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('fails before activation while the horizontal pager owns the gesture', () => {
    const controller = createController();
    controller.pageGestureActive.value = true;
    renderHook(() =>
      usePerpsProAndroidSceneScrollCoordinator({ controller, enabled: true }),
    );
    const stateManager = { activate: jest.fn(), fail: jest.fn() };

    act(() => {
      mockGestureHandlers.onTouchesDown(touch(20, 200), stateManager);
    });

    expect(stateManager.fail).toHaveBeenCalledTimes(1);
    expect(mockScrollTo).not.toHaveBeenCalled();
  });
});
