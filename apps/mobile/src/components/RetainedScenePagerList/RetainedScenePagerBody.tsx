import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEventData,
} from 'react-native-pager-view';
import Animated, {
  runOnJS,
  runOnUI,
  useEvent,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import {
  clampRetainedPagerScrollY,
  getRetainedPagerMinimumPageHeight,
  resolveRetainedPagerLayout,
} from './retainedPagerLayout';
import {
  createRetainedPagerTransition,
  reduceRetainedPagerTransition,
  type RetainedPagerTransitionEvent,
} from './retainedPagerTransition';

const NativePager = Animated.createAnimatedComponent(PagerView);
const keyOf = (item: { key: string }) => item.key;
const styles = StyleSheet.create({
  customPage: { flexGrow: 0, flexShrink: 0 },
});

export type RetainedScenePagerBodyHandle = {
  selectTab: (key: string) => void;
};

export type RetainedScenePagerPageContext = {
  active: boolean;
  interactive: boolean;
  /** Global vertical content origin, including this page's preview inset. */
  contentTop: number;
  viewportHeight: number;
  minimumPageHeight: number;
};

export type RetainedScenePagerContentProps<Row extends { key: string }> = {
  activeKey: string;
  /** Stable keys/order for this owner's lifetime; remount on account/scope change. */
  keys: readonly string[];
  activityEnabled: boolean;
  /** Invalidates retained display inputs; a keyed remount resets native motion. */
  identityKey: string;
  dataByKey: Record<string, readonly Row[]>;
  renderItemByKey: Record<string, ListRenderItem<Row>>;
  pageStyleByKey: Record<string, StyleProp<ViewStyle>>;
  /** A custom page must not introduce another vertical scrolling host. */
  renderPageByKey?: Partial<
    Record<
      string,
      (context: RetainedScenePagerPageContext) => React.ReactElement
    >
  >;
  rowStartOffset: number;
  pinnedHeight: number;
  scrollOffset: SharedValue<number>;
  indicatorPosition: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  onTabChange: (key: string) => void;
  testID?: string;
};

type Props<Row extends { key: string }> =
  RetainedScenePagerContentProps<Row> & {
    viewportHeight: number;
    /** Nested controls already occupy part of the outer minimum page extent. */
    minimumPageHeight?: number;
    /** Parent transitions keep nested native pages mounted but non-interactive. */
    interactionEnabled?: boolean;
    ref?: React.Ref<RetainedScenePagerBodyHandle>;
  };

/** Horizontal motion and retained virtualized pages only. Mount inside the
 * existing SceneList cell so child FlatLists inherit its native scroll owner.
 * This component never creates a SceneList or drives vertical scrollTo.
 */
export function RetainedScenePagerBody<Row extends { key: string }>({
  activeKey,
  keys,
  activityEnabled,
  identityKey,
  dataByKey,
  renderItemByKey,
  pageStyleByKey,
  renderPageByKey,
  rowStartOffset,
  pinnedHeight,
  viewportHeight,
  minimumPageHeight: requestedMinimum,
  interactionEnabled = true,
  scrollOffset,
  indicatorPosition,
  gestureActive,
  onTabChange,
  ref,
  testID = 'retained-scene',
}: Props<Row>) {
  const parentScope = useStoreActivityScope();
  const parentActive = useSyncExternalStore(
    parentScope.subscribe,
    parentScope.getActive,
    parentScope.getActive,
  );
  const effectiveActivity = activityEnabled && parentActive;
  const minimumPageHeight = getRetainedPagerMinimumPageHeight({
    viewportHeight,
    tabHeight: pinnedHeight,
    minimumPageHeight: requestedMinimum,
  });
  const initialIndex = useRef(Math.max(0, keys.indexOf(activeKey))).current;
  const machine = useRef(
    createRetainedPagerTransition({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pageCount: keys.length,
      initialIndex,
    }),
  );
  // Temporary local Debug probe: lifecycle metadata only, no row/account data.
  const debugPagerTrace = useRef<unknown[]>([]);
  const [state, setState] = useState(machine.current);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [heights, setHeights] = useState(() => keys.map(() => 0));
  const [transition, setTransition] = useState<{
    source: number;
    y: number;
    height: number;
    viewport: number;
    header: number;
    pin: number;
    minimum: number;
  } | null>(null);
  const pagerRef = useRef<PagerView>(null);
  const visiblePair = useSharedValue(-1);
  const endpoint = useSharedValue(-2);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const capturedY = useRef(0);
  const pageHeights = heights.map((height, index) => {
    const minimum = StyleSheet.flatten(pageStyleByKey[keys[index]])?.minHeight;
    return Math.max(height, typeof minimum === 'number' ? minimum : 0);
  });
  const { pagerHeight, pageTopInsets } = resolveRetainedPagerLayout({
    pageHeights,
    settledIndex: transition?.source ?? state.settledIndex,
    viewportHeight: transition?.viewport ?? viewportHeight,
    headerHeight: transition?.header ?? rowStartOffset,
    tabHeight: transition?.pin ?? pinnedHeight,
    minimumPageHeight: transition?.minimum ?? minimumPageHeight,
    transitionScrollY: transition?.y ?? null,
    transitionPagerHeight: transition?.height,
  });
  const latest = useRef({
    pageHeights,
    viewportHeight,
    rowStartOffset,
    pinnedHeight,
    minimumPageHeight,
    onTabChange,
    keys,
  });
  latest.current = {
    pageHeights,
    viewportHeight,
    rowStartOffset,
    pinnedHeight,
    minimumPageHeight,
    onTabChange,
    keys,
  };
  const dispatch = useCallback(
    (event: RetainedPagerTransitionEvent, sampledY?: number) => {
      if (!alive.current) {
        return;
      }
      if (sampledY !== undefined) {
        capturedY.current = sampledY;
      }
      const result = reduceRetainedPagerTransition(machine.current, event);
      if (__DEV__ && event.type !== 'flushQueued') {
        debugPagerTrace.current.push({
          at: Date.now(),
          event,
          before: machine.current,
          after: result.state,
          effects: result.effects,
        });
        if (debugPagerTrace.current.length > 96) {
          debugPagerTrace.current.shift();
        }
      }
      machine.current = result.state;
      setState(result.state);
      gestureActive.value = result.state.phase !== 'idle';
      for (const effect of result.effects) {
        if (effect.type === 'began') {
          const geometry = latest.current;
          const sourceHeight = Math.max(
            geometry.pageHeights[effect.sourceIndex],
            geometry.minimumPageHeight,
          );
          setTransition({
            source: effect.sourceIndex,
            y: clampRetainedPagerScrollY({
              scrollY: capturedY.current,
              pageHeight: sourceHeight,
              viewportHeight: geometry.viewportHeight,
              headerHeight: geometry.rowStartOffset,
              tabHeight: geometry.pinnedHeight,
              minimumPageHeight: geometry.minimumPageHeight,
            }),
            height: sourceHeight,
            viewport: geometry.viewportHeight,
            header: geometry.rowStartOffset,
            pin: geometry.pinnedHeight,
            minimum: geometry.minimumPageHeight,
          });
          endpoint.value = -2;
          visiblePair.value = -1;
        } else if (effect.type === 'nativeCommand') {
          setRevealed([result.state.settledIndex, effect.index]);
          pagerRef.current?.setPage(effect.index);
        } else if (effect.type === 'settled') {
          setTransition(null);
          setRevealed([]);
          indicatorPosition.value = effect.index;
          latest.current.onTabChange(latest.current.keys[effect.index]);
        }
      }
    },
    [endpoint, gestureActive, indicatorPosition, visiblePair],
  );
  useLayoutEffect(() => {
    if (state.phase === 'idle') {
      dispatch({ type: 'flushQueued' });
    }
  }, [dispatch, state]);
  const selectTab = useCallback(
    (key: string) => {
      const index = latest.current.keys.indexOf(key);
      if (index >= 0) {
        runOnUI((target: number) => {
          'worklet';
          runOnJS(dispatch)(
            { type: 'request', index: target },
            scrollOffset.value,
          );
        })(index);
      }
    },
    [dispatch, scrollOffset],
  );
  React.useImperativeHandle(ref, () => ({ selectTab }), [selectTab]);
  const previousKey = useRef(activeKey);
  useEffect(() => {
    if (previousKey.current !== activeKey) {
      previousKey.current = activeKey;
      if (keys[machine.current.settledIndex] !== activeKey) {
        selectTab(activeKey);
      }
    }
  }, [activeKey, keys, selectTab]);
  const observe = useCallback(
    (progress: number) => {
      if (!alive.current || machine.current.phase === 'idle') {
        return;
      }
      setRevealed([Math.floor(progress), Math.ceil(progress)]);
      const rounded = Math.round(progress);
      dispatch({
        type: 'scrollEndpoint',
        index: Math.abs(progress - rounded) < 0.001 ? rounded : null,
      });
    },
    [dispatch],
  );
  const lastPage = keys.length - 1;
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    event => {
      'worklet';
      const progress = Math.max(
        0,
        Math.min(lastPage, event.position + event.offset),
      );
      indicatorPosition.value = progress;
      const pair = Math.floor(progress) * 10 + Math.ceil(progress);
      const rounded = Math.round(progress);
      const nextEndpoint = Math.abs(progress - rounded) < 0.001 ? rounded : -1;
      if (pair !== visiblePair.value || nextEndpoint !== endpoint.value) {
        visiblePair.value = pair;
        endpoint.value = nextEndpoint;
        runOnJS(observe)(progress);
      }
    },
    ['onPageScroll'],
  );
  const onPageState = useEvent<
    NativeSyntheticEvent<PageScrollStateChangedNativeEventData>
  >(
    event => {
      'worklet';
      if (event.pageScrollState === 'dragging') {
        runOnJS(dispatch)({ type: 'dragStart' }, scrollOffset.value);
      } else if (event.pageScrollState === 'idle') {
        runOnJS(dispatch)({ type: 'idle' }, scrollOffset.value);
      }
    },
    ['onPageScrollStateChanged'],
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    event => {
      'worklet';
      runOnJS(dispatch)(
        { type: 'selected', index: event.position },
        scrollOffset.value,
      );
    },
    ['onPageSelected'],
  );
  const measure = useCallback((index: number, height: number) => {
    setHeights(current =>
      current[index] === height
        ? current
        : current.map((value, i) => (i === index ? height : value)),
    );
  }, []);

  return (
    <NativePager
      ref={pagerRef}
      initialPage={initialIndex}
      offscreenPageLimit={Math.max(1, keys.length - 1)}
      scrollEnabled={interactionEnabled}
      style={{ height: pagerHeight }}
      testID={`${testID}-pager`}
      overdrag={false}
      onPageScroll={onPageScroll}
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageState}>
      {keys.map((key, index) => {
        const active =
          effectiveActivity &&
          (index === state.settledIndex || revealed.includes(index));
        const interactive =
          interactionEnabled &&
          active &&
          index === state.settledIndex &&
          state.phase === 'idle';
        const customPage = renderPageByKey?.[key];
        return (
          <View
            key={key}
            collapsable={false}
            testID={`${testID}-page-${key}`}
            pointerEvents={interactive ? 'auto' : 'none'}
            accessibilityElementsHidden={index !== state.settledIndex}
            importantForAccessibility={
              index === state.settledIndex ? 'auto' : 'no-hide-descendants'
            }>
            <StoreActivityBoundary active={active} label={`${testID}:${key}`}>
              {customPage ? (
                <View
                  testID={`${testID}-content-${key}`}
                  style={[
                    pageStyleByKey[key],
                    styles.customPage,
                    { marginTop: pageTopInsets[index] },
                  ]}
                  onLayout={event =>
                    measure(index, event.nativeEvent.layout.height)
                  }>
                  {customPage({
                    active,
                    interactive,
                    contentTop: rowStartOffset + pageTopInsets[index],
                    viewportHeight,
                    minimumPageHeight,
                  })}
                </View>
              ) : (
                <RetainedRows
                  data={dataByKey[key]}
                  renderItem={renderItemByKey[key]}
                  active={active}
                  identityKey={identityKey}
                  pageStyle={pageStyleByKey[key]}
                  top={pageTopInsets[index]}
                  index={index}
                  measure={measure}
                  testID={`${testID}-rows-${key}`}
                />
              )}
            </StoreActivityBoundary>
          </View>
        );
      })}
    </NativePager>
  );
}

const RetainedRows = memo(function RetainedRows<Row extends { key: string }>({
  data,
  renderItem,
  active,
  identityKey,
  pageStyle,
  top,
  index,
  measure,
  testID,
}: {
  data: readonly Row[];
  renderItem: ListRenderItem<Row>;
  active: boolean;
  identityKey: string;
  pageStyle: StyleProp<ViewStyle>;
  top: number;
  index: number;
  measure: (index: number, height: number) => void;
  testID: string;
}) {
  // Freeze display inputs only, never the VirtualizedList or its native metrics.
  const [presentation, setPresentation] = useState({
    identityKey,
    data,
    renderItem,
  });
  if (
    presentation.identityKey !== identityKey ||
    (active &&
      (presentation.data !== data || presentation.renderItem !== renderItem))
  ) {
    setPresentation({ identityKey, data, renderItem });
  }
  const { identityKey: presentedIdentity, renderItem: presentRow } =
    presentation;
  const renderRow = useCallback(
    (info: ListRenderItemInfo<Row>) => (
      <React.Fragment key={presentedIdentity}>
        {presentRow(info)}
      </React.Fragment>
    ),
    [presentedIdentity, presentRow],
  );
  const listStyle = useMemo(
    () => [pageStyle, { marginTop: top, flexGrow: 0, flexShrink: 0 }],
    [pageStyle, top],
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent) =>
      measure(index, event.nativeEvent.layout.height),
    [index, measure],
  );
  return (
    <FlatList
      data={presentation.data}
      renderItem={renderRow}
      keyExtractor={keyOf}
      testID={testID}
      style={listStyle}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={3}
      removeClippedSubviews={false}
      onLayout={onLayout}
    />
  );
}) as <Row extends { key: string }>(props: {
  data: readonly Row[];
  renderItem: ListRenderItem<Row>;
  active: boolean;
  identityKey: string;
  pageStyle: StyleProp<ViewStyle>;
  top: number;
  index: number;
  measure: (index: number, height: number) => void;
  testID: string;
}) => React.ReactElement;

export { RetainedRows };
