import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { FlatList, Text, View } from 'react-native';

const mockGesture = { handlers: {} as Record<string, jest.Mock> };
const mockAnimations: Array<{
  target: number;
  complete?: (finished?: boolean) => void;
}> = [];
const mockJSQueue: Array<() => unknown> = [];
const mockAnimatedStyleReaders = new WeakMap<object, () => object>();
let mockDeferJS = false;

jest.mock('react-native-gesture-handler', () => ({
  Pressable: require('react-native').Pressable,
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
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      ScrollView: ReactNative.ScrollView,
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
    useAnimatedStyle: (factory: () => object) => {
      const style = factory();
      // Read the actual style worklet on demand after mocked UI values change;
      // this does not simulate native props publication or mapper scheduling.
      mockAnimatedStyleReaders.set(style, factory);
      return style;
    },
    useDerivedValue: (factory: () => unknown) => {
      const latestFactory = ReactModule.useRef(factory);
      latestFactory.current = factory;
      return ReactModule.useMemo(
        () => ({
          get value() {
            return latestFactory.current();
          },
        }),
        [],
      );
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
  type LinkedPagerTrack,
  ScenePagerGroup,
  ScenePagerGroupRow,
  ScenePagerItem,
  useScenePagerGroupPreview,
  useScenePagerGroupTrack,
} from '@rabby-wallet/rn-collapsible-scene-view';
// The app Jest root does not otherwise discover the package's pure math suite.
import '../../../../../packages/rn-collapsible-scene-view/src/linkedPagerMath.test';
import DevUILinkedSubScreen from './DevUILinkedSubScreen';

const rootKeys = ['pro', 'simple'];
const tabKeys = ['positions', 'openOrders', 'account'];
const pillKeys = ['basic', 'conditional'];
const renderPreview = jest.fn((value: unknown) => JSON.stringify(value));

function TrackProbe() {
  const root = useScenePagerGroupTrack('root');
  const tabs = useScenePagerGroupTrack('tabs');
  const pills = useScenePagerGroupTrack('pills');
  const preview = useScenePagerGroupPreview();
  return (
    <>
      <ScenePagerItem pageKey="pro" track={root}>
        <View testID="root-content" />
      </ScenePagerItem>
      <ScenePagerItem pageKey="openOrders" track={tabs}>
        <View testID="tab-content" />
      </ScenePagerItem>
      <ScenePagerItem pageKey="basic" track={pills}>
        <View testID="pill-content" />
      </ScenePagerItem>
      <Text testID="fixture-preview">{renderPreview(preview)}</Text>
    </>
  );
}

function ControlledGroup({
  root = 'pro',
  tab = 'openOrders',
  pill = 'basic',
  onIndexChange,
  scrollOffset,
  children,
}: {
  root?: string;
  tab?: string;
  pill?: string;
  onIndexChange: (trackKey: string, pageKey: string) => void;
  scrollOffset?: { value: number };
  children?: React.ReactNode;
}) {
  const localScrollOffset = React.useRef({ value: 0 }).current;
  const tracks = React.useMemo<LinkedPagerTrack[]>(
    () => [
      { key: 'root', keys: rootKeys, activeKey: root, startOffset: 0 },
      {
        key: 'tabs',
        keys: tabKeys,
        activeKey: tab,
        parentKey: 'root',
        parentPageKey: 'pro',
        startOffset: 320,
      },
      {
        key: 'pills',
        keys: pillKeys,
        activeKey: pill,
        parentKey: 'tabs',
        parentPageKey: 'openOrders',
        startOffset: 416,
      },
    ],
    [pill, root, tab],
  );
  return (
    <ScenePagerGroup
      onIndexChange={onIndexChange}
      scrollOffset={
        (scrollOffset ?? localScrollOffset) as React.ComponentProps<
          typeof ScenePagerGroup
        >['scrollOffset']
      }
      tracks={tracks}
      testID="fixture-group">
      <TrackProbe />
      {children}
    </ScenePagerGroup>
  );
}

const layout = (testID = 'fixture-group', width = 400, height = 800) =>
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { width, height, x: 0, y: 0 } },
  });
const beginDrag = (y = 500) => {
  const manager = { fail: jest.fn() };
  act(() => {
    mockGesture.handlers.onBegin();
    mockGesture.handlers.onTouchesDown(
      { allTouches: [{ y }], numberOfTouches: 1 },
      manager,
    );
    if (!manager.fail.mock.calls.length) {
      mockGesture.handlers.onStart();
    }
  });
  return manager;
};
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
const swipe = (translationX: number, y = 500) => {
  expect(beginDrag(y).fail).not.toHaveBeenCalled();
  moveDrag(translationX);
  releaseDrag(translationX);
  completeAnimation();
};
const flushJSQueue = () =>
  act(() => {
    while (mockJSQueue.length) {
      mockJSQueue.shift()?.();
    }
  });
const fixturePreview = () =>
  JSON.parse(screen.getByTestId('fixture-preview').props.children);
const preview = () =>
  screen.getByTestId('linked-pager-preview', { includeHiddenElements: true });
const queryPreview = () =>
  screen.queryByTestId('linked-pager-preview', {
    includeHiddenElements: true,
  });
const trackPosition = (pageKey: string) => {
  const item = screen
    .UNSAFE_getAllByType(ScenePagerItem)
    .find(node => node.props.pageKey === pageKey);
  expect(item).toBeDefined();
  return item!.props.track.position.value as number;
};
const rowTranslation = (testID: string) => {
  let row = screen.getByTestId(testID).parent;
  while (row && row.type !== ScenePagerGroupRow) {
    row = row.parent;
  }
  expect(row).not.toBeNull();
  const host = row!.findAllByType(View)[0];
  const style = mockAnimatedStyleReaders.get(host.props.style);
  expect(style).toBeDefined();
  return (style!() as { transform: [{ translateX: number }] }).transform[0]
    .translateX;
};
const expectSelection = (selection: string) =>
  expect(screen.getByTestId('linked-pager-selection')).toHaveTextContent(
    selection,
  );
const prepareHarness = () => {
  render(<DevUILinkedSubScreen onBack={jest.fn()} />);
  layout('linked-pager-group');
  layout('linked-pager-list');
  fireEvent.press(screen.getByTestId('linked-tab-openOrders'));
};

beforeEach(() => {
  mockGesture.handlers = {};
  mockAnimations.length = 0;
  mockJSQueue.length = 0;
  mockDeferJS = false;
  jest.clearAllMocks();
});

// Worklet/animation callbacks run under explicit test control. These are
// component contracts, not evidence of native recognizer arbitration or FPS.
describe('Linked SubScreen harness component contracts', () => {
  it('keeps one mounted FlatList through pill, tab, root and reverse transitions', () => {
    prepareHarness();
    const list = screen.UNSAFE_getByType(FlatList);
    expectSelection('pro / openOrders / basic');
    expect(list.props.data[0].key).toBe('basic-0');

    for (const [selection, row, enabled] of [
      ['pro / openOrders / conditional', 'conditional-0', true],
      ['pro / account / conditional', 'account-0', true],
      ['simple / account / conditional', 'account-0', false],
    ]) {
      beginDrag();
      moveDrag(-150);
      releaseDrag(-150);
      const previousData = list.props.data;
      expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
      completeAnimation();
      expectSelection(selection as string);
      expect(list.props.data[0].key).toBe(row);
      expect(list.props.scrollEnabled).toBe(enabled);
      expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
      expect(queryPreview()).toBeNull();
      if (!enabled) {
        expect(list.props.data).toBe(previousData);
      }
    }

    for (const selection of [
      'pro / account / conditional',
      'pro / openOrders / conditional',
      'pro / openOrders / basic',
      'pro / positions / basic',
    ]) {
      swipe(150);
      expectSelection(selection);
      expect(screen.UNSAFE_getAllByType(FlatList)).toEqual([list]);
      expect(list.props.scrollEnabled).toBe(true);
    }
  });

  it('waits for settlement before swapping data and bounds the inert neighbour preview', () => {
    prepareHarness();
    layout('linked-pager-list', 400, 2000);
    const list = screen.UNSAFE_getByType(FlatList);
    const data = list.props.data;
    expect(queryPreview()).toBeNull();
    beginDrag();
    moveDrag(-80);
    expect(preview().props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(
      within(preview()).getAllByTestId(/^linked-row-conditional-/, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(10);
    expect(list.props.data).toBe(data);
    expectSelection('pro / openOrders / basic');
    releaseDrag(-150);
    expect(list.props.data).toBe(data);
    expect(queryPreview()).not.toBeNull();
    completeAnimation();
    expectSelection('pro / openOrders / conditional');
    expect(list.props.data[0].key).toBe('conditional-0');
    expect(queryPreview()).toBeNull();
  });

  it('keeps header and trade outside both descendant transforms', () => {
    prepareHarness();
    for (const title of ['Pro / Header & Market', 'Trade']) {
      let ancestor = screen.getByText(title).parent;
      const pages: string[] = [];
      while (ancestor) {
        if (ancestor.type === ScenePagerItem) {
          pages.push(ancestor.props.pageKey);
        }
        ancestor = ancestor.parent;
      }
      expect(pages).toEqual(['pro']);
    }
    beginDrag();
    moveDrag(-80);
    expect(trackPosition('pro')).toBe(0);
    const row = screen.UNSAFE_getAllByType(ScenePagerGroupRow)[0];
    expect(row.props.pages).toEqual({ tabs: 'openOrders', pills: 'basic' });
    expect(rowTranslation('linked-row-basic-0')).toBe(-80);
    let ancestor = screen.getByTestId('linked-row-basic-0').parent;
    const rowPages: string[] = [];
    while (ancestor) {
      if (ancestor.type === ScenePagerItem) {
        rowPages.push(ancestor.props.pageKey);
      }
      ancestor = ancestor.parent;
    }
    expect(rowPages).toEqual(['pro']);
    releaseDrag(-80);
    completeAnimation();
    swipe(-150, 200);
    expectSelection('simple / openOrders / basic');
  });

  it('invalidates an already queued commit after a Tab click', () => {
    prepareHarness();
    const list = screen.UNSAFE_getByType(FlatList);
    beginDrag();
    moveDrag(-150);
    releaseDrag(-150);
    mockDeferJS = true;
    completeAnimation();
    expect(mockJSQueue).toHaveLength(1);
    fireEvent.press(screen.getByTestId('linked-tab-account'));
    flushJSQueue();
    expectSelection('pro / account / basic');
    expect(list.props.data[0].key).toBe('account-0');
    expect(screen.UNSAFE_getByType(FlatList)).toBe(list);
    expect(queryPreview()).toBeNull();
  });

  it('allows the explicit back action without selecting a page', () => {
    const onBack = jest.fn();
    render(<DevUILinkedSubScreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('linked-pager-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expectSelection('pro / positions / basic');
  });
});

describe('ScenePagerGroupRow component contracts', () => {
  it.each([
    [undefined, 0, -80],
    [{ startOffset: -1, endOffset: 0 }, 0, -80],
    [{ startOffset: 900, endOffset: 999 }, 0, 0],
    [{ startOffset: 900, endOffset: 1000 }, 0, -80],
    [{ startOffset: 900, endOffset: 1001 }, 0, -80],
    [{ startOffset: 1199, endOffset: 1300 }, 0, -80],
    [{ startOffset: 1200, endOffset: 1300 }, 0, -80],
    [{ startOffset: 1201, endOffset: 1300 }, 0, 0],
    [{ startOffset: 800, endOffset: 900 }, 100, -80],
    [{ startOffset: 799, endOffset: 899 }, 100, 0],
    [{ startOffset: 1300, endOffset: 1400 }, 100, -80],
    [{ startOffset: 1301, endOffset: 1400 }, 100, 0],
  ] as const)(
    'gates the actual style worklet for bounds %s and overscan %s',
    (contentBounds, overscan, expectedTranslation) => {
      render(
        <ControlledGroup
          scrollOffset={{ value: 1000 }}
          onIndexChange={jest.fn()}>
          <ScenePagerGroupRow
            pages={{ tabs: 'openOrders', pills: 'basic' }}
            contentBounds={contentBounds}
            overscan={overscan}>
            <View testID="bounded-row" />
          </ScenePagerGroupRow>
        </ControlledGroup>,
      );
      layout('fixture-group', 400, 200);
      expect(rowTranslation('bounded-row')).toBe(0);
      beginDrag(100);
      moveDrag(-80);
      expect(rowTranslation('bounded-row')).toBe(expectedTranslation);
      expect(trackPosition('pro')).toBe(0);
      expect(trackPosition('openOrders')).toBe(1);
      moveDrag(-120);
      expect(rowTranslation('bounded-row')).toBe(
        expectedTranslation === 0 ? 0 : -120,
      );
      releaseDrag(-120, false);
      completeAnimation();
      expect(rowTranslation('bounded-row')).toBe(0);
    },
  );

  it('retains participation while viewport height is unknown', () => {
    render(
      <ControlledGroup onIndexChange={jest.fn()}>
        <ScenePagerGroupRow
          pages={{ pills: 'basic' }}
          contentBounds={{ startOffset: 10000, endOffset: 10096 }}>
          <View testID="unknown-viewport-row" />
        </ScenePagerGroupRow>
      </ControlledGroup>,
    );
    layout('fixture-group', 400, 0);
    beginDrag();
    moveDrag(-80);
    expect(rowTranslation('unknown-viewport-row')).toBe(-80);
  });

  it('moves only the owner present in pages and never sums parent and child offsets', () => {
    render(
      <ControlledGroup onIndexChange={jest.fn()}>
        <ScenePagerGroupRow pages={{ tabs: 'openOrders', pills: 'basic' }}>
          <View testID="combined-row" />
        </ScenePagerGroupRow>
        <ScenePagerGroupRow pages={{ tabs: 'openOrders' }}>
          <View testID="tab-only-row" />
        </ScenePagerGroupRow>
        <ScenePagerGroupRow pages={{ pills: 'unknown-page' }}>
          <View testID="unknown-page-row" />
        </ScenePagerGroupRow>
        <ScenePagerGroupRow pages={{ root: 'pro' }}>
          <View testID="root-only-row" />
        </ScenePagerGroupRow>
      </ControlledGroup>,
    );
    layout();
    beginDrag();
    moveDrag(-80);
    expect(rowTranslation('combined-row')).toBe(-80);
    expect(rowTranslation('tab-only-row')).toBe(0);
    expect(rowTranslation('unknown-page-row')).toBe(0);
    expect(rowTranslation('root-only-row')).toBe(0);
    moveDrag(80);
    expect(rowTranslation('combined-row')).toBeCloseTo(80);
    expect(rowTranslation('tab-only-row')).toBeCloseTo(80);
    expect(rowTranslation('unknown-page-row')).toBe(0);
    expect(rowTranslation('root-only-row')).toBe(0);
    releaseDrag(80, false);
    completeAnimation();
    beginDrag(200);
    moveDrag(-80);
    expect(rowTranslation('combined-row')).toBe(0);
    expect(rowTranslation('tab-only-row')).toBe(0);
    expect(rowTranslation('root-only-row')).toBe(-80);
  });

  it('keeps a deep gesture viewport fixed until the next touch, without reading live scroll per row', () => {
    let liveOffset = 10000;
    const readOffset = jest.fn(() => liveOffset);
    const scrollOffset = {
      get value() {
        return readOffset();
      },
    };
    render(
      <ControlledGroup scrollOffset={scrollOffset} onIndexChange={jest.fn()}>
        <ScenePagerGroupRow
          pages={{ pills: 'basic' }}
          contentBounds={{ startOffset: 416, endOffset: 512 }}>
          <View testID="top-row" />
        </ScenePagerGroupRow>
        <ScenePagerGroupRow
          pages={{ pills: 'basic' }}
          contentBounds={{ startOffset: 10000, endOffset: 10096 }}>
          <View testID="deep-row" />
        </ScenePagerGroupRow>
      </ControlledGroup>,
    );
    layout('fixture-group', 400, 800);
    beginDrag(100);
    const readsAtStart = readOffset.mock.calls.length;
    liveOffset = 0;
    for (const translation of [-40, -80, -120]) {
      moveDrag(translation);
      expect(rowTranslation('deep-row')).toBe(translation);
      expect(rowTranslation('top-row')).toBe(0);
    }
    expect(readOffset).toHaveBeenCalledTimes(readsAtStart);
    expect(fixturePreview()).toMatchObject({ scrollOffset: 10000 });
    releaseDrag(-120, false);
    completeAnimation();
    beginDrag(500);
    expect(readOffset.mock.calls.length).toBeGreaterThan(readsAtStart);
    moveDrag(-80);
    expect(rowTranslation('deep-row')).toBe(0);
    expect(rowTranslation('top-row')).toBe(-80);
    expect(fixturePreview()).toMatchObject({ scrollOffset: 0 });
  });

  it('resets a row and cancels its pending selection when viewport height changes mid-drag', () => {
    const onIndexChange = jest.fn();
    render(
      <ControlledGroup onIndexChange={onIndexChange}>
        <ScenePagerGroupRow
          pages={{ pills: 'basic' }}
          contentBounds={{ startOffset: 416, endOffset: 512 }}>
          <View testID="height-change-row" />
        </ScenePagerGroupRow>
      </ControlledGroup>,
    );
    layout();
    beginDrag();
    moveDrag(-150);
    expect(rowTranslation('height-change-row')).toBe(-150);
    layout('fixture-group', 400, 400);
    expect(rowTranslation('height-change-row')).toBe(0);
    expect(fixturePreview()).toBeNull();
    releaseDrag(-150);
    expect(mockAnimations).toHaveLength(0);
    expect(onIndexChange).not.toHaveBeenCalled();
    beginDrag(100);
    moveDrag(-150);
    expect(rowTranslation('height-change-row')).toBe(0);
    expect(fixturePreview()).toMatchObject({ trackKey: 'root' });
  });
});

describe('ScenePagerGroup controlled component contracts', () => {
  it('does not rerender the same preview on further drag updates or release', () => {
    const onIndexChange = jest.fn();
    render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    beginDrag();
    moveDrag(-80);
    const previewRenders = renderPreview.mock.calls.length;
    const published = fixturePreview();
    expect(published).toMatchObject({
      trackKey: 'pills',
      pageKey: 'conditional',
    });
    moveDrag(-150);
    releaseDrag(-150);
    expect(renderPreview).toHaveBeenCalledTimes(previewRenders);
    expect(fixturePreview()).toEqual(published);
    expect(onIndexChange).not.toHaveBeenCalled();
    completeAnimation();
    expect(onIndexChange).toHaveBeenCalledWith('pills', 'conditional');
    expect(fixturePreview()).toBeNull();
    expect(renderPreview.mock.calls.length).toBeGreaterThan(previewRenders);
  });

  it.each([
    ['basic', 500, 'pills', 'conditional', [0, 1, 0.375]],
    ['conditional', 500, 'tabs', 'account', [0, 1.375, 1]],
    ['basic', 350, 'tabs', 'account', [0, 1.375, 0]],
    ['basic', 200, 'root', 'simple', [0.375, 1, 0]],
  ] as const)(
    'routes %s at content y=%s to only the eligible owner',
    (pill, y, owner, page, positions) => {
      const onIndexChange = jest.fn();
      render(<ControlledGroup pill={pill} onIndexChange={onIndexChange} />);
      layout();
      beginDrag(y);
      moveDrag(-150);
      expect([
        trackPosition('pro'),
        trackPosition('openOrders'),
        trackPosition('basic'),
      ]).toEqual(positions);
      expect(fixturePreview()).toMatchObject({
        trackKey: owner,
        pageKey: page,
      });
      releaseDrag(-150);
      expect(onIndexChange).not.toHaveBeenCalled();
      completeAnimation();
      expect(onIndexChange).toHaveBeenCalledWith(owner, page);
    },
  );

  it('hands the same active drag back from a parent to its child when direction reverses', () => {
    const onIndexChange = jest.fn();
    render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    beginDrag();
    moveDrag(150);
    expect(fixturePreview()).toMatchObject({
      trackKey: 'tabs',
      pageKey: 'positions',
    });
    expect(trackPosition('openOrders')).toBe(0.625);
    expect(trackPosition('basic')).toBe(0);
    moveDrag(-150);
    expect(fixturePreview()).toMatchObject({
      trackKey: 'pills',
      pageKey: 'conditional',
    });
    expect(trackPosition('openOrders')).toBe(1);
    expect(trackPosition('basic')).toBe(0.375);
    releaseDrag(-150);
    completeAnimation();
    expect(onIndexChange.mock.calls).toEqual([['pills', 'conditional']]);
  });

  it('uses the final meaningful reverse velocity for both owner and target', () => {
    const onIndexChange = jest.fn();
    render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    beginDrag();
    moveDrag(-150);
    expect(fixturePreview().trackKey).toBe('pills');
    releaseDrag(-150, true, 800);
    expect(fixturePreview()).toMatchObject({
      trackKey: 'tabs',
      pageKey: 'positions',
    });
    completeAnimation();
    expect(onIndexChange.mock.calls).toEqual([['tabs', 'positions']]);
  });

  it('captures content coordinates and preview offset once at touch down', () => {
    const scrollOffset = { value: 400 };
    const onIndexChange = jest.fn();
    render(
      <ControlledGroup
        scrollOffset={scrollOffset}
        onIndexChange={onIndexChange}
      />,
    );
    layout();
    beginDrag(100);
    scrollOffset.value = 0;
    moveDrag(-150);
    expect(fixturePreview()).toEqual({
      trackKey: 'pills',
      pageKey: 'conditional',
      scrollOffset: 400,
    });
    releaseDrag(-150);
    completeAnimation();
    expect(onIndexChange).toHaveBeenCalledWith('pills', 'conditional');
  });

  it.each(['short', 'cancelled', 'interrupted'])(
    'never commits a %s gesture',
    outcome => {
      const onIndexChange = jest.fn();
      render(<ControlledGroup onIndexChange={onIndexChange} />);
      layout();
      beginDrag();
      moveDrag(outcome === 'short' ? -80 : -150);
      releaseDrag(outcome === 'short' ? -80 : -150, outcome !== 'cancelled');
      completeAnimation(outcome !== 'interrupted');
      expect(onIndexChange).not.toHaveBeenCalled();
      if (outcome !== 'interrupted') {
        expect(fixturePreview()).toBeNull();
        expect(trackPosition('basic')).toBe(0);
        expect(beginDrag().fail).not.toHaveBeenCalled();
      }
    },
  );

  it('does not animate a vertical failure that never activated the horizontal recognizer', () => {
    render(<ControlledGroup onIndexChange={jest.fn()} />);
    layout();
    act(() => {
      mockGesture.handlers.onBegin();
      mockGesture.handlers.onEnd({ translationX: 3, velocityX: 0 }, false);
      mockGesture.handlers.onFinalize();
    });
    expect(mockAnimations).toHaveLength(0);
    expect(fixturePreview()).toBeNull();
  });

  it('refuses a second touch while settlement owns the track', () => {
    render(<ControlledGroup onIndexChange={jest.fn()} />);
    layout();
    beginDrag();
    moveDrag(-150);
    releaseDrag(-150);
    expect(beginDrag().fail).toHaveBeenCalledTimes(1);
    completeAnimation();
    expect(beginDrag().fail).not.toHaveBeenCalled();
  });

  it('recovers from a rejected controlled update and permits the next gesture', () => {
    const onIndexChange = jest.fn();
    render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    swipe(-150);
    expect(onIndexChange.mock.calls).toEqual([['pills', 'conditional']]);
    expect(fixturePreview()).toBeNull();
    expect(trackPosition('basic')).toBe(0);
    swipe(150);
    expect(onIndexChange.mock.calls).toEqual([
      ['pills', 'conditional'],
      ['tabs', 'positions'],
    ]);
  });

  it.each(['selection', 'width', 'height', 'unmount'])(
    'discards a queued settlement after %s invalidates its generation',
    invalidation => {
      const onIndexChange = jest.fn();
      const view = render(<ControlledGroup onIndexChange={onIndexChange} />);
      layout();
      beginDrag();
      moveDrag(-150);
      releaseDrag(-150);
      mockDeferJS = true;
      completeAnimation();
      expect(mockJSQueue).toHaveLength(1);
      if (invalidation === 'selection') {
        view.rerender(
          <ControlledGroup tab="account" onIndexChange={onIndexChange} />,
        );
      } else if (invalidation === 'width') {
        layout('fixture-group', 800);
      } else if (invalidation === 'height') {
        layout('fixture-group', 400, 400);
      } else {
        view.unmount();
      }
      flushJSQueue();
      expect(onIndexChange).not.toHaveBeenCalled();
      if (invalidation !== 'unmount') {
        expect(fixturePreview()).toBeNull();
      }
    },
  );

  it.each(['selection', 'width', 'height', 'unmount'])(
    'discards a queued preview after %s invalidates its generation',
    invalidation => {
      const onIndexChange = jest.fn();
      const view = render(<ControlledGroup onIndexChange={onIndexChange} />);
      layout();
      mockDeferJS = true;
      beginDrag();
      moveDrag(-150);
      expect(mockJSQueue).toHaveLength(1);
      if (invalidation === 'selection') {
        view.rerender(
          <ControlledGroup pill="conditional" onIndexChange={onIndexChange} />,
        );
      } else if (invalidation === 'width') {
        layout('fixture-group', 800);
      } else if (invalidation === 'height') {
        layout('fixture-group', 400, 400);
      } else {
        view.unmount();
      }
      flushJSQueue();
      expect(onIndexChange).not.toHaveBeenCalled();
      if (invalidation !== 'unmount') {
        expect(fixturePreview()).toBeNull();
      }
    },
  );

  it('does not invalidate an active gesture for a same-configuration parent render', () => {
    const onIndexChange = jest.fn();
    const view = render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    beginDrag();
    moveDrag(-150);
    view.rerender(<ControlledGroup onIndexChange={onIndexChange} />);
    releaseDrag(-150);
    completeAnimation();
    expect(onIndexChange.mock.calls).toEqual([['pills', 'conditional']]);
  });

  it('keeps drag motion independent of a blocked JS preview queue', () => {
    const onIndexChange = jest.fn();
    render(<ControlledGroup onIndexChange={onIndexChange} />);
    layout();
    mockDeferJS = true;
    beginDrag();
    for (const distance of [-40, -80, -120]) {
      moveDrag(distance);
      expect(trackPosition('basic')).toBe(-distance / 400);
      expect(trackPosition('openOrders')).toBe(1);
      expect(trackPosition('pro')).toBe(0);
    }
    expect(mockJSQueue).toHaveLength(1);
    expect(fixturePreview()).toBeNull();
    expect(onIndexChange).not.toHaveBeenCalled();
    flushJSQueue();
    expect(fixturePreview()).toMatchObject({
      trackKey: 'pills',
      pageKey: 'conditional',
    });
    releaseDrag(-120);
    completeAnimation();
    expect(onIndexChange).not.toHaveBeenCalled();
    flushJSQueue();
    expect(onIndexChange.mock.calls).toEqual([['pills', 'conditional']]);
    expect(fixturePreview()).toBeNull();
  });
});
