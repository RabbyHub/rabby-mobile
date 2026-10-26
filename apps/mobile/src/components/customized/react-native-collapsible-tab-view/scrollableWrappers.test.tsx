import React from 'react';
import { act, render } from '@testing-library/react-native';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';
import {
  Context,
  TabNameContext,
} from 'react-native-collapsible-tab-view/src/Context';
import type { ContextType } from 'react-native-collapsible-tab-view/src/types';
import type { SharedValue } from 'react-native-reanimated';

import { TabsFlatList } from './FlatList';
import { TabsScrollView } from './ScrollView';
import { TabsSectionList } from './SectionList';

// Jest does not transform this dependency's source subpaths. Use its published
// implementations, not reimplemented hooks; all consumers share one Context.
jest.mock('react-native-collapsible-tab-view/src/hooks', () =>
  jest.requireActual('react-native-collapsible-tab-view/lib/commonjs/hooks'),
);
jest.mock('react-native-collapsible-tab-view/src/Context', () =>
  jest.requireActual('react-native-collapsible-tab-view/lib/commonjs/Context'),
);
jest.mock('react-native-collapsible-tab-view/src/helpers', () =>
  jest.requireActual('react-native-collapsible-tab-view/lib/commonjs/helpers'),
);

// Component contracts only: keep the v8 Context and hooks real, while replacing
// the native animation/gesture boundary. This does not simulate UI-thread work,
// gesture arbitration, or native scroll convergence.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (component: unknown) => component,
  },
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  useAnimatedRef: () => {
    const ReactModule = require('react');
    return ReactModule.useMemo(() => {
      const ref = (instance: unknown) => {
        ref.current = instance;
      };
      ref.current = null as unknown;
      return ref;
    }, []);
  },
  useAnimatedReaction: jest.fn(),
  useAnimatedScrollHandler: () => jest.fn(),
  runOnUI: (callback: unknown) => callback,
  runOnJS: (callback: unknown) => callback,
  cancelAnimation: jest.fn(),
  scrollTo: jest.fn(),
  withTiming: (value: unknown) => value,
  withDelay: (_delay: number, value: unknown) => value,
  Extrapolation: { CLAMP: 'clamp' },
}));

jest.mock('react-native-gesture-handler', () => {
  const native = require('react-native');
  return {
    FlatList: native.FlatList,
    ScrollView: native.ScrollView,
    RefreshControl: native.RefreshControl,
  };
});

jest.mock('@/core/native/utils', () => ({ IS_IOS: true }));

const shared = <T,>(value: T) => ({ value } as SharedValue<T>);

function createContext(contentInset = 96): ContextType {
  const refMap: ContextType['refMap'] = {};
  return {
    headerHeight: 64,
    tabBarHeight: 32,
    containerHeight: 600,
    revealHeaderOnScroll: false,
    snapThreshold: null,
    indexDecimal: shared(0),
    tabNames: shared(['tokens']),
    index: shared(0),
    focusedTab: shared('tokens'),
    accDiffClamp: shared(0),
    scrollYCurrent: shared(0),
    scrollY: shared({ tokens: 0 }),
    refMap,
    setRef: jest.fn((name, ref) => {
      refMap[name] = ref;
      return ref;
    }),
    headerScrollDistance: shared(64),
    oldAccScrollY: shared(0),
    accScrollY: shared(0),
    offset: shared(0),
    snappingTo: shared(0),
    contentHeights: shared([0]),
    contentInset,
    headerTranslateY: shared(0),
    width: 320,
    minHeaderHeight: 0,
    allowHeaderOverscroll: false,
  };
}

function withContext(context: ContextType, child: React.ReactElement) {
  return (
    <Context.Provider value={context}>
      <TabNameContext.Provider value="tokens">{child}</TabNameContext.Provider>
    </Context.Provider>
  );
}

type ListRef = FlatList | ScrollView | SectionList;
type CommonProps = Pick<
  ScrollViewProps,
  | 'testID'
  | 'style'
  | 'contentContainerStyle'
  | 'onContentSizeChange'
  | 'refreshControl'
  | 'onLayout'
  | 'keyboardShouldPersistTaps'
> & { ref?: React.Ref<ListRef> };

const wrappers = [
  {
    name: 'FlatList',
    nativeComponent: FlatList,
    render: (props: CommonProps) => (
      <TabsFlatList
        {...props}
        ref={props.ref as React.Ref<FlatList>}
        data={[]}
        renderItem={() => null}
      />
    ),
  },
  {
    name: 'ScrollView',
    nativeComponent: ScrollView,
    render: (props: CommonProps) => (
      <TabsScrollView {...props} ref={props.ref as React.Ref<ScrollView>} />
    ),
  },
  {
    name: 'SectionList',
    nativeComponent: SectionList,
    render: (props: CommonProps) => (
      <TabsSectionList
        {...props}
        ref={props.ref as React.Ref<SectionList>}
        sections={[]}
        renderItem={() => null}
      />
    ),
  },
];

describe.each(wrappers)('$name v8 wrapper contract', wrapper => {
  it('uses numeric insets and updates the initial offset when context changes', () => {
    const context = createContext();
    const child = wrapper.render({ testID: 'list' });
    const result = render(withContext(context, child));
    const nativeList = () => result.UNSAFE_getByType(wrapper.nativeComponent);

    expect(nativeList().props.contentInset).toEqual({ top: 96 });
    expect(nativeList().props.contentOffset).toEqual({ x: 0, y: -96 });
    expect(nativeList().props.automaticallyAdjustContentInsets).toBe(false);

    result.rerender(withContext({ ...context, contentInset: 128 }, child));
    expect(nativeList().props.contentInset).toEqual({ top: 128 });
    expect(nativeList().props.contentOffset).toEqual({ x: 0, y: -128 });
  });

  it('registers the same live ref it exposes to the caller', () => {
    const context = createContext();
    const ref = React.createRef<ListRef>();
    render(withContext(context, wrapper.render({ ref })));

    expect(context.setRef).toHaveBeenCalledTimes(1);
    expect(context.setRef).toHaveBeenCalledWith(
      'tokens',
      context.refMap.tokens,
    );
    expect(ref.current).not.toBeNull();
    expect(context.refMap.tokens.current).toBe(ref.current);
  });

  it('keeps caller props and styles while forwarding layout and content-size callbacks', () => {
    const context = createContext();
    const onContentSizeChange = jest.fn();
    const onLayout = jest.fn();
    const result = render(
      withContext(
        context,
        wrapper.render({
          keyboardShouldPersistTaps: 'handled',
          style: { opacity: 0.75 },
          contentContainerStyle: { paddingBottom: 23 },
          onContentSizeChange,
          onLayout,
        }),
      ),
    );
    const list = result.UNSAFE_getByType(wrapper.nativeComponent);
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');
    expect(StyleSheet.flatten(list.props.style)).toMatchObject({
      width: 320,
      opacity: 0.75,
    });
    expect(StyleSheet.flatten(list.props.contentContainerStyle)).toMatchObject({
      paddingBottom: 23,
    });

    act(() => list.props.onContentSizeChange(320, 800));
    expect(context.contentHeights.value).toEqual([800]);
    expect(onContentSizeChange).toHaveBeenCalledWith(320, 800);

    const event = {
      nativeEvent: { layout: { width: 320, height: 600, x: 0, y: 0 } },
    };
    act(() => list.props.onLayout(event));
    expect(onLayout).toHaveBeenCalledWith(event);
  });

  it.each([undefined, 41])(
    'clones refresh control without losing caller state or offset (%s)',
    explicitOffset => {
      const context = createContext();
      const onRefresh = jest.fn();
      const refreshControl = (
        <RefreshControl
          refreshing
          onRefresh={onRefresh}
          tintColor="red"
          {...(explicitOffset === undefined
            ? {}
            : { progressViewOffset: explicitOffset })}
        />
      );
      const result = render(
        withContext(context, wrapper.render({ refreshControl })),
      );
      const control = result.UNSAFE_getByType(wrapper.nativeComponent).props
        .refreshControl;

      expect(control).not.toBe(refreshControl);
      expect(control.props.refreshing).toBe(true);
      expect(control.props.tintColor).toBe('red');
      expect(control.props.progressViewOffset).toBe(explicitOffset ?? 96);
      act(() => control.props.onRefresh());
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(refreshControl.props.progressViewOffset).toBe(explicitOffset);
    },
  );
});
