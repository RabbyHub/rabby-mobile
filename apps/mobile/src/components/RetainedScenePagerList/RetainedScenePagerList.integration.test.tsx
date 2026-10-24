import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { createStore } from 'zustand/vanilla';
import {
  CollapsibleSceneProvider,
  SceneList,
} from '@rabby-wallet/rn-collapsible-scene-view';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import type { StoreActivityScope } from '@/core/state/storeActivity';
import {
  RetainedScenePagerList,
  RetainedScenePagerBody,
  type RetainedScenePagerBodyHandle,
  type RetainedScenePagerListHandle,
  type RetainedScenePagerPageContext,
} from './RetainedScenePagerList';

const mockSetPage = jest.fn();
const mockPageCommands = jest.fn();
const mockJSQueue: Array<() => void> = [];
let mockDeferJS = false;

// Keep the real SceneList, provider, reducer, nested FlatLists and activity
// scopes. These native boundary fakes expose callbacks, not animation/layout.
jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react') as typeof React;
  const NativeView = require('react-native').View;
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function NativePagerBoundary(
      props: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<unknown>,
    ) {
      ReactModule.useImperativeHandle(
        ref,
        () => ({
          setPage: (index: number) => {
            mockSetPage(index);
            mockPageCommands(props.testID, index);
          },
        }),
        [props.testID],
      );
      return <NativeView {...props} />;
    }),
  };
});

jest.mock('react-native-gesture-handler', () => ({}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      View: native.View,
      ScrollView: native.ScrollView,
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const callback = (instance: unknown) => {
          callback.current = instance;
        };
        callback.current = null as unknown;
        return callback;
      }, []),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous: unknown) => void,
      dependencies: React.DependencyList = [],
    ) => {
      const previous = ReactModule.useRef<unknown>(null);
      ReactModule.useEffect(() => {
        const current = prepare();
        react(current, previous.current);
        previous.current = current;
      }, dependencies);
    },
    useAnimatedScrollHandler:
      (handlers: { onScroll: (event: unknown) => void }) =>
      (event: { nativeEvent: unknown }) =>
        handlers.onScroll(event.nativeEvent),
    useEvent: (handler: unknown) => handler,
    runOnUI: (callback: (...args: unknown[]) => void) => callback,
    runOnJS:
      (callback: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        if (mockDeferJS) {
          mockJSQueue.push(() => callback(...args));
        } else {
          callback(...args);
        }
      },
    scrollTo: jest.fn(),
  };
});

const keys = ['positions', 'orders', 'history'];
const hidden = { includeHiddenElements: true };
const pager = () => screen.getByTestId('subject-pager', hidden);
const page = (index: number) =>
  screen.getByTestId(`subject-page-${keys[index]}`, hidden);
const list = (index: number) =>
  screen.getByTestId(`subject-rows-${keys[index]}`, hidden);
const row = (index: number) => screen.getByTestId(`row-${keys[index]}`, hidden);
const pageState = (pageScrollState: 'dragging' | 'settling' | 'idle') =>
  fireEvent(pager(), 'pageScrollStateChanged', { pageScrollState });
const pageScroll = (position: number, offset: number) =>
  fireEvent(pager(), 'pageScroll', { position, offset });
const selected = (position: number) =>
  fireEvent(pager(), 'pageSelected', { position });
const flushJS = () =>
  act(() => {
    while (mockJSQueue.length) {
      mockJSQueue.shift()?.();
    }
  });

type FixtureProps = {
  revision?: number;
  activityEnabled?: boolean;
  identityKey?: string;
};
function mountFixture(initialKey = keys[0]) {
  const store = createStore(() => ({ revision: 0 }));
  const ref = React.createRef<RetainedScenePagerListHandle>();
  const settled = jest.fn();
  const changed = jest.fn();
  const mounts = [0, 0, 0];
  const unmounts = [0, 0, 0];
  const renders = [0, 0, 0];
  const scopes: Array<StoreActivityScope | null> = [null, null, null];
  const data = Object.fromEntries(keys.map(key => [key, [{ key }]]));
  const pageStyles = Object.fromEntries(
    keys.map(key => [key, { minHeight: 300 }]),
  );

  function Row({ index, revision }: { index: number; revision: number }) {
    scopes[index] = useStoreActivityScope();
    const sourceRevision = useActivityStore(store, state => state.revision);
    renders[index] += 1;
    React.useEffect(() => {
      mounts[index] += 1;
      return () => {
        unmounts[index] += 1;
      };
    }, [index]);
    return (
      <View
        testID={`row-${keys[index]}`}
        accessibilityLabel={`${revision}:${sourceRevision}`}
      />
    );
  }

  function Fixture({
    revision = 0,
    activityEnabled = true,
    identityKey = 'account-a',
  }: FixtureProps) {
    const [activeKey, setActiveKey] = React.useState(initialKey);
    const scrollOffset = useSharedValue(0);
    const indicatorPosition = useSharedValue(keys.indexOf(initialKey));
    const gestureActive = useSharedValue(false);
    const renderers = React.useMemo(
      () =>
        Object.fromEntries(
          keys.map((key, index) => [
            key,
            (() => (
              <Row index={index} revision={revision} />
            )) as ListRenderItem<{ key: string }>,
          ]),
        ),
      [revision],
    );
    return (
      <CollapsibleSceneProvider
        activeTab={activeKey}
        tabs={keys}
        headerHeight={100}
        scrollOffset={scrollOffset}
        syncOffsetOnActivate={false}>
        <RetainedScenePagerList
          ref={ref}
          activeKey={activeKey}
          keys={keys}
          identityKey={identityKey}
          activityEnabled={activityEnabled}
          dataByKey={data}
          renderItemByKey={renderers}
          pageStyleByKey={pageStyles}
          listHeader={
            <View testID="shared-header">
              <View testID="shared-trade" />
            </View>
          }
          rowStartOffset={148}
          pinnedHeight={48}
          scrollOffset={scrollOffset}
          indicatorPosition={indicatorPosition}
          gestureActive={gestureActive}
          testID="subject"
          onTabChange={key => {
            settled(key);
            // Production parents own the persisted/user-visible tab selection.
            // A cancelled gesture settles its source, not a new selection.
            if (key !== activeKey) {
              changed(key);
              setActiveKey(key);
            }
          }}
        />
      </CollapsibleSceneProvider>
    );
  }

  const rendered = render(<Fixture />);
  return {
    ...rendered,
    store,
    settled,
    changed,
    mounts,
    unmounts,
    renders,
    scopes,
    request: (index: number) => act(() => ref.current?.selectTab(keys[index])),
    rerenderFixture: (props: FixtureProps) =>
      rendered.rerender(<Fixture {...props} />),
  };
}

const pillKeys = ['basic', 'conditional'];
const nestedNode = (id: string) => screen.getByTestId(id, hidden);
const nestedSelected = (owner: 'outer' | 'inner', position: number) =>
  fireEvent(nestedNode(`${owner}-pager`), 'pageSelected', { position });
const nestedState = (
  owner: 'outer' | 'inner',
  pageScrollState: 'dragging' | 'idle',
) =>
  fireEvent(nestedNode(`${owner}-pager`), 'pageScrollStateChanged', {
    pageScrollState,
  });
const nestedScroll = (
  owner: 'outer' | 'inner',
  position: number,
  offset: number,
) =>
  fireEvent(nestedNode(`${owner}-pager`), 'pageScroll', { position, offset });
const measureNode = (id: string, height: number) =>
  fireEvent(nestedNode(id), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
  });
const nodeHeight = (id: string) =>
  StyleSheet.flatten(nestedNode(id).props.style)?.height;

function mountNestedFixture(initialKey = 'orders', initialPill = 'basic') {
  const store = createStore(() => ({ revision: 0 }));
  const outerRef = React.createRef<RetainedScenePagerListHandle>();
  const innerRef = React.createRef<RetainedScenePagerBodyHandle>();
  const outerChanged = jest.fn();
  const innerChanged = jest.fn();
  const mounts = { basic: 0, conditional: 0 };
  const unmounts = { basic: 0, conditional: 0 };
  const scopes = new Map<string, StoreActivityScope>();
  const data = Object.fromEntries(keys.map(key => [key, [{ key }]]));
  const pillData = Object.fromEntries(pillKeys.map(key => [key, [{ key }]]));
  const pageStyles = Object.fromEntries(keys.map(key => [key, {}]));
  const pillStyles = Object.fromEntries(pillKeys.map(key => [key, {}]));
  const outerRenderers = Object.fromEntries(
    keys.map(key => [key, () => <View testID={`outer-leaf-${key}`} />]),
  );
  let motion: {
    scroll: SharedValue<number>;
    outerIndicator: SharedValue<number>;
    innerIndicator: SharedValue<number>;
    outerGesture: SharedValue<boolean>;
    innerGesture: SharedValue<boolean>;
  };

  function PillRow({
    name,
    identityKey,
    revision,
  }: {
    name: 'basic' | 'conditional';
    identityKey: string;
    revision: number;
  }) {
    scopes.set(name, useStoreActivityScope());
    const sourceRevision = useActivityStore(store, state => state.revision);
    React.useEffect(() => {
      mounts[name] += 1;
      return () => {
        unmounts[name] += 1;
      };
    }, [name]);
    return (
      <View
        testID={`pill-row-${name}`}
        accessibilityLabel={`${identityKey}:${revision}:${sourceRevision}`}
      />
    );
  }

  function Orders({
    context,
    identityKey,
    revision,
    activePill,
    onPillChange,
  }: {
    context: RetainedScenePagerPageContext;
    identityKey: string;
    revision: number;
    activePill: string;
    onPillChange: (key: string) => void;
  }) {
    const [controlsHeight, setControlsHeight] = React.useState(0);
    const renderBasic = React.useCallback(
      () => (
        <PillRow name="basic" identityKey={identityKey} revision={revision} />
      ),
      [identityKey, revision],
    );
    const renderConditional = React.useCallback(
      () => (
        <PillRow
          name="conditional"
          identityKey={identityKey}
          revision={revision}
        />
      ),
      [identityKey, revision],
    );
    const renderers = React.useMemo(
      () => ({ basic: renderBasic, conditional: renderConditional }),
      [renderBasic, renderConditional],
    );
    return (
      <View
        testID="orders-content"
        accessibilityLabel={JSON.stringify(context)}>
        <View
          testID="orders-controls"
          onLayout={event => setControlsHeight(event.nativeEvent.layout.height)}
        />
        <RetainedScenePagerBody
          ref={innerRef}
          activeKey={activePill}
          keys={pillKeys}
          identityKey={identityKey}
          // Deliberately true: the Body must still inherit the real parent scope.
          activityEnabled
          interactionEnabled={context.interactive}
          dataByKey={pillData}
          renderItemByKey={renderers}
          pageStyleByKey={pillStyles}
          viewportHeight={context.viewportHeight}
          minimumPageHeight={Math.max(
            0,
            context.minimumPageHeight - controlsHeight,
          )}
          rowStartOffset={context.contentTop + controlsHeight}
          pinnedHeight={48}
          scrollOffset={motion.scroll}
          indicatorPosition={motion.innerIndicator}
          gestureActive={motion.innerGesture}
          onTabChange={onPillChange}
          testID="inner"
        />
      </View>
    );
  }

  function Fixture({
    revision = 0,
    activityEnabled = true,
    identityKey = 'account-a',
  }: FixtureProps) {
    const [activeKey, setActiveKey] = React.useState(initialKey);
    // Presentation identity resets motion, not the owner's remembered pill.
    const [activePill, setActivePill] = React.useState(initialPill);
    const scroll = useSharedValue(0);
    const outerIndicator = useSharedValue(keys.indexOf(initialKey));
    const innerIndicator = useSharedValue(pillKeys.indexOf(initialPill));
    const outerGesture = useSharedValue(false);
    const innerGesture = useSharedValue(false);
    motion = {
      scroll,
      outerIndicator,
      innerIndicator,
      outerGesture,
      innerGesture,
    };
    const onPillChange = React.useCallback((key: string) => {
      innerChanged(key);
      setActivePill(key);
    }, []);
    const renderOrders = React.useCallback(
      (context: RetainedScenePagerPageContext) => (
        <Orders
          context={context}
          identityKey={identityKey}
          revision={revision}
          activePill={activePill}
          onPillChange={onPillChange}
        />
      ),
      [identityKey, revision, activePill, onPillChange],
    );
    const customPages = React.useMemo(
      () => ({ orders: renderOrders }),
      [renderOrders],
    );
    return (
      <CollapsibleSceneProvider
        activeTab={activeKey}
        tabs={keys}
        headerHeight={368}
        scrollOffset={scroll}
        syncOffsetOnActivate={false}>
        <RetainedScenePagerList
          key={identityKey}
          ref={outerRef}
          activeKey={activeKey}
          keys={keys}
          identityKey={identityKey}
          activityEnabled={activityEnabled}
          dataByKey={data}
          renderItemByKey={outerRenderers}
          renderPageByKey={customPages}
          pageStyleByKey={pageStyles}
          listHeader={<View testID="nested-shared-header" />}
          rowStartOffset={416}
          pinnedHeight={48}
          scrollOffset={scroll}
          indicatorPosition={outerIndicator}
          gestureActive={outerGesture}
          onTabChange={key => {
            outerChanged(key);
            setActiveKey(key);
          }}
          testID="outer"
        />
      </CollapsibleSceneProvider>
    );
  }

  const rendered = render(<Fixture />);
  return {
    ...rendered,
    store,
    mounts,
    unmounts,
    scopes,
    outerChanged,
    innerChanged,
    motion: () => motion,
    requestOuter: (key: string) => act(() => outerRef.current?.selectTab(key)),
    requestInner: (key: string) => act(() => innerRef.current?.selectTab(key)),
    rerenderFixture: (props: FixtureProps) =>
      rendered.rerender(<Fixture {...props} />),
  };
}

describe('RetainedScenePagerList real JS component contracts', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockSetPage.mockClear();
    mockPageCommands.mockClear();
    mockJSQueue.length = 0;
    mockDeferJS = false;
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('iOS commits a requested tab only after native selected, without idle', () => {
    const fixture = mountFixture();
    fixture.request(2);
    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(fixture.settled).not.toHaveBeenCalled();
    expect(page(0).props.accessibilityElementsHidden).toBe(false);
    selected(2);
    expect(fixture.changed).toHaveBeenCalledTimes(1);
    expect(fixture.changed).toHaveBeenCalledWith(keys[2]);
    expect(page(2).props.accessibilityElementsHidden).toBe(false);
    fixture.request(2);
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('Android keeps the source until both selected and idle arrive', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const fixture = mountFixture();
    fixture.request(1);
    selected(1);
    expect(fixture.settled).not.toHaveBeenCalled();
    expect(page(0).props.accessibilityElementsHidden).toBe(false);
    pageState('idle');
    expect(fixture.changed).toHaveBeenCalledWith(keys[1]);
    expect(page(1).props.accessibilityElementsHidden).toBe(false);
  });

  it('serializes rapid tab clicks and executes only the final queued target', () => {
    const fixture = mountFixture();
    fixture.request(1);
    fixture.request(0);
    fixture.request(2);
    expect(mockSetPage.mock.calls).toEqual([[1]]);
    selected(1);
    expect(mockSetPage.mock.calls).toEqual([[1], [2]]);
    selected(2);
    expect(fixture.changed.mock.calls).toEqual([[keys[1]], [keys[2]]]);
  });

  it('does not replace a nonzero initial tab with a mount selection callback', () => {
    const fixture = mountFixture(keys[2]);
    expect(pager().props.initialPage).toBe(2);
    selected(0);
    expect(fixture.changed).not.toHaveBeenCalled();
    expect(page(2).props.accessibilityElementsHidden).toBe(false);
  });

  it('cancelled and no-motion gestures settle the source without changing parent selection', () => {
    const fixture = mountFixture();
    pageState('dragging');
    pageScroll(0, 0.6);
    pageScroll(0, 0);
    pageState('idle');
    pageState('dragging');
    pageState('idle');
    expect(fixture.settled.mock.calls).toEqual([[keys[0]], [keys[0]]]);
    expect(fixture.changed).not.toHaveBeenCalled();
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(page(0).props.pointerEvents).toBe('auto');
  });

  it('retains all three list/row instances and keeps shared header/trade outside the pager', () => {
    const fixture = mountFixture();
    const lists = keys.map((_, index) => list(index));
    const header = screen.getByTestId('shared-header');
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(4);
    expect(fixture.mounts).toEqual([1, 1, 1]);
    expect(within(pager()).queryByTestId('shared-header', hidden)).toBeNull();
    expect(within(pager()).queryByTestId('shared-trade', hidden)).toBeNull();
    for (const index of [1, 2, 0]) {
      fixture.request(index);
      selected(index);
    }
    keys.forEach((_, index) => expect(list(index)).toBe(lists[index]));
    expect(screen.getByTestId('shared-header')).toBe(header);
    expect(fixture.mounts).toEqual([1, 1, 1]);
    expect(fixture.unmounts).toEqual([0, 0, 0]);
  });

  it('keeps the extracted body state and row identities across wrapper renderItem closure changes', () => {
    const fixture = mountFixture();
    const initialLists = keys.map((_, index) => list(index));
    fixture.request(1);
    fixture.rerenderFixture({ revision: 10 });
    expect(mockSetPage.mock.calls).toEqual([[1]]);
    expect(page(0).props.pointerEvents).toBe('none');
    selected(1);
    expect(fixture.changed.mock.calls).toEqual([['orders']]);
    fixture.rerenderFixture({ revision: 20 });
    expect(pager().props.initialPage).toBe(0);
    expect(page(1).props.pointerEvents).toBe('auto');
    expect(row(1).props.accessibilityLabel).toBe('20:0');
    fixture.request(1);
    expect(mockSetPage.mock.calls).toEqual([[1]]);
    keys.forEach((_, index) => expect(list(index)).toBe(initialLists[index]));
    expect(fixture.mounts).toEqual([1, 1, 1]);
    expect(fixture.unmounts).toEqual([0, 0, 0]);
    expect(screen.UNSAFE_getAllByType(SceneList)).toHaveLength(1);
  });

  it('pauses hidden store publications and parent props, then catches up only the revealed neighbour', () => {
    const fixture = mountFixture();
    const initiallyRendered = [...fixture.renders];
    act(() => fixture.store.setState({ revision: 1 }));
    act(() => fixture.store.setState({ revision: 2 }));
    fixture.rerenderFixture({ revision: 10 });
    fixture.rerenderFixture({ revision: 20 });
    expect(row(0).props.accessibilityLabel).toBe('20:2');
    expect(row(1).props.accessibilityLabel).toBe('0:0');
    expect(row(2).props.accessibilityLabel).toBe('0:0');
    expect(fixture.renders.slice(1)).toEqual(initiallyRendered.slice(1));
    pageState('dragging');
    pageScroll(0, 0.2);
    expect(row(1).props.accessibilityLabel).toBe('20:2');
    expect(row(2).props.accessibilityLabel).toBe('0:0');
    // Activation renders new parent props, then the layout-effect publication
    // catches up the store. One catch-up notification need not be one render.
    expect(fixture.scopes[1]?.getDiagnostics()).toMatchObject({
      stores: [expect.objectContaining({ catchUpCount: 1 })],
    });
    pageScroll(0, 0);
    pageState('idle');
    const afterCancel = [...fixture.renders];
    act(() => fixture.store.setState({ revision: 3 }));
    fixture.rerenderFixture({ revision: 30 });
    expect(row(1).props.accessibilityLabel).toBe('20:2');
    expect(fixture.renders[1]).toBe(afterCancel[1]);
    expect(fixture.mounts).toEqual([1, 1, 1]);
  });

  it('pauses even the selected row when the owning screen is inactive and catches up on resume', () => {
    const fixture = mountFixture();
    fixture.rerenderFixture({ activityEnabled: false });
    const pausedRenders = [...fixture.renders];
    act(() => fixture.store.setState({ revision: 3 }));
    fixture.rerenderFixture({ activityEnabled: false, revision: 5 });
    expect(row(0).props.accessibilityLabel).toBe('0:0');
    expect(fixture.renders).toEqual(pausedRenders);
    fixture.rerenderFixture({ activityEnabled: true, revision: 5 });
    expect(row(0).props.accessibilityLabel).toBe('5:3');
    expect(row(1).props.accessibilityLabel).toBe('0:0');
  });

  it('keeps pointer/accessibility ownership on the settled page and disables presses during motion', () => {
    const fixture = mountFixture();
    expect(page(0).props.pointerEvents).toBe('auto');
    for (const index of [1, 2]) {
      expect(page(index).props.pointerEvents).toBe('none');
      expect(page(index).props.accessibilityElementsHidden).toBe(true);
      expect(page(index).props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
    }
    fixture.request(1);
    expect(page(0).props.pointerEvents).toBe('none');
    expect(page(1).props.pointerEvents).toBe('none');
    selected(1);
    expect(page(1).props.pointerEvents).toBe('auto');
    expect(page(1).props.accessibilityElementsHidden).toBe(false);
    expect(page(1).props.importantForAccessibility).toBe('auto');
    expect(page(0).props.pointerEvents).toBe('none');
  });

  it('processes deferred native events in one ordered queue without reviving a cancelled preview', () => {
    const fixture = mountFixture();
    mockDeferJS = true;
    pageState('dragging');
    pageScroll(0, 0.6);
    pageScroll(0, 0);
    pageState('idle');
    expect(fixture.settled).not.toHaveBeenCalled();
    flushJS();
    expect(fixture.changed).not.toHaveBeenCalled();
    const before = [...fixture.renders];
    act(() => fixture.store.setState({ revision: 1 }));
    expect(fixture.renders[1]).toBe(before[1]);
    expect(row(1).props.accessibilityLabel).toBe('0:0');
  });

  it('does not publish or execute queued work after unmount', () => {
    const fixture = mountFixture();
    fixture.request(1);
    mockDeferJS = true;
    selected(1);
    fixture.request(2);
    expect(mockJSQueue.length).toBeGreaterThan(0);
    fixture.unmount();
    flushJS();
    expect(fixture.settled).not.toHaveBeenCalled();
    expect(mockSetPage.mock.calls).toEqual([[1]]);
    expect(fixture.unmounts).toEqual([1, 1, 1]);
    const rendered = [...fixture.renders];
    act(() => fixture.store.setState({ revision: 5 }));
    expect(fixture.renders).toEqual(rendered);
  });

  it.each(['ios', 'android'] as const)(
    'retains nested row lists under the one vertical owner and commits only the inner track on %s',
    platform => {
      jest.replaceProperty(Platform, 'OS', platform);
      const fixture = mountNestedFixture();
      expect(screen.UNSAFE_getAllByType(SceneList)).toHaveLength(1);
      const lists = screen.UNSAFE_getAllByType(FlatList);
      const outerList = lists.find(item => item.props.testID === 'outer');
      expect(outerList).toBeDefined();
      const innerLists = lists.filter(item =>
        String(item.props.testID).startsWith('inner-rows-'),
      );
      expect(innerLists).toHaveLength(2);
      for (const innerList of innerLists) {
        let ancestor = innerList.parent;
        while (ancestor && ancestor.type !== FlatList) {
          ancestor = ancestor.parent;
        }
        expect(ancestor).toBe(outerList);
      }
      expect(
        within(nestedNode('inner-pager')).queryByTestId(
          'orders-controls',
          hidden,
        ),
      ).toBeNull();
      expect(screen.getAllByTestId('orders-controls', hidden)).toHaveLength(1);
      const header = nestedNode('nested-shared-header');
      const outerIndicator = fixture.motion().outerIndicator.value;
      fixture.requestInner('conditional');
      expect(mockPageCommands.mock.calls).toEqual([['inner-pager', 1]]);
      expect(fixture.innerChanged).not.toHaveBeenCalled();
      expect(nestedNode('inner-page-basic').props.pointerEvents).toBe('none');
      nestedSelected('inner', 1);
      if (platform === 'android') {
        expect(fixture.innerChanged).not.toHaveBeenCalled();
        nestedState('inner', 'idle');
      }
      expect(fixture.innerChanged.mock.calls).toEqual([['conditional']]);
      expect(fixture.outerChanged).not.toHaveBeenCalled();
      expect(fixture.motion().outerIndicator.value).toBe(outerIndicator);
      expect(fixture.motion().innerIndicator.value).toBe(1);
      expect(fixture.motion().outerGesture.value).toBe(false);
      fixture.requestOuter('history');
      nestedSelected('outer', 2);
      if (platform === 'android') {
        nestedState('outer', 'idle');
      }
      fixture.requestOuter('orders');
      nestedSelected('outer', 1);
      if (platform === 'android') {
        nestedState('outer', 'idle');
      }
      expect(nestedNode('inner-page-conditional').props.pointerEvents).toBe(
        'auto',
      );
      expect(screen.UNSAFE_getAllByType(FlatList)).toEqual(lists);
      expect(nestedNode('nested-shared-header')).toBe(header);
      expect(fixture.mounts).toEqual({ basic: 1, conditional: 1 });
      expect(fixture.unmounts).toEqual({ basic: 0, conditional: 0 });
    },
  );

  it('ANDs nested activity with the parent through reveal, cancellation and whole-screen inactivity', () => {
    const fixture = mountNestedFixture('positions');
    expect(fixture.scopes.get('basic')?.getActive()).toBe(false);
    act(() => fixture.store.setState({ revision: 1 }));
    act(() => fixture.store.setState({ revision: 2 }));
    fixture.rerenderFixture({ revision: 10 });
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:0:0',
    );
    nestedState('outer', 'dragging');
    nestedScroll('outer', 0, 0.2);
    expect(fixture.scopes.get('basic')?.getActive()).toBe(true);
    expect(fixture.scopes.get('conditional')?.getActive()).toBe(false);
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:10:2',
    );
    expect(nestedNode('inner-pager').props.scrollEnabled).toBe(false);
    expect(nestedNode('inner-page-basic').props.pointerEvents).toBe('none');
    nestedScroll('outer', 0, 0);
    nestedState('outer', 'idle');
    act(() => fixture.store.setState({ revision: 3 }));
    fixture.rerenderFixture({ revision: 20 });
    expect(fixture.scopes.get('basic')?.getActive()).toBe(false);
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:10:2',
    );
    fixture.requestOuter('orders');
    nestedSelected('outer', 1);
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:20:3',
    );
    fixture.rerenderFixture({ activityEnabled: false, revision: 20 });
    act(() => fixture.store.setState({ revision: 4 }));
    fixture.rerenderFixture({ activityEnabled: false, revision: 30 });
    expect(fixture.scopes.get('basic')?.getActive()).toBe(false);
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:20:3',
    );
    fixture.rerenderFixture({ activityEnabled: true, revision: 30 });
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-a:30:4',
    );
    expect(nestedNode('pill-row-conditional').props.accessibilityLabel).toBe(
      'account-a:0:0',
    );
    expect(fixture.mounts).toEqual({ basic: 1, conditional: 1 });
  });

  it('passes measured nested geometry without counting controls twice or adding a vertical scroll owner', () => {
    const fixture = mountNestedFixture();
    measureNode('outer', 800);
    measureNode('orders-controls', 96);
    measureNode('inner-rows-basic', 2000);
    measureNode('inner-rows-conditional', 200);
    measureNode('outer-content-orders', 2096);
    expect(nodeHeight('inner-pager')).toBe(2000);
    expect(nodeHeight('outer-pager')).toBe(2096);
    act(() => {
      fixture.motion().scroll.value = 1200;
    });
    fixture.requestInner('conditional');
    expect(nodeHeight('inner-pager')).toBe(2000);
    expect(nodeHeight('outer-pager')).toBe(2096);
    expect(
      StyleSheet.flatten(nestedNode('inner-rows-conditional').props.style)
        .marginTop,
    ).toBe(832);
    nestedSelected('inner', 1);
    expect(nodeHeight('inner-pager')).toBe(656);
    // Native layout is a process boundary: inject its measured result, not an
    // invented JS layout engine. This verifies the real propagation callback.
    measureNode('outer-content-orders', 752);
    expect(nodeHeight('outer-pager')).toBe(752);
    expect(fixture.motion().scroll.value).toBe(1200);
    expect(screen.UNSAFE_getAllByType(SceneList)).toHaveLength(1);
  });

  it.each(['ios', 'android'] as const)(
    'pauses both revealed pills and cancels only the inner gesture while its parent is inactive on %s',
    platform => {
      jest.replaceProperty(Platform, 'OS', platform);
      const fixture = mountNestedFixture();
      nestedState('inner', 'dragging');
      nestedScroll('inner', 0, 0.6);
      expect(fixture.motion().innerGesture.value).toBe(true);
      expect(fixture.motion().outerGesture.value).toBe(false);
      expect(fixture.scopes.get('basic')?.getActive()).toBe(true);
      expect(fixture.scopes.get('conditional')?.getActive()).toBe(true);
      act(() => fixture.store.setState({ revision: 1 }));
      fixture.rerenderFixture({ activityEnabled: false });
      expect(fixture.scopes.get('basic')?.getActive()).toBe(false);
      expect(fixture.scopes.get('conditional')?.getActive()).toBe(false);
      act(() => fixture.store.setState({ revision: 4 }));
      for (const key of pillKeys) {
        expect(nestedNode(`pill-row-${key}`).props.accessibilityLabel).toBe(
          'account-a:0:1',
        );
      }
      nestedScroll('inner', 0, 0);
      nestedState('inner', 'idle');
      expect(fixture.motion().innerGesture.value).toBe(false);
      expect(fixture.innerChanged.mock.calls).toEqual([['basic']]);
      expect(fixture.outerChanged).not.toHaveBeenCalled();
      expect(mockPageCommands).not.toHaveBeenCalled();
      fixture.rerenderFixture({ activityEnabled: true });
      expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
        'account-a:0:4',
      );
      expect(nestedNode('pill-row-conditional').props.accessibilityLabel).toBe(
        'account-a:0:1',
      );
      expect(fixture.scopes.get('conditional')?.getActive()).toBe(false);
    },
  );

  it('passes a parent preview inset into the nested global content origin', () => {
    const fixture = mountNestedFixture('positions');
    measureNode('outer', 800);
    measureNode('orders-controls', 96);
    measureNode('outer-rows-positions', 2000);
    measureNode('outer-content-orders', 752);
    act(() => {
      fixture.motion().scroll.value = 1200;
    });
    nestedState('outer', 'dragging');
    nestedScroll('outer', 0, 0.2);
    const context = JSON.parse(
      nestedNode('orders-content').props.accessibilityLabel,
    ) as RetainedScenePagerPageContext;
    expect(context).toEqual({
      active: true,
      interactive: false,
      contentTop: 1248,
      viewportHeight: 800,
      minimumPageHeight: 752,
    });
    const body = screen
      .UNSAFE_getAllByType(RetainedScenePagerBody)
      .find(item => item.props.testID === 'inner');
    expect(body?.props.rowStartOffset).toBe(1344);
    expect(body?.props.minimumPageHeight).toBe(656);
  });

  it('drops both old-owner callback queues on identity remount while remembering the committed pill', () => {
    const fixture = mountNestedFixture('orders', 'conditional');
    fixture.requestInner('basic');
    fixture.requestOuter('history');
    mockDeferJS = true;
    nestedSelected('inner', 0);
    nestedSelected('outer', 2);
    fixture.requestInner('conditional');
    fixture.requestOuter('positions');
    const commandsBeforeReset = [...mockPageCommands.mock.calls];
    fixture.rerenderFixture({ identityKey: 'account-b', revision: 4 });
    flushJS();
    expect(fixture.innerChanged).not.toHaveBeenCalled();
    expect(fixture.outerChanged).not.toHaveBeenCalled();
    expect(mockPageCommands.mock.calls).toEqual(commandsBeforeReset);
    expect(nestedNode('inner-pager').props.initialPage).toBe(1);
    expect(nestedNode('outer-pager').props.initialPage).toBe(1);
    expect(nestedNode('pill-row-basic').props.accessibilityLabel).toBe(
      'account-b:4:0',
    );
    expect(nestedNode('pill-row-conditional').props.accessibilityLabel).toBe(
      'account-b:4:0',
    );
    expect(fixture.mounts).toEqual({ basic: 2, conditional: 2 });
    expect(fixture.unmounts).toEqual({ basic: 1, conditional: 1 });
    mockDeferJS = false;
    nestedSelected('inner', 0);
    expect(fixture.innerChanged).not.toHaveBeenCalled();
    expect(nestedNode('inner-page-conditional').props.pointerEvents).toBe(
      'auto',
    );
  });
});
