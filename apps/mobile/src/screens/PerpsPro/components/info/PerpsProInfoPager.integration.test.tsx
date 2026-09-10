import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { PerpsProInfoTab } from '@/core/services/perpsService';
import {
  PerpsProInfoPager,
  type PerpsProInfoPagerHandle,
} from './PerpsProInfoPager';
import { usePerpsProInfoScrollBridge } from './usePerpsProInfoScrollBridge';
import { usePerpsProAndroidSceneScrollCoordinator } from '../../scene/usePerpsProAndroidSceneScrollCoordinator';

// These fakes represent the two asynchronous native boundaries. The Pager,
// preview session, scroll bridge and Scene coordinator remain real modules.
const mockUIQueue: Array<() => void> = [];
const mockNativeCommands: Array<{ name: string; position: number }> = [];
const mockNativeScroll = jest.fn();
let mockOnUIThread = false;
let mockAutoAcknowledge = false;
let mockPagerEvents: Record<string, (event: object) => void> = {};
let mockGestureEvents: Record<string, (...args: any[]) => void> = {};
let mockReactions: Array<{
  prepare: () => unknown;
  react: (state: any) => void;
}> = [];
let mockScrollOffsets = new Map<unknown, { value: number }>();

const mockRunOnUI = (callback: () => void) => {
  const previous = mockOnUIThread;
  mockOnUIThread = true;
  try {
    callback();
  } finally {
    mockOnUIThread = previous;
  }
};
const flushUI = () => {
  while (mockUIQueue.length) {
    mockRunOnUI(mockUIQueue.shift()!);
  }
};
const flushReactions = () =>
  mockRunOnUI(() => {
    mockReactions.forEach(({ prepare, react }) => react(prepare()));
  });

jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return ReactModule.forwardRef(({ children, ...props }: any, ref: any) => {
    mockPagerEvents = props;
    ReactModule.useImperativeHandle(ref, () => ({}));
    return ReactModule.createElement(NativeView, props, children);
  });
});

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const gesture: Record<string, (...args: any[]) => any> = {};
      ['manualActivation', 'maxPointers', 'shouldCancelWhenOutside'].forEach(
        name => {
          gesture[name] = () => gesture;
        },
      );
      [
        'onTouchesDown',
        'onTouchesMove',
        'onStart',
        'onUpdate',
        'onEnd',
        'onFinalize',
      ].forEach(name => {
        gesture[name] = (callback: (...args: any[]) => void) => {
          mockGestureEvents[name] = callback;
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
    __esModule: true,
    default: { createAnimatedComponent: (component: unknown) => component },
    cancelAnimation: jest.fn(),
    runOnUI:
      (callback: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        mockUIQueue.push(() => callback(...args));
      },
    runOnJS:
      (callback: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        const previous = mockOnUIThread;
        mockOnUIThread = false;
        try {
          callback(...args);
        } finally {
          mockOnUIThread = previous;
        }
      },
    dispatchCommand: (_ref: unknown, name: string, [position]: [number]) => {
      expect(mockOnUIThread).toBe(true);
      mockNativeCommands.push({ name, position });
      if (mockAutoAcknowledge) {
        if (name === 'setPage') {
          mockPagerEvents.onPageScrollStateChanged({
            nativeEvent: { pageScrollState: 'settling' },
          });
        }
        mockPagerEvents.onPageSelected({ nativeEvent: { position } });
        mockPagerEvents.onPageScroll({ nativeEvent: { position, offset: 0 } });
        if (name === 'setPage') {
          mockPagerEvents.onPageScrollStateChanged({
            nativeEvent: { pageScrollState: 'idle' },
          });
        }
      }
    },
    useEvent:
      (callback: (event: object) => void) =>
      (event: { nativeEvent: object }) => {
        mockRunOnUI(() => callback(event.nativeEvent));
      },
    useSharedValue: (initial: unknown) =>
      ReactModule.useMemo(() => {
        let value = initial;
        return {
          get value() {
            return value;
          },
          set value(next) {
            if (mockOnUIThread) {
              value = next;
            } else {
              mockUIQueue.push(() => {
                value = next;
              });
            }
          },
        };
      }, []),
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const ref = (component: unknown) => {
          ref.current = component;
        };
        ref.current = null;
        return ref;
      }, []),
    useScrollViewOffset: (ref: unknown, offset: { value: number }) => {
      mockScrollOffsets.set(ref, offset);
      return offset;
    },
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (state: unknown) => void,
    ) => {
      const entry = ReactModule.useRef({ prepare, react });
      entry.current.prepare = prepare;
      entry.current.react = react;
      ReactModule.useEffect(() => {
        mockReactions.push(entry.current);
        return () => {
          mockReactions = mockReactions.filter(item => item !== entry.current);
        };
      }, []);
    },
    scrollTo: (ref: unknown, x: number, y: number, animated: boolean) => {
      mockNativeScroll(ref, x, y, animated);
      const offset = mockScrollOffsets.get(ref);
      if (offset) {
        offset.value = y;
      }
    },
    withDecay: (config: { velocity: number }) => config.velocity,
  };
});

const data = { positions: [], openOrders: [], account: [] };
const contentContainerStyle = { positions: {}, openOrders: {}, account: {} };
const touch = (absoluteX: number, absoluteY: number) => ({
  allTouches: [{ absoluteX, absoluteY }],
});

const renderInfo = () => {
  const pagerRef = React.createRef<PerpsProInfoPagerHandle>();
  const selected = jest.fn();
  const finished = jest.fn();
  let bridge!: ReturnType<typeof usePerpsProInfoScrollBridge>;
  let visualOffset!: ReturnType<
    typeof usePerpsProAndroidSceneScrollCoordinator
  >['visualOffset'];
  let indicator!: ReturnType<typeof useSharedValue<number>>;
  const Harness = () => {
    const [activeTab, setActiveTab] =
      React.useState<PerpsProInfoTab>('positions');
    bridge = usePerpsProInfoScrollBridge('positions');
    visualOffset = usePerpsProAndroidSceneScrollCoordinator({
      controller: bridge,
      enabled: true,
    }).visualOffset;
    indicator = useSharedValue(0);
    return (
      <PerpsProInfoPager
        activeTab={activeTab}
        authorizeNativePageGestures
        contentContainerStyle={contentContainerStyle}
        data={data}
        getActiveScrollOffset={() => 120}
        indicatorPosition={indicator}
        keepAllTabsMounted
        nativeVerticalScrollEnabled={false}
        onActivateOffset={jest.fn()}
        onLayout={jest.fn()}
        onPageDragStart={jest.fn()}
        onPagePreview={jest.fn()}
        onPageRequestFinished={finished}
        onPageSelected={(tab, requestId) => {
          selected(tab, requestId);
          setActiveTab(tab);
        }}
        ref={pagerRef}
        renderItem={() => null}
        renderListHeader={tab => <View testID={`header-${tab}`} />}
        requestedTab={null}
        scrollBridge={bridge}
        stickyOffset={100}
      />
    );
  };
  render(<Harness />);
  act(() => {
    flushUI();
    mockRunOnUI(() => {
      [120, 400, 650].forEach((offset, index) => {
        bridge.targets[index].offset.value = offset;
        bridge.targets[index].maxOffset.value = 1000;
      });
    });
    flushReactions();
  });
  return { pagerRef, selected, finished, bridge, indicator, visualOffset };
};

describe('Info Pager and Android Scene input integration', () => {
  beforeEach(() => {
    mockUIQueue.splice(0);
    mockNativeCommands.splice(0);
    mockNativeScroll.mockClear();
    mockScrollOffsets = new Map();
    mockReactions = [];
    mockOnUIThread = false;
    mockAutoAcknowledge = false;
  });

  it('keeps vertical input available after endpoint presses without direct-page idle events', () => {
    const { pagerRef, selected, bridge } = renderInfo();
    mockAutoAcknowledge = true;
    const tabs: PerpsProInfoTab[] = [
      'account',
      'positions',
      'account',
      'positions',
      'openOrders',
    ];
    tabs.forEach((tab, index) => {
      act(() => pagerRef.current?.setPage(tab, index + 1));
      expect(mockNativeCommands).toHaveLength(index);
      act(() => {
        flushUI();
        flushReactions();
      });
      expect(selected).toHaveBeenLastCalledWith(tab, index + 1);
      expect(bridge.pageGestureActive.value).toBe(false);
    });
    const manager = { fail: jest.fn(), activate: jest.fn() };
    act(() =>
      mockRunOnUI(() => {
        mockGestureEvents.onTouchesDown(touch(30, 300), manager);
        mockGestureEvents.onTouchesMove(touch(30, 260), manager);
        mockGestureEvents.onStart({ absoluteY: 260 });
        mockGestureEvents.onUpdate({ absoluteY: 230 });
        flushReactions();
      }),
    );
    expect(manager.fail).not.toHaveBeenCalled();
    expect(manager.activate).toHaveBeenCalledTimes(1);
    expect(mockNativeScroll).toHaveBeenLastCalledWith(
      bridge.targets[1].ref,
      0,
      430,
      false,
    );
  });

  it('does not transfer the vertical presentation to a superseded endpoint', () => {
    const { pagerRef, selected, finished, bridge, visualOffset } = renderInfo();
    act(() => {
      pagerRef.current?.setPage('account', 1);
      pagerRef.current?.returnToPage('positions', 2);
      pagerRef.current?.setPage('account', 3);
      pagerRef.current?.returnToPage('positions', 4);
      pagerRef.current?.setPage('openOrders', 5);
      flushUI();
    });
    expect(mockNativeCommands).toEqual([
      { name: 'setPageWithoutAnimation', position: 2 },
    ]);
    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 2 },
    });
    act(flushReactions);
    expect(selected).not.toHaveBeenCalled();
    expect(bridge.activeIndex.value).toBe(0);
    expect(visualOffset.value).toBe(120);
    expect(mockNativeCommands[1]).toEqual({ name: 'setPage', position: 1 });
    fireEvent(screen.getByTestId('perps-pro-info-pager'), 'pageSelected', {
      nativeEvent: { position: 1 },
    });
    act(flushReactions);
    expect(selected.mock.calls).toEqual([['openOrders', 5]]);
    expect(finished.mock.calls).toEqual([[5]]);
    expect(visualOffset.value).toBe(400);
    expect(bridge.pageGestureActive.value).toBe(false);
  });

  it('rejects trailing horizontal progress after the real coordinator resolves vertical intent', () => {
    const { indicator, bridge } = renderInfo();
    const manager = { fail: jest.fn(), activate: jest.fn() };
    act(() =>
      mockRunOnUI(() =>
        mockGestureEvents.onTouchesDown(touch(30, 300), manager),
      ),
    );
    const pager = screen.getByTestId('perps-pro-info-pager');
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'dragging' },
    });
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { position: 0, offset: 0.25 },
    });
    expect(indicator.value).toBe(0.25);
    act(() =>
      mockRunOnUI(() =>
        mockGestureEvents.onTouchesMove(touch(31, 270), manager),
      ),
    );
    expect(manager.activate).toHaveBeenCalledTimes(1);
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { position: 0, offset: 0.6 },
    });
    expect(indicator.value).toBe(0);
    expect(bridge.activeIndex.value).toBe(0);
    expect(bridge.pageGestureActive.value).toBe(false);
  });
});
