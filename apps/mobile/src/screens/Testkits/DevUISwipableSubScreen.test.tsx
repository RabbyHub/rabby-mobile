import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

const mockGesture = { handlers: {} as Record<string, jest.Mock> };
const mockAnimations: Array<{
  target: number;
  complete?: (finished?: boolean) => void;
}> = [];
const mockJSQueue: Array<() => unknown> = [];
let mockDeferJS = false;

jest.mock('react-native-gesture-handler', () => {
  return {
    Pressable: require('react-native').Pressable,
    Text: require('react-native').Text,
    TextInput: require('react-native').TextInput,
    Gesture: {
      Pan: () => {
        const handlers: Record<string, jest.Mock> = {};
        const builder: Record<string, unknown> = { handlers };
        for (const method of [
          'activeOffsetX',
          'failOffsetY',
          'maxPointers',
          'withTestId',
        ]) {
          builder[method] = () => builder;
        }
        for (const method of [
          'onBegin',
          'onEnd',
          'onFinalize',
          'onStart',
          'onTouchesDown',
          'onUpdate',
        ]) {
          builder[method] = (callback: (...args: unknown[]) => unknown) => {
            handlers[method] = jest.fn(callback);
            return builder;
          };
        }
        return builder;
      },
    },
    GestureDetector: ({
      children,
      gesture,
    }: {
      children: React.ReactNode;
      gesture: typeof mockGesture;
    }) => {
      mockGesture.handlers = gesture.handlers;
      return children;
    },
  };
});

jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@rneui/base', () => ({ Text: require('react-native').Text }));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      ScrollView: ReactNative.ScrollView,
      Text: ReactNative.Text,
      View: ReactNative.View,
    },
    cancelAnimation: jest.fn(),
    runOnJS:
      (callback: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) => {
        if (mockDeferJS) {
          mockJSQueue.push(() => callback(...args));
        } else {
          callback(...args);
        }
      },
    runOnUI: (callback: (...args: unknown[]) => unknown) => callback,
    scrollTo: jest.fn(),
    useAnimatedReaction: () => undefined,
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const ref = (component?: unknown) => {
          ref.current = component ?? null;
        };
        ref.current = null as unknown;
        return ref;
      }, []),
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedStyle: (factory: () => object) => factory(),
    useDerivedValue: (factory: () => unknown) => {
      const derived = ReactModule.useRef({ value: factory() }).current;
      derived.value = factory();
      return derived;
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    withDecay: (config: { velocity: number }) => config.velocity,
    withTiming: (
      target: number,
      _config: unknown,
      complete?: (finished?: boolean) => void,
    ) => {
      mockAnimations.push({ target, complete });
      return target;
    },
  };
});

import {
  CollapsibleSceneProvider,
  ScenePagerList,
  useCollapsibleSceneController,
} from '@rabby-wallet/rn-collapsible-scene-view';
import DevUISwipableSubScreen from './DevUISwipableSubScreen';

const keys = ['a', 'b', 'c'];
const fixtureRows = Object.fromEntries(
  keys.map(key => [
    key,
    Array.from({ length: 15 }, (_, index) => ({ key: `${key}-${index}` })),
  ]),
);
const fixtureHeader = (
  <View style={{ height: 100 }} testID="fixture-header">
    <View testID="fixture-trade" />
  </View>
);
const ControlledPager = ({
  activeKey = 'b',
  onIndexChange,
}: {
  activeKey?: string;
  onIndexChange: (key: string) => void;
}) => {
  const controller = useCollapsibleSceneController();
  return (
    <CollapsibleSceneProvider
      activeTab={activeKey}
      controller={controller}
      headerHeight={0}
      syncOffsetOnActivate={false}
      tabs={keys}>
      <ScenePagerList
        ListHeaderComponent={fixtureHeader}
        contentInsetTop={0}
        dataByKey={fixtureRows}
        keys={keys}
        keyExtractor={item => item.key}
        onIndexChange={onIndexChange}
        renderItem={({ item }) => <View testID={`fixture-row-${item.key}`} />}
        rowStartOffset={100}
        scrollOffset={controller.scrollY}
        tabKey={activeKey}
        testID="fixture-list"
      />
    </CollapsibleSceneProvider>
  );
};

const layoutPager = (testID = 'fixture-list-pager', width = 400) => {
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { height: 800, width, x: 0, y: 0 } },
  });
};
const beginDrag = () =>
  act(() => {
    mockGesture.handlers.onBegin();
    mockGesture.handlers.onStart();
  });
const moveDrag = (translationX: number) =>
  act(() => mockGesture.handlers.onUpdate({ translationX, velocityX: 0 }));
const releaseDrag = (translationX: number, success = true, velocityX = 0) =>
  act(() => {
    mockGesture.handlers.onEnd({ translationX, velocityX }, success);
    mockGesture.handlers.onFinalize();
  });
const completeAnimation = (finished = true) => {
  const animation = mockAnimations.shift();
  expect(animation).toBeDefined();
  act(() => animation?.complete?.(finished));
};
const flushJSQueue = () =>
  act(() => {
    while (mockJSQueue.length) {
      mockJSQueue.shift()?.();
    }
  });
const preview = () =>
  screen.getByTestId('scene-pager-preview', { includeHiddenElements: true });
const queryPreview = () =>
  screen.queryByTestId('scene-pager-preview', { includeHiddenElements: true });

beforeEach(() => {
  mockAnimations.length = 0;
  mockJSQueue.length = 0;
  mockDeferJS = false;
  mockGesture.handlers = {};
  jest.clearAllMocks();
});

describe('Swipable SubScreen harness', () => {
  it('swaps data without recreating the single native list when a tab is pressed', () => {
    render(<DevUISwipableSubScreen />);
    const list = screen.UNSAFE_getByType(FlatList);

    expect(screen.getByTestId('dev-perps-pager-row-a-0')).toBeTruthy();
    expect(screen.getByTestId('dev-perps-pager-active')).toHaveTextContent(
      'active=a rows=12',
    );

    fireEvent.press(screen.getByTestId('dev-perps-pager-tab-b'));

    expect(screen.getByTestId('dev-perps-pager-row-b-0')).toBeTruthy();
    expect(screen.queryByTestId('dev-perps-pager-row-a-0')).toBeNull();
    expect(screen.getByTestId('dev-perps-pager-active')).toHaveTextContent(
      'active=b rows=8',
    );
    expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
    expect(list.props.data.map((row: { key: string }) => row.key)).toEqual(
      Array.from({ length: 8 }, (_, index) => `b-${index}`),
    );
  });

  it('invalidates a queued settled commit after an external Tab press', () => {
    render(<DevUISwipableSubScreen />);
    const list = screen.UNSAFE_getByType(FlatList);
    layoutPager('dev-perps-pager-scroll-pager');
    beginDrag();
    moveDrag(-140);
    releaseDrag(-140);
    mockDeferJS = true;
    completeAnimation();
    expect(mockJSQueue).toHaveLength(1);

    fireEvent.press(screen.getByTestId('dev-perps-pager-tab-c'));
    flushJSQueue();

    expect(screen.getByTestId('dev-perps-pager-active')).toHaveTextContent(
      'active=c rows=5',
    );
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(queryPreview()).toBeNull();
  });
});

describe('ScenePagerList native-boundary component contracts', () => {
  it('mounts only ten non-interactive neighbour rows during a drag and leaves the header stationary', () => {
    render(<ControlledPager onIndexChange={jest.fn()} />);
    const list = screen.UNSAFE_getByType(FlatList);
    layoutPager();
    expect(queryPreview()).toBeNull();
    beginDrag();
    moveDrag(80);

    expect(preview().props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      pointerEvents: 'none',
    });
    expect(
      within(preview()).getAllByTestId(/^fixture-row-a-/, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(10);
    expect(
      within(preview()).queryByTestId('fixture-row-a-10', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    let headerParent = screen.getByTestId('fixture-trade').parent;
    while (headerParent && headerParent !== list) {
      const transforms = StyleSheet.flatten(
        headerParent.props.style,
      )?.transform;
      expect(transforms?.some(transform => 'translateX' in transform)).not.toBe(
        true,
      );
      headerParent = headerParent.parent;
    }
    expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);

    moveDrag(-80);
    expect(
      within(preview()).queryByTestId('fixture-row-a-0', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(
      within(preview()).getAllByTestId(/^fixture-row-c-/, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(10);
  });

  it('commits only after settling and retains preview until the new active key is acknowledged', () => {
    const onIndexChange = jest.fn();
    const SynchronousOwner = () => {
      const [activeKey, setActiveKey] = React.useState('b');
      return (
        <ControlledPager
          activeKey={activeKey}
          onIndexChange={key => {
            onIndexChange(key);
            setActiveKey(key);
          }}
        />
      );
    };
    render(<SynchronousOwner />);
    const list = screen.UNSAFE_getByType(FlatList);
    layoutPager();
    beginDrag();
    moveDrag(-140);
    expect(onIndexChange).not.toHaveBeenCalled();
    releaseDrag(-140);
    expect(mockAnimations.map(animation => animation.target)).toEqual([2]);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(preview()).toBeTruthy();
    mockDeferJS = true;
    completeAnimation();

    expect(onIndexChange).not.toHaveBeenCalled();
    expect(preview()).toBeTruthy();
    expect(list.props.data).toBe(fixtureRows.b);
    flushJSQueue();
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(onIndexChange).toHaveBeenCalledWith('c');
    expect(queryPreview()).toBeNull();
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(list.props.data).toBe(fixtureRows.c);
  });

  it.each(['rejected', 'batched rollback'])(
    'releases preview and the next gesture after a %s controlled request',
    outcome => {
      const onIndexChange = jest.fn();
      const RejectingOwner = () => {
        const [activeKey, setActiveKey] = React.useState('b');
        return (
          <ControlledPager
            activeKey={activeKey}
            onIndexChange={key => {
              onIndexChange(key);
              if (outcome === 'batched rollback') {
                setActiveKey(key);
                setActiveKey('b');
              }
            }}
          />
        );
      };
      render(<RejectingOwner />);
      layoutPager();
      beginDrag();
      moveDrag(-140);
      releaseDrag(-140);
      completeAnimation();
      expect(onIndexChange).toHaveBeenCalledWith('c');
      expect(queryPreview()).toBeNull();
      expect(screen.UNSAFE_getByType(FlatList).props.data).toBe(fixtureRows.b);

      const fail = jest.fn();
      act(() =>
        mockGesture.handlers.onTouchesDown(
          { allTouches: [{ y: 200 }], numberOfTouches: 1 },
          { fail },
        ),
      );
      expect(fail).not.toHaveBeenCalled();
      beginDrag();
      moveDrag(140);
      releaseDrag(140);
      completeAnimation();
      expect(onIndexChange.mock.calls).toEqual([['c'], ['a']]);
    },
  );

  it('does not commit an earlier drag direction when the gesture reverses below the release threshold', () => {
    const onIndexChange = jest.fn();
    render(<ControlledPager onIndexChange={onIndexChange} />);
    layoutPager();
    beginDrag();
    moveDrag(-160);
    moveDrag(40);
    releaseDrag(40);
    expect(mockAnimations.map(animation => animation.target)).toEqual([1]);
    completeAnimation();
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(queryPreview()).toBeNull();
    expect(screen.UNSAFE_getByType(FlatList).props.data).toBe(fixtureRows.b);
  });

  it.each(['cancelled', 'failed'])('does not commit a %s drag', state => {
    const onIndexChange = jest.fn();
    render(<ControlledPager onIndexChange={onIndexChange} />);
    layoutPager();
    beginDrag();
    moveDrag(-180);
    if (state === 'cancelled') {
      releaseDrag(-180, false);
    } else {
      act(() => mockGesture.handlers.onFinalize());
    }
    expect(mockAnimations.map(animation => animation.target)).toEqual([1]);
    completeAnimation();
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(queryPreview()).toBeNull();
  });

  it('ignores an interrupted settle animation', () => {
    const onIndexChange = jest.fn();
    render(<ControlledPager onIndexChange={onIndexChange} />);
    layoutPager();
    beginDrag();
    moveDrag(-180);
    releaseDrag(-180);
    completeAnimation(false);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('invalidates a queued settled commit after the measured width changes', () => {
    const onIndexChange = jest.fn();
    render(<ControlledPager onIndexChange={onIndexChange} />);
    layoutPager();
    beginDrag();
    moveDrag(-140);
    releaseDrag(-140);
    mockDeferJS = true;
    completeAnimation();
    expect(mockJSQueue).toHaveLength(1);
    layoutPager('fixture-list-pager', 500);
    flushJSQueue();
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(queryPreview()).toBeNull();
    expect(screen.UNSAFE_getByType(FlatList).props.data).toBe(fixtureRows.b);
  });

  it('keeps header touches and multi-touch outside the row pager gesture', () => {
    render(<ControlledPager onIndexChange={jest.fn()} />);
    const fail = jest.fn();
    act(() => {
      mockGesture.handlers.onTouchesDown(
        { allTouches: [{ y: 99 }], numberOfTouches: 1 },
        { fail },
      );
      mockGesture.handlers.onTouchesDown(
        { allTouches: [{ y: 200 }], numberOfTouches: 2 },
        { fail },
      );
    });
    expect(fail).toHaveBeenCalledTimes(2);
    act(() =>
      mockGesture.handlers.onTouchesDown(
        { allTouches: [{ y: 200 }], numberOfTouches: 1 },
        { fail },
      ),
    );
    expect(fail).toHaveBeenCalledTimes(2);
  });

  it('does not start a horizontal rebound for a vertical gesture that never activates', () => {
    const onIndexChange = jest.fn();
    render(<ControlledPager onIndexChange={onIndexChange} />);
    act(() => {
      mockGesture.handlers.onBegin();
      mockGesture.handlers.onFinalize();
    });
    expect(mockAnimations).toHaveLength(0);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(queryPreview()).toBeNull();
  });
});
