import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
import {
  SceneList,
  type SceneListHandle,
  type SceneListProps,
} from '@rabby-wallet/rn-collapsible-scene-view';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import {
  clampRetainedPagerScrollY,
  resolveRetainedPagerLayout,
} from './retainedPagerLayout';
import {
  createRetainedPagerTransition,
  reduceRetainedPagerTransition,
  type RetainedPagerTransitionEvent,
} from './retainedPagerTransition';

const NativePager = Animated.createAnimatedComponent(PagerView);
const PAGER_CELL = ['retained-pager'];
const keyOf = (item: { key: string }) => item.key;
const pagerKey = (key: string) => key;

export type RetainedScenePagerListHandle = SceneListHandle<unknown> & {
  selectTab: (key: string) => void;
};
type Props<Row extends { key: string }> = Pick<
  SceneListProps<string>,
  | 'nativeRef'
  | 'nativeScrollY'
  | 'onContentSizeChange'
  | 'onLayout'
  | 'style'
  | 'testID'
> & {
  activeKey: string;
  /** Stable keys/order for this owner's lifetime; remount on account/scope change. */
  keys: readonly string[];
  /** Include the owning screen's focus/foreground activity. */
  activityEnabled: boolean;
  /** Account changes invalidate display-only snapshots, without remounting the scroll owner. */
  identityKey: string;
  dataByKey: Record<string, readonly Row[]>;
  renderItemByKey: Record<string, ListRenderItem<Row>>;
  pageStyleByKey: Record<string, StyleProp<ViewStyle>>;
  listHeader: React.ReactElement;
  rowStartOffset: number;
  pinnedHeight: number;
  scrollOffset: SharedValue<number>;
  indicatorPosition: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  onTabChange: (key: string) => void;
  ref?: React.Ref<RetainedScenePagerListHandle>;
};

/** One physical vertical ScrollView. Same-orientation child FlatLists inherit
 * its VirtualizedList context and render non-scrolling Views. PagerView owns
 * horizontal motion only; neither header/trade nor vertical scroll is replayed.
 */
export function RetainedScenePagerList<Row extends { key: string }>({
  activeKey,
  keys,
  activityEnabled,
  identityKey,
  dataByKey,
  renderItemByKey,
  pageStyleByKey,
  listHeader,
  rowStartOffset,
  pinnedHeight,
  scrollOffset,
  indicatorPosition,
  gestureActive,
  onTabChange,
  ref,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  style,
  testID = 'retained-scene',
}: Props<Row>) {
  const initialIndex = useRef(Math.max(0, keys.indexOf(activeKey))).current;
  const machine = useRef(
    createRetainedPagerTransition({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pageCount: keys.length,
      initialIndex,
    }),
  );
  const [state, setState] = useState(machine.current);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [viewport, setViewport] = useState(0);
  const [heights, setHeights] = useState(() => keys.map(() => 0));
  const [transition, setTransition] = useState<{
    source: number;
    y: number;
    height: number;
    viewport: number;
    header: number;
    pin: number;
  } | null>(null);
  const outerRef = useRef<SceneListHandle<string>>(null);
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
    viewportHeight: transition?.viewport ?? viewport,
    headerHeight: transition?.header ?? rowStartOffset,
    tabHeight: transition?.pin ?? pinnedHeight,
    transitionScrollY: transition?.y ?? null,
    transitionPagerHeight: transition?.height,
  });
  const latest = useRef({
    pageHeights,
    pagerHeight,
    viewport,
    rowStartOffset,
    pinnedHeight,
    onTabChange,
    keys,
  });
  latest.current = {
    pageHeights,
    pagerHeight,
    viewport,
    rowStartOffset,
    pinnedHeight,
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
      machine.current = result.state;
      setState(result.state);
      gestureActive.value = result.state.phase !== 'idle';
      for (const effect of result.effects) {
        if (effect.type === 'began') {
          const geometry = latest.current;
          const sourceHeight = Math.max(
            geometry.pageHeights[effect.sourceIndex],
            geometry.viewport - geometry.pinnedHeight,
          );
          setTransition({
            source: effect.sourceIndex,
            y: clampRetainedPagerScrollY({
              scrollY: capturedY.current,
              pageHeight: sourceHeight,
              viewportHeight: geometry.viewport,
              headerHeight: geometry.rowStartOffset,
              tabHeight: geometry.pinnedHeight,
            }),
            height: sourceHeight,
            viewport: geometry.viewport,
            header: geometry.rowStartOffset,
            pin: geometry.pinnedHeight,
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
  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (offset, animated) =>
        outerRef.current?.scrollTo(offset, animated),
      scrollToOffset: (offset, animated) =>
        outerRef.current?.scrollToOffset(offset, animated),
      selectTab,
    }),
    [selectTab],
  );
  // External preference/account updates use the same serialized command path.
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
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      setViewport(event.nativeEvent.layout.height);
      onLayout?.(event);
    },
    [onLayout],
  );
  const renderPager = () => (
    <NativePager
      ref={pagerRef}
      initialPage={initialIndex}
      offscreenPageLimit={Math.max(1, keys.length - 1)}
      style={{ height: pagerHeight }}
      testID={`${testID}-pager`}
      overdrag={false}
      onPageScroll={onPageScroll}
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageState}>
      {keys.map((key, index) => {
        const active =
          activityEnabled &&
          (index === state.settledIndex || revealed.includes(index));
        return (
          <View
            key={key}
            collapsable={false}
            testID={`${testID}-page-${key}`}
            pointerEvents={
              active && index === state.settledIndex && state.phase === 'idle'
                ? 'auto'
                : 'none'
            }
            accessibilityElementsHidden={index !== state.settledIndex}
            importantForAccessibility={
              index === state.settledIndex ? 'auto' : 'no-hide-descendants'
            }>
            <StoreActivityBoundary active={active} label={`${testID}:${key}`}>
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
            </StoreActivityBoundary>
          </View>
        );
      })}
    </NativePager>
  );
  return (
    <SceneList
      data={PAGER_CELL}
      keyExtractor={pagerKey}
      renderItem={renderPager}
      ListHeaderComponent={listHeader}
      contentInsetTop={0}
      nativeRef={nativeRef}
      nativeScrollY={nativeScrollY}
      onContentSizeChange={onContentSizeChange}
      onLayout={layout}
      ref={outerRef}
      tabKey={activeKey}
      style={style}
      testID={testID}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled
      scrollsToTop
    />
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
  // Retain only the display inputs, not the VirtualizedList component. Native
  // scroll metrics, virtualization, sizing and refs must keep working off-page.
  // A render-phase update catches up before commit, avoiding a stale first frame
  // on reveal. Account identity always invalidates the old display snapshot.
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
