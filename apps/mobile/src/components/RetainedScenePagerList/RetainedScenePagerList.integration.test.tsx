import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { FlatList, Platform, View, type ListRenderItem } from 'react-native';
import { createStore } from 'zustand/vanilla';
import { CollapsibleSceneProvider } from '@rabby-wallet/rn-collapsible-scene-view';
import { useSharedValue } from 'react-native-reanimated';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import type { StoreActivityScope } from '@/core/state/storeActivity';
import {
  RetainedScenePagerList,
  type RetainedScenePagerListHandle,
} from './RetainedScenePagerList';

const mockSetPage = jest.fn();
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
        () => ({ setPage: mockSetPage }),
        [],
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

describe('RetainedScenePagerList real JS component contracts', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockSetPage.mockClear();
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
});
