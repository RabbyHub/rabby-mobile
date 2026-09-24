import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, View } from 'react-native';
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
const mockJSQueue: Array<() => void> = [];
const mockJSScrollCommands: Array<() => void> = [];
const mockNativeCommands: Array<{ name: string; position: number }> = [];
const mockNativeScroll = jest.fn();
let mockOnUIThread = false;
let mockAutoAcknowledge = false;
let mockDelayJS = false;
let mockObserveNativeScroll = true;
let mockPagerEvents: Record<string, (event: object) => void> = {};
let mockGestureEvents: Record<string, (...args: any[]) => void> = {};
let mockReactions: Array<{
  prepare: () => unknown;
  react: (state: any) => void;
}> = [];
let mockScrollOffsets = new Map<unknown, { value: number }>();
let mockScrollBounds = new Map<unknown, { value: number }>();

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
const flushJS = () => {
  while (mockJSQueue.length) {
    mockJSQueue.shift()!();
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
        if (mockDelayJS) {
          mockJSQueue.push(() => callback(...args));
          return;
        }
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
      expect(mockOnUIThread).toBe(true);
      mockNativeScroll(ref, x, y, animated);
      const offset = mockScrollOffsets.get(ref);
      if (offset && mockObserveNativeScroll) {
        offset.value = Math.min(
          Math.max(0, y),
          mockScrollBounds.get(ref)?.value ?? Number.POSITIVE_INFINITY,
        );
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

const renderInfo = ({
  initialTab = 'positions',
  initialOffsets = [120, 400, 650],
  stickyOffset = 100,
}: {
  initialTab?: PerpsProInfoTab;
  initialOffsets?: readonly [number, number, number];
  stickyOffset?: number;
} = {}) => {
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
      React.useState<PerpsProInfoTab>(initialTab);
    bridge = usePerpsProInfoScrollBridge(initialTab);
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
        stickyOffset={stickyOffset}
      />
    );
  };
  render(<Harness />);
  // FlatList's JS command is an asynchronous native boundary. Keep it queued
  // independently of both JS callbacks and direct UI-thread scrollTo calls.
  screen.UNSAFE_getAllByType(FlatList).forEach((node, index) => {
    jest
      .spyOn(node.instance, 'scrollToOffset')
      .mockImplementation((params: { offset: number }) => {
        mockJSScrollCommands.push(() =>
          mockRunOnUI(() => {
            bridge.targets[index].offset.value = params.offset;
          }),
        );
      });
  });
  act(() => {
    flushUI();
    mockRunOnUI(() => {
      initialOffsets.forEach((offset, index) => {
        bridge.targets[index].offset.value = offset;
        bridge.targets[index].maxOffset.value = 1000;
        mockScrollBounds.set(
          bridge.targets[index].ref,
          bridge.targets[index].maxOffset,
        );
      });
    });
    flushReactions();
  });
  return { pagerRef, selected, finished, bridge, indicator, visualOffset };
};

const startHorizontalSwipe = () => {
  const manager = { fail: jest.fn(), activate: jest.fn() };
  act(() =>
    mockRunOnUI(() => mockGestureEvents.onTouchesDown(touch(30, 500), manager)),
  );
  fireEvent(
    screen.getByTestId('perps-pro-info-pager'),
    'pageScrollStateChanged',
    {
      nativeEvent: { pageScrollState: 'dragging' },
    },
  );
  act(() =>
    mockRunOnUI(() => {
      mockGestureEvents.onTouchesMove(touch(100, 500), manager);
      mockGestureEvents.onFinalize({}, false);
    }),
  );
};

const selectAndSettle = (position: number) => {
  const pager = screen.getByTestId('perps-pro-info-pager');
  fireEvent(pager, 'pageSelected', { nativeEvent: { position } });
  fireEvent(pager, 'pageScroll', { nativeEvent: { position, offset: 0 } });
  fireEvent(pager, 'pageScrollStateChanged', {
    nativeEvent: { pageScrollState: 'idle' },
  });
  act(flushReactions);
};

describe('Info Pager and Android Scene input integration', () => {
  beforeEach(() => {
    mockUIQueue.splice(0);
    mockJSQueue.splice(0);
    mockJSScrollCommands.splice(0);
    mockNativeCommands.splice(0);
    mockNativeScroll.mockClear();
    mockScrollOffsets = new Map();
    mockScrollBounds = new Map();
    mockReactions = [];
    mockOnUIThread = false;
    mockAutoAcknowledge = false;
    mockDelayJS = false;
    mockObserveNativeScroll = true;
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])(
    'keeps the scene offset when Android selects before queued JS work (delayed JS: %s)',
    delayJS => {
      const { bridge, selected, visualOffset } = renderInfo({
        initialTab: 'account',
        initialOffsets: [0, 0, 300],
        stickyOffset: 400,
      });
      mockDelayJS = delayJS;
      const manager = { fail: jest.fn(), activate: jest.fn() };
      act(() =>
        mockRunOnUI(() => {
          mockGestureEvents.onTouchesDown(touch(30, 500), manager);
          mockGestureEvents.onTouchesMove(touch(100, 500), manager);
          mockGestureEvents.onFinalize({}, false);
        }),
      );
      const pager = screen.getByTestId('perps-pro-info-pager');
      fireEvent(pager, 'pageScrollStateChanged', {
        nativeEvent: { pageScrollState: 'dragging' },
      });
      fireEvent(pager, 'pageScroll', {
        nativeEvent: { position: 1, offset: 0.65 },
      });
      act(flushReactions);
      expect(visualOffset.value).toBe(300);
      // The destination must be physically ready while it is being revealed.
      expect(bridge.targets[1].offset.value).toBe(300);
      fireEvent(pager, 'pageScrollStateChanged', {
        nativeEvent: { pageScrollState: 'settling' },
      });
      fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
      act(flushReactions);
      expect(bridge.activeIndex.value).toBe(1);
      expect(visualOffset.value).toBe(300);
      if (delayJS) {
        expect(selected).not.toHaveBeenCalled();
      }
      fireEvent(pager, 'pageScroll', {
        nativeEvent: { position: 1, offset: 0 },
      });
      fireEvent(pager, 'pageScrollStateChanged', {
        nativeEvent: { pageScrollState: 'idle' },
      });
      act(() => {
        flushJS();
        flushUI();
        mockJSScrollCommands.splice(0).forEach(command => command());
        flushReactions();
      });
      expect(selected).toHaveBeenLastCalledWith('openOrders', 0);
      expect(visualOffset.value).toBe(300);
      expect(mockJSScrollCommands).toHaveLength(0);
      expect(mockNativeScroll).toHaveBeenCalledTimes(2);
    },
  );

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
      // The unvisited destination is prepared at stickyOffset=100.
      130,
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
    expect(visualOffset.value).toBe(100);
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
    expect(mockNativeScroll).not.toHaveBeenCalled();
  });

  it('prepares on authorized selection even when no authorized progress arrived', () => {
    const { bridge, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    mockDelayJS = true;
    startHorizontalSwipe();
    expect(mockNativeScroll).not.toHaveBeenCalled();
    selectAndSettle(1);
    expect(bridge.targets[1].offset.value).toBe(300);
    expect(visualOffset.value).toBe(300);
    expect(mockNativeScroll).toHaveBeenCalledTimes(2);
  });

  it('preserves every visited deep offset and realigns below the sticky boundary', () => {
    const { bridge, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 650],
      stickyOffset: 400,
    });
    startHorizontalSwipe();
    selectAndSettle(1);
    expect(visualOffset.value).toBe(400);
    act(() => {
      mockRunOnUI(() => {
        bridge.targets[1].offset.value = 720;
      });
      flushReactions();
    });
    startHorizontalSwipe();
    selectAndSettle(2);
    expect(visualOffset.value).toBe(650);
    fireEvent(
      screen.getByTestId('perps-pro-scroll-openOrders', {
        includeHiddenElements: true,
      }),
      'momentumScrollEnd',
      {
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      },
    );
    act(flushUI);
    startHorizontalSwipe();
    selectAndSettle(1);
    expect(visualOffset.value).toBe(720);
    act(() => {
      mockRunOnUI(() => {
        bridge.targets[1].offset.value = 250;
      });
      flushReactions();
    });
    startHorizontalSwipe();
    selectAndSettle(2);
    expect(visualOffset.value).toBe(250);
  });

  it('does not let delayed JS preparation or correction undo a newer reverse swipe', () => {
    const { bridge, selected, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    mockDelayJS = true;
    startHorizontalSwipe();
    selectAndSettle(1);
    expect(visualOffset.value).toBe(300);
    // The second gesture is real while the first gesture's JS is still queued.
    startHorizontalSwipe();
    selectAndSettle(2);
    act(() => {
      flushJS();
      flushUI();
      flushReactions();
    });
    expect(bridge.activeIndex.value).toBe(2);
    expect(selected).toHaveBeenLastCalledWith('account', 0);
    expect(visualOffset.value).toBe(300);
    expect(mockNativeScroll).toHaveBeenCalledTimes(4);
    expect(mockJSScrollCommands).toHaveLength(0);
  });

  it('leaves the current vertical position unchanged when a horizontal drag cancels', () => {
    const { bridge, selected, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    startHorizontalSwipe();
    const pager = screen.getByTestId('perps-pro-info-pager');
    fireEvent(pager, 'pageScroll', {
      nativeEvent: { position: 1, offset: 0.65 },
    });
    fireEvent(pager, 'pageScroll', { nativeEvent: { position: 2, offset: 0 } });
    fireEvent(pager, 'pageScrollStateChanged', {
      nativeEvent: { pageScrollState: 'idle' },
    });
    act(() => {
      flushUI();
      flushReactions();
    });
    expect(selected).not.toHaveBeenCalled();
    expect(bridge.activeIndex.value).toBe(2);
    expect(bridge.pageGestureActive.value).toBe(false);
    expect(visualOffset.value).toBe(300);
  });

  it('prepares a programmatic target before its synchronous native acknowledgement', () => {
    const { pagerRef, bridge, visualOffset } = renderInfo({
      initialOffsets: [300, 0, 0],
      stickyOffset: 400,
    });
    mockAutoAcknowledge = true;
    mockDelayJS = true;
    act(() => {
      pagerRef.current?.setPage('openOrders', 1);
      flushUI();
      flushReactions();
    });
    expect(bridge.activeIndex.value).toBe(1);
    expect(visualOffset.value).toBe(300);
    expect(mockNativeCommands).toEqual([{ name: 'setPage', position: 1 }]);
    expect(mockJSScrollCommands).toHaveLength(0);
  });

  it('uses native clamping instead of publishing a desired position as actual', () => {
    const { bridge, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    act(() =>
      mockRunOnUI(() => {
        bridge.targets[1].maxOffset.value = 200;
      }),
    );
    startHorizontalSwipe();
    selectAndSettle(1);
    expect(bridge.targets[1].offset.value).toBe(200);
    expect(visualOffset.value).toBe(200);
  });

  it('keeps a missing native acknowledgement actual-first and corrects once layout is ready', () => {
    const { bridge, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    mockObserveNativeScroll = false;
    startHorizontalSwipe();
    selectAndSettle(1);
    expect(bridge.targets[1].offset.value).toBe(0);
    expect(visualOffset.value).toBe(0);
    mockObserveNativeScroll = true;
    const scroll = screen.getByTestId('perps-pro-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { width: 393, height: 600, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 393, 1600);
    act(() => {
      flushUI();
      flushReactions();
    });
    expect(bridge.targets[1].offset.value).toBe(300);
    expect(visualOffset.value).toBe(300);
    expect(mockNativeScroll).toHaveBeenCalledTimes(3);
  });

  it('discards a queued active correction when a new vertical touch takes ownership', () => {
    const { bridge, visualOffset } = renderInfo({
      initialTab: 'account',
      initialOffsets: [0, 0, 300],
      stickyOffset: 400,
    });
    mockObserveNativeScroll = false;
    startHorizontalSwipe();
    selectAndSettle(1);
    const scroll = screen.getByTestId('perps-pro-scroll');
    fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { width: 393, height: 600, x: 0, y: 0 } },
    });
    fireEvent(scroll, 'contentSizeChange', 393, 1600);
    mockObserveNativeScroll = true;
    const manager = { fail: jest.fn(), activate: jest.fn() };
    act(() =>
      mockRunOnUI(() => {
        mockGestureEvents.onTouchesDown(touch(30, 500), manager);
        mockGestureEvents.onTouchesMove(touch(30, 480), manager);
        mockGestureEvents.onStart({ absoluteY: 480 });
        mockGestureEvents.onUpdate({ absoluteY: 460 });
        flushReactions();
      }),
    );
    expect(visualOffset.value).toBe(20);
    act(() => {
      flushUI();
      flushReactions();
    });
    expect(visualOffset.value).toBe(20);
    expect(bridge.targets[1].offset.value).toBe(20);
    expect(
      mockNativeScroll.mock.calls.filter(
        call => call[0] === bridge.targets[1].ref && call[2] === 300,
      ),
    ).toHaveLength(1);
  });
});
