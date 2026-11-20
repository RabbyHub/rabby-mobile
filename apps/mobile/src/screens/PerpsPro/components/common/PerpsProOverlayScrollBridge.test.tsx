import { act, render } from '@testing-library/react-native';
import React from 'react';

type ScrollEvent = {
  contentOffset: { y: number };
  velocity?: { y: number };
};
type ScrollHandlers = Record<string, (event: ScrollEvent) => void>;
const mockScrollTo = jest.fn();
let mockScrollHandlers: ScrollHandlers[] = [];

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: { ScrollView: ReactNative.ScrollView },
    scrollTo: (...args: unknown[]) => mockScrollTo(...args),
    useAnimatedRef: () => {
      const ref = (component?: unknown) => {
        ref.current = component ?? null;
        return 0;
      };
      ref.current = null;
      return ref;
    },
    useAnimatedScrollHandler: (handlers: ScrollHandlers) => {
      mockScrollHandlers.push(handlers);
      return jest.fn();
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

import {
  interruptPerpsProInfoScrollBridge,
  type PerpsProInfoScrollBridgeController,
} from '../info/usePerpsProInfoScrollBridge';
import { PerpsProOverlayScrollBridge } from './PerpsProOverlayScrollBridge';

const createController = (activeIndex = 0) => {
  const shared = <T,>(value: T) => ({ value });
  return {
    activeIndex: shared(activeIndex),
    epoch: shared(0),
    pageGestureActive: shared(false),
    targets: [0, 1, 2].map(() => ({
      maxOffset: shared(300),
      offset: shared(100),
      ref: jest.fn(),
    })),
  } as unknown as PerpsProInfoScrollBridgeController;
};

describe('PerpsProOverlayScrollBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScrollHandlers = [];
  });

  it.each([0, 1, 2])(
    'forwards a tab-strip drag and momentum only to active page %i',
    activeIndex => {
      const controller = createController(activeIndex);
      render(
        <PerpsProOverlayScrollBridge
          controller={controller}
          height={44}
          testID="tabs"
        />,
      );
      const handlers = mockScrollHandlers[0];

      act(() => {
        handlers.onBeginDrag({ contentOffset: { y: 100_000 } });
        handlers.onScroll({ contentOffset: { y: 100_050 } });
        handlers.onEndDrag({
          contentOffset: { y: 100_050 },
          velocity: { y: 1 },
        });
        handlers.onScroll({ contentOffset: { y: 100_075 } });
      });

      expect(mockScrollTo.mock.calls).toEqual([
        [controller.targets[activeIndex].ref, 0, 150, false],
        [controller.targets[activeIndex].ref, 0, 175, false],
      ]);

      act(() => {
        handlers.onMomentumEnd({ contentOffset: { y: 100_075 } });
        handlers.onScroll({ contentOffset: { y: 100_000 } });
      });
      // Reset only the proxy after momentum, leaving the list at its last offset.
      expect(mockScrollTo).toHaveBeenCalledTimes(3);
      expect(mockScrollTo.mock.lastCall?.slice(1)).toEqual([0, 100_000, false]);
      expect(mockScrollTo.mock.lastCall?.[0]).not.toBe(
        controller.targets[activeIndex].ref,
      );
    },
  );

  it('hands scrolling from Trade to tabs and cancels momentum when the page changes', () => {
    const controller = createController();
    render(
      <>
        <PerpsProOverlayScrollBridge
          controller={controller}
          height={520}
          testID="trade"
        />
        <PerpsProOverlayScrollBridge
          controller={controller}
          height={44}
          testID="tabs"
        />
      </>,
    );
    const [trade, tabs] = mockScrollHandlers;

    act(() => {
      trade.onBeginDrag({ contentOffset: { y: 100_000 } });
      trade.onScroll({ contentOffset: { y: 100_020 } });
      // Native onScroll publishes the list position; the scene observes a new touch.
      controller.targets[0].offset.value = 120;
      interruptPerpsProInfoScrollBridge(controller);
      tabs.onBeginDrag({ contentOffset: { y: 100_000 } });
      trade.onScroll({ contentOffset: { y: 100_060 } });
      tabs.onScroll({ contentOffset: { y: 99_970 } });
    });

    expect(mockScrollTo.mock.calls).toEqual([
      [controller.targets[0].ref, 0, 120, false],
      [controller.targets[0].ref, 0, 90, false],
    ]);

    act(() => {
      controller.activeIndex.value = 1;
      interruptPerpsProInfoScrollBridge(controller);
      tabs.onScroll({ contentOffset: { y: 99_940 } });
    });
    expect(mockScrollTo).toHaveBeenCalledTimes(2);
  });
});
