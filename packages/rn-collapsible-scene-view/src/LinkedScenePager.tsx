import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated as NativeAnimated,
  Platform,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEventData,
} from 'react-native-pager-view';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useEvent,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  buildLinkedSceneModel,
  linkedScenePhysicalKey,
  projectLinkedSceneProgress,
  resolveLinkedScenePath,
  type LinkedSceneModel,
  type LinkedScenePage,
  type LinkedScenePath,
  type LinkedScenePagingMode,
  type LinkedSceneRoot,
} from './linkedSceneModel';
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
import { getLinkedScrollSettlement } from './linkedScrollLifecycle';
import { getLinkedHeaderNativeInterpolation } from './linkedHeaderGeometry';
import { getPagerDragPosition, resolvePagerTarget } from './pagerMath';

const NativePager = Animated.createAnimatedComponent(PagerView);

// Same public native event-clock API used by SceneList and RN sticky headers.
// RN 0.81 exposes it at runtime but omits it from legacy Animated typings.
const nativeAnimated = NativeAnimated as typeof NativeAnimated & {
  attachNativeEvent: (
    target: unknown,
    eventName: 'onScroll',
    mapping: { nativeEvent: { contentOffset: { x: NativeAnimated.Value } } }[],
  ) => { detach: () => void };
};

export type LinkedScenePageContext = {
  active: boolean;
  interactive: boolean;
  contentTop: number;
  viewportHeight: number;
  minimumPageHeight: number;
};

export type LinkedSceneGroupContext = {
  active: boolean;
  interactive: boolean;
  childKey: string | undefined;
  selectChild: (key: string) => void;
};

export type LinkedScenePagerHandle = {
  selectPath: (path: LinkedScenePath) => void;
  selectTab: (key: string) => void;
};

export type LinkedScenePagerProps = {
  pages: readonly LinkedScenePage[];
  activePath: LinkedScenePath;
  /** A mounting decision. Remount explicitly to change the native hierarchy. */
  pagingMode?: LinkedScenePagingMode;
  onPathChange: (path: LinkedScenePath) => void;
  renderLeaf: (
    path: LinkedScenePath,
    context: LinkedScenePageContext,
  ) => React.ReactElement;
  renderGroupHeader?: (
    key: string,
    context: LinkedSceneGroupContext,
  ) => React.ReactElement | null;
  viewportHeight: number;
  minimumPageHeight?: number;
  contentTop: number;
  pinnedHeight: number;
  scrollOffset: SharedValue<number>;
  indicatorPosition: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  activityEnabled: boolean;
  interactionEnabled?: boolean;
  testID?: string;
  ref?: React.Ref<LinkedScenePagerHandle>;
};

/**
 * Retained horizontal presentation only. Render leaves inside the caller's
 * existing vertical VirtualizedList context; this component never introduces
 * a vertical scrolling host or issues a vertical scroll command.
 */
export function LinkedScenePager(props: LinkedScenePagerProps) {
  const mode = useRef(props.pagingMode ?? 'flat').current;
  const model = useMemo(
    () => buildLinkedSceneModel(props.pages),
    [props.pages],
  );
  const remembered = useRef<Record<string, string>>({});
  const width = useRef(0);
  const [layoutGeneration, setLayoutGeneration] = useState(0);
  if ((props.pagingMode ?? 'flat') !== mode) {
    throw new Error('Remount LinkedScenePager before changing pagingMode');
  }
  // A topology change invalidates native numeric indices, not the external
  // vertical owner. Leaf existence is controlled by pages, never row counts.
  return (
    <View
      testID={`${props.testID ?? 'linked-scene'}-layout`}
      onLayout={event => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - width.current) > 0.5) {
          const hadWidth = width.current > 0;
          width.current = next;
          if (hadWidth) {
            // Resizing invalidates native pixel coordinates. Cancel only this
            // horizontal owner at the last committed path, not the Y owner.
            setLayoutGeneration(current => current + 1);
          }
        }
      }}>
      <LinkedScenePagerOwner
        key={`${model.topologyKey}:${layoutGeneration}`}
        {...props}
        model={model}
        mode={mode}
        remembered={remembered}
      />
    </View>
  );
}

type OwnerProps = LinkedScenePagerProps & {
  model: LinkedSceneModel;
  mode: LinkedScenePagingMode;
  remembered: React.RefObject<Record<string, string>>;
};

function LinkedScenePagerOwner({
  model,
  mode,
  remembered,
  ...props
}: OwnerProps) {
  const initial = useRef(
    resolveLinkedScenePath(model, props.activePath),
  ).current;
  const initialRequest = useRef(props.activePath).current;
  if (
    initial.childKey !== undefined &&
    remembered.current[initial.key] === undefined
  ) {
    remembered.current[initial.key] = initial.childKey;
  }
  const mainIndicator = props.indicatorPosition;
  const onPathChange = props.onPathChange;
  const initialRootIndex = model.roots.findIndex(
    root => root.key === initial.key,
  );
  useLayoutEffect(() => {
    mainIndicator.value = initialRootIndex;
  }, [initialRootIndex, mainIndicator]);
  const [settled, setSettled] = useState(initial);
  const settledRef = useRef(initial);
  const trackRef = useRef<TrackHandle>(null);
  const childRefs = useRef<Record<string, TrackHandle | null>>({});
  const requested = useRef<LinkedScenePath | null>(null);
  const [headers, setHeaders] = useState<Record<string, number>>({});
  const physicalPosition = useSharedValue(
    model.leaves.findIndex(
      leaf => leaf.physicalKey === linkedScenePhysicalKey(initial),
    ),
  );
  const commit = useCallback(
    (path: LinkedScenePath) => {
      const resolved = resolveLinkedScenePath(model, path, remembered.current);
      if (resolved.childKey !== undefined) {
        remembered.current[resolved.key] = resolved.childKey;
      }
      settledRef.current = resolved;
      setSettled(resolved);
      onPathChange(resolved);
    },
    [model, onPathChange, remembered],
  );
  const canonicalized = useRef(false);
  useEffect(() => {
    if (!canonicalized.current) {
      canonicalized.current = true;
      if (
        linkedScenePhysicalKey(initialRequest) !==
        linkedScenePhysicalKey(initial)
      ) {
        // Removed child/root keys cannot leave the controlled owner pointing
        // at a native page that no longer exists after a topology remount.
        commit(initial);
      }
    }
  }, [commit, initial, initialRequest]);
  const selectPath = useCallback(
    (path: LinkedScenePath) => {
      const resolved = resolveLinkedScenePath(model, path, remembered.current);
      requested.current = resolved;
      if (mode === 'flat') {
        trackRef.current?.selectKey(linkedScenePhysicalKey(resolved));
        return;
      }
      if (resolved.childKey !== undefined) {
        remembered.current[resolved.key] = resolved.childKey;
        childRefs.current[resolved.key]?.selectKey(resolved.childKey);
      }
      trackRef.current?.selectKey(resolved.key);
    },
    [mode, model, remembered],
  );
  React.useImperativeHandle(
    props.ref,
    () => ({
      selectPath,
      selectTab: key => selectPath({ key }),
    }),
    [selectPath],
  );
  const previous = useRef(linkedScenePhysicalKey(props.activePath));
  useEffect(() => {
    const next = linkedScenePhysicalKey(props.activePath);
    if (previous.current !== next) {
      previous.current = next;
      const resolved = resolveLinkedScenePath(
        model,
        props.activePath,
        remembered.current,
      );
      if (
        linkedScenePhysicalKey(resolved) !==
        linkedScenePhysicalKey(settledRef.current)
      ) {
        selectPath(resolved);
      }
    }
  }, [model, props.activePath, selectPath, remembered]);
  const minimum = getRetainedPagerMinimumPageHeight({
    viewportHeight: props.viewportHeight,
    tabHeight: props.pinnedHeight,
    minimumPageHeight: props.minimumPageHeight,
  });
  const measureHeader = useCallback((key: string, height: number) => {
    setHeaders(current =>
      current[key] === height ? current : { ...current, [key]: height },
    );
  }, []);
  const renderHeader = (
    root: LinkedSceneRoot,
    context: Pick<LinkedScenePageContext, 'active' | 'interactive'>,
  ) =>
    props.renderGroupHeader?.(root.key, {
      ...context,
      childKey:
        settled.key === root.key
          ? settled.childKey
          : remembered.current[root.key] ?? root.leaves[0].path.childKey,
      selectChild: childKey => selectPath({ key: root.key, childKey }),
    });
  const common = {
    activeKey: mode === 'flat' ? linkedScenePhysicalKey(initial) : initial.key,
    activityEnabled: props.activityEnabled,
    interactionEnabled: props.interactionEnabled ?? true,
    contentTop: props.contentTop,
    pinnedHeight: props.pinnedHeight,
    viewportHeight: props.viewportHeight,
    minimumPageHeight: minimum,
    scrollOffset: props.scrollOffset,
    indicatorPosition:
      mode === 'flat' ? physicalPosition : props.indicatorPosition,
    gestureActive: props.gestureActive,
    testID: props.testID ?? 'linked-scene',
  };
  if (mode === 'flat') {
    return (
      <HorizontalTrack
        {...common}
        ref={trackRef}
        kind="scroll"
        keys={model.leaves.map(leaf => leaf.physicalKey)}
        projectProgress={progress => {
          'worklet';
          mainIndicator.value = projectLinkedSceneProgress(model, progress);
        }}
        onKeyChange={key => {
          const leaf = model.leaves.find(item => item.physicalKey === key);
          if (leaf) {
            commit(leaf.path);
          }
        }}
        renderPage={(key, context) => {
          const leaf = model.leaves.find(item => item.physicalKey === key)!;
          const header = headers[leaf.path.key] ?? 0;
          return (
            <View>
              <View style={{ height: header }} />
              {props.renderLeaf(leaf.path, {
                ...context,
                contentTop: context.contentTop + header,
                minimumPageHeight: Math.max(
                  0,
                  context.minimumPageHeight - header,
                ),
              })}
            </View>
          );
        }}
        renderOverlay={({ width, contexts, headerPan, nativeScrollX }) =>
          model.roots.map(root =>
            root.leaves[0].childIndex !== undefined ? (
              <FlatGroupHeader
                key={root.key}
                root={root}
                width={width}
                position={physicalPosition}
                nativeScrollX={nativeScrollX}
                headerPan={headerPan}
                topInsets={contexts
                  .slice(root.firstLeafIndex, root.lastLeafIndex + 1)
                  .map(context => context.contentTop - props.contentTop)}
                interactive={contexts
                  .slice(root.firstLeafIndex, root.lastLeafIndex + 1)
                  .some(context => context.interactive)}
                onHeight={measureHeader}
                testID={`${common.testID}-group-${root.key}`}>
                {renderHeader(root, {
                  active: contexts
                    .slice(root.firstLeafIndex, root.lastLeafIndex + 1)
                    .some(context => context.active),
                  interactive: contexts
                    .slice(root.firstLeafIndex, root.lastLeafIndex + 1)
                    .some(context => context.interactive),
                })}
              </FlatGroupHeader>
            ) : null,
          )
        }
      />
    );
  }
  return (
    <HorizontalTrack
      {...common}
      ref={trackRef}
      kind="pager"
      keys={model.roots.map(root => root.key)}
      onKeyChange={key => {
        const pending = requested.current;
        requested.current = null;
        commit(
          resolveLinkedScenePath(
            model,
            pending?.key === key ? pending : { key },
            remembered.current,
          ),
        );
      }}
      renderPage={(key, context) => {
        const root = model.roots.find(item => item.key === key)!;
        if (root.leaves[0].childIndex === undefined) {
          return props.renderLeaf(root.leaves[0].path, context);
        }
        return (
          <NestedGroup
            key={key}
            root={root}
            context={context}
            selected={
              settled.key === key
                ? settled.childKey
                : remembered.current[key] ?? root.leaves[0].path.childKey
            }
            header={renderHeader(root, context)}
            scrollOffset={props.scrollOffset}
            testID={`${common.testID}-group-${key}`}
            register={handle => {
              childRefs.current[key] = handle;
            }}
            renderLeaf={props.renderLeaf}
            onChange={childKey => {
              remembered.current[key] = childKey;
              if (settledRef.current.key === key) {
                commit({ key, childKey });
              }
            }}
          />
        );
      }}
    />
  );
}

const NativeLinkedHeaderContentContext =
  React.createContext<React.ReactNode>(null);
const NativeLinkedHeaderContent = () =>
  React.useContext(NativeLinkedHeaderContentContext);
const nativeLinkedHeaderContent = <NativeLinkedHeaderContent />;

// Follow the native-clock layer pattern: live business/interaction changes
// update the content slot without rerendering the NativeAnimated host/graph.
const NativeLinkedHeaderHost = React.memo(
  ({
    gesture,
    animatedStyle,
    pointerEvents,
    testID,
  }: {
    gesture: ReturnType<typeof Gesture.Pan>;
    animatedStyle: React.ComponentProps<typeof NativeAnimated.View>['style'];
    pointerEvents: 'auto' | 'none';
    testID: string;
  }) => (
    <GestureDetector gesture={gesture}>
      <NativeAnimated.View
        testID={testID}
        collapsable={false}
        pointerEvents={pointerEvents}
        style={animatedStyle}>
        {nativeLinkedHeaderContent}
      </NativeAnimated.View>
    </GestureDetector>
  ),
);
NativeLinkedHeaderHost.displayName = 'NativeLinkedHeaderHost';

function FlatGroupHeader({
  root,
  width,
  position,
  nativeScrollX,
  headerPan,
  children,
  topInsets,
  interactive,
  onHeight,
  testID,
}: {
  root: LinkedSceneRoot;
  width: number;
  position: SharedValue<number>;
  nativeScrollX: NativeAnimated.Value;
  headerPan: HeaderPanTransport;
  children: React.ReactNode;
  topInsets: number[];
  interactive: boolean;
  onHeight: (key: string, height: number) => void;
  testID: string;
}) {
  const first = root.firstLeafIndex;
  const span = root.lastLeafIndex - first;
  const translateX = useMemo(() => {
    const interpolation = getLinkedHeaderNativeInterpolation(
      first,
      first + span,
      width,
    );
    return interpolation ? nativeScrollX.interpolate(interpolation) : 0;
  }, [first, nativeScrollX, span, width]);
  const horizontalStyle = useMemo(
    () => ({ transform: [{ translateX }] }),
    [translateX],
  );
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(headerPan.enabled)
        .maxPointers(1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onTouchesDown((_event, manager) => {
          'worklet';
          if (!headerPan.canStart()) {
            manager.fail();
          }
        })
        .onStart(headerPan.onStart)
        .onUpdate(event => {
          'worklet';
          headerPan.onUpdate(event.translationX);
        })
        .onEnd((event, success) => {
          'worklet';
          if (success) {
            headerPan.onEnd(event.translationX, event.velocityX);
          }
        })
        .onFinalize(headerPan.onFinalize),
    [headerPan],
  );
  const style = useAnimatedStyle(() => {
    const relative = Math.max(0, Math.min(span, position.value - first));
    const lower = Math.floor(relative);
    const upper = Math.min(span, lower + 1);
    return {
      top:
        topInsets[lower] +
        (topInsets[upper] - topInsets[lower]) * (relative - lower),
    };
  }, [first, span, topInsets]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.groupHeader, { width }, style]}
      onLayout={event => onHeight(root.key, event.nativeEvent.layout.height)}>
      <NativeLinkedHeaderContentContext.Provider
        value={
          <View
            testID={testID}
            pointerEvents={interactive ? 'auto' : 'none'}
            accessibilityElementsHidden={!interactive}
            importantForAccessibility={
              interactive ? 'auto' : 'no-hide-descendants'
            }>
            {children}
          </View>
        }>
        {/* X follows the same native event as the page content. Neither JS
            settlement nor Reanimated writes this presentation clock. */}
        <NativeLinkedHeaderHost
          gesture={gesture}
          animatedStyle={horizontalStyle}
          pointerEvents={headerPan.enabled ? 'auto' : 'none'}
          testID={`${testID}-gesture`}
        />
      </NativeLinkedHeaderContentContext.Provider>
    </Animated.View>
  );
}

function NestedGroup({
  root,
  context,
  selected,
  header,
  scrollOffset,
  testID,
  register,
  renderLeaf,
  onChange,
}: {
  root: LinkedSceneRoot;
  context: LinkedScenePageContext;
  selected: string | undefined;
  header: React.ReactNode;
  scrollOffset: SharedValue<number>;
  testID: string;
  register: (handle: TrackHandle | null) => void;
  renderLeaf: LinkedScenePagerProps['renderLeaf'];
  onChange: (key: string) => void;
}) {
  const [headerHeight, setHeaderHeight] = useState(0);
  const position = useSharedValue(0);
  const gesture = useSharedValue(false);
  return (
    <View>
      <View
        onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
        {header}
      </View>
      <HorizontalTrack
        ref={register}
        kind="pager"
        keys={root.leaves.map(leaf => leaf.path.childKey!)}
        activeKey={selected ?? root.leaves[0].path.childKey!}
        activityEnabled={context.active}
        interactionEnabled={context.interactive}
        contentTop={context.contentTop + headerHeight}
        viewportHeight={context.viewportHeight}
        minimumPageHeight={Math.max(
          0,
          context.minimumPageHeight - headerHeight,
        )}
        pinnedHeight={0}
        scrollOffset={scrollOffset}
        indicatorPosition={position}
        gestureActive={gesture}
        onKeyChange={onChange}
        testID={testID}
        renderPage={(key, childContext) =>
          renderLeaf({ key: root.key, childKey: key }, childContext)
        }
      />
    </View>
  );
}

type TrackHandle = { selectKey: (key: string) => void };
/** Header dragging is another input to the same native track/reducer. */
type HeaderPanTransport = {
  enabled: boolean;
  canStart: () => boolean;
  onStart: () => void;
  onUpdate: (translationX: number) => void;
  onEnd: (translationX: number, velocityX: number) => void;
  onFinalize: () => void;
};
type TrackProps = {
  kind: 'pager' | 'scroll';
  keys: readonly string[];
  activeKey: string;
  activityEnabled: boolean;
  interactionEnabled: boolean;
  contentTop: number;
  pinnedHeight: number;
  viewportHeight: number;
  minimumPageHeight: number;
  scrollOffset: SharedValue<number>;
  indicatorPosition: SharedValue<number>;
  gestureActive: SharedValue<boolean>;
  projectProgress?: (progress: number) => void;
  onKeyChange: (key: string) => void;
  renderPage: (
    key: string,
    context: LinkedScenePageContext,
  ) => React.ReactElement;
  renderOverlay?: (context: {
    width: number;
    contexts: LinkedScenePageContext[];
    headerPan: HeaderPanTransport;
    nativeScrollX: NativeAnimated.Value;
  }) => React.ReactNode;
  testID: string;
  ref?: React.Ref<TrackHandle>;
};

function HorizontalTrack(props: TrackProps) {
  const {
    keys,
    kind,
    indicatorPosition,
    gestureActive,
    scrollOffset,
    projectProgress,
  } = props;
  const initialIndex = useRef(
    Math.max(0, keys.indexOf(props.activeKey)),
  ).current;
  const machine = useRef(
    createRetainedPagerTransition({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pageCount: keys.length,
      initialIndex,
    }),
  );
  const [state, setState] = useState(machine.current);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [heights, setHeights] = useState(() => keys.map(() => 0));
  const [width, setWidth] = useState(0);
  const widthValue = useSharedValue(0);
  const nativeDragging = useSharedValue(false);
  const nativeOffsetX = useSharedValue(0);
  const nativePositionObserved = useSharedValue(false);
  const scrollReady = useSharedValue(false);
  const [headerReady, setHeaderReady] = useState(false);
  const uiMounted = useSharedValue(true);
  const headerDragging = useSharedValue(false);
  const headerStartOffset = useSharedValue(0);
  const headerStartIndex = useSharedValue(initialIndex);
  const headerLastCommandedX = useSharedValue(0);
  // This is the pending native snap endpoint, not a second selected-page state.
  const headerSnapTarget = useSharedValue(-1);
  const [transition, setTransition] = useState<{
    source: number;
    y: number;
    height: number;
    viewport: number;
    contentTop: number;
    pinnedHeight: number;
    minimum: number;
  } | null>(null);
  const nativeRef = useRef<PagerView>(null);
  const scrollRef =
    useAnimatedRef<React.ElementRef<typeof Animated.ScrollView>>();
  const [nativeScrollX] = useState(() => new NativeAnimated.Value(0));
  const nativeScrollInstance = useRef<React.ElementRef<
    typeof Animated.ScrollView
  > | null>(null);
  const nativeScrollAttachment = useRef<{
    target: unknown;
    detach: () => void;
  } | null>(null);
  const syncNativeScrollAttachment = useCallback(
    (instance: React.ElementRef<typeof Animated.ScrollView> | null) => {
      const target = instance?.getNativeScrollRef() ?? null;
      if (nativeScrollAttachment.current?.target === target) {
        return;
      }
      nativeScrollAttachment.current?.detach();
      nativeScrollAttachment.current = null;
      if (target) {
        const attachment = nativeAnimated.attachNativeEvent(
          target,
          'onScroll',
          [{ nativeEvent: { contentOffset: { x: nativeScrollX } } }],
        );
        nativeScrollAttachment.current = { ...attachment, target };
      }
    },
    [nativeScrollX],
  );
  const setNativeScrollRef = useCallback(
    (instance: React.ElementRef<typeof Animated.ScrollView> | null) => {
      nativeScrollInstance.current = instance;
      scrollRef(instance ?? undefined);
      syncNativeScrollAttachment(instance);
    },
    [scrollRef, syncNativeScrollAttachment],
  );
  useLayoutEffect(() => {
    syncNativeScrollAttachment(nativeScrollInstance.current);
    return () => {
      nativeScrollAttachment.current?.detach();
      nativeScrollAttachment.current = null;
    };
  }, [syncNativeScrollAttachment]);
  const scrollLaidOutWidth = useRef(0);
  const pendingBeforeLayout = useRef<string | null>(null);
  const alive = useRef(true);
  const capturedY = useRef(0);
  const visiblePair = useSharedValue(-1);
  const endpoint = useSharedValue(-2);
  const latest = useRef({ props, heights, width });
  latest.current = { props, heights, width };
  const dispatchRef = useRef<
    ((event: RetainedPagerTransitionEvent, sampledY?: number) => void) | null
  >(null);
  const executeScrollCommand = useCallback(
    (index: number, epoch: number, alreadyAtTarget: boolean) => {
      const current = machine.current;
      if (
        !alive.current ||
        current.phase !== 'command' ||
        current.epoch !== epoch ||
        current.requestedIndex !== index
      ) {
        return;
      }
      if (alreadyAtTarget) {
        // A native aligned position was sampled with no active finger drag.
        // A zero-distance scrollTo emits no animation-completion callback.
        dispatchRef.current?.({ type: 'scrollEndpoint', index, epoch });
        dispatchRef.current?.({ type: 'selected', index, epoch });
        dispatchRef.current?.({ type: 'idle', epoch });
      } else {
        scrollRef.current?.scrollTo({
          x: index * latest.current.width,
          animated: true,
        });
      }
    },
    [scrollRef],
  );
  useEffect(() => {
    alive.current = true;
    uiMounted.value = true;
    return () => {
      alive.current = false;
      uiMounted.value = false;
      headerDragging.value = false;
      headerSnapTarget.value = -1;
      gestureActive.value = false;
    };
  }, [gestureActive, headerDragging, headerSnapTarget, uiMounted]);
  const { pagerHeight, pageTopInsets } = resolveRetainedPagerLayout({
    pageHeights: heights,
    settledIndex: transition?.source ?? state.settledIndex,
    viewportHeight: transition?.viewport ?? props.viewportHeight,
    headerHeight: transition?.contentTop ?? props.contentTop,
    tabHeight: transition?.pinnedHeight ?? props.pinnedHeight,
    minimumPageHeight: transition?.minimum ?? props.minimumPageHeight,
    transitionScrollY: transition?.y ?? null,
    transitionPagerHeight: transition?.height,
  });
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
        const current = latest.current;
        if (effect.type === 'began') {
          const height = Math.max(
            current.heights[effect.sourceIndex],
            current.props.minimumPageHeight,
          );
          setTransition({
            source: effect.sourceIndex,
            height,
            viewport: current.props.viewportHeight,
            contentTop: current.props.contentTop,
            pinnedHeight: current.props.pinnedHeight,
            minimum: current.props.minimumPageHeight,
            y: clampRetainedPagerScrollY({
              scrollY: capturedY.current,
              pageHeight: height,
              viewportHeight: current.props.viewportHeight,
              headerHeight: current.props.contentTop,
              tabHeight: current.props.pinnedHeight,
              minimumPageHeight: current.props.minimumPageHeight,
            }),
          });
          visiblePair.value = -1;
          endpoint.value = -2;
        } else if (effect.type === 'nativeCommand') {
          setRevealed([result.state.settledIndex, effect.index]);
          if (current.props.kind === 'pager') {
            nativeRef.current?.setPage(effect.index);
          } else {
            runOnUI(
              (
                index: number,
                epoch: number,
                pageWidth: number,
                pageCount: number,
              ) => {
                'worklet';
                // Close the header's touch-down gate before issuing the
                // native command, not after its first scroll event arrives.
                gestureActive.value = true;
                const observed =
                  pageWidth > 0 && nativePositionObserved.value
                    ? getLinkedScrollSettlement(
                        nativeOffsetX.value / pageWidth,
                        pageCount,
                        nativeDragging.value,
                      )
                    : null;
                runOnJS(executeScrollCommand)(index, epoch, observed === index);
              },
            )(
              effect.index,
              effect.epoch,
              current.width,
              current.props.keys.length,
            );
          }
        } else if (effect.type === 'settled') {
          setTransition(null);
          setRevealed([]);
          indicatorPosition.value = effect.index;
          current.props.projectProgress?.(effect.index);
          current.props.onKeyChange(current.props.keys[effect.index]);
        }
      }
    },
    [
      endpoint,
      gestureActive,
      indicatorPosition,
      visiblePair,
      nativeOffsetX,
      nativeDragging,
      nativePositionObserved,
      executeScrollCommand,
    ],
  );
  dispatchRef.current = dispatch;
  useLayoutEffect(() => {
    if (state.phase === 'idle') {
      dispatch({ type: 'flushQueued' });
    }
  }, [dispatch, state]);
  const selectKey = useCallback(
    (key: string) => {
      const index = latest.current.props.keys.indexOf(key);
      if (index >= 0) {
        if (
          latest.current.props.kind === 'scroll' &&
          (latest.current.width === 0 ||
            scrollLaidOutWidth.current !== latest.current.width)
        ) {
          pendingBeforeLayout.current = key;
          return;
        }
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
  React.useImperativeHandle(props.ref, () => ({ selectKey }), [selectKey]);
  const previousKey = useRef(props.activeKey);
  useEffect(() => {
    if (previousKey.current !== props.activeKey) {
      previousKey.current = props.activeKey;
      if (keys[machine.current.settledIndex] !== props.activeKey) {
        selectKey(props.activeKey);
      }
    }
  }, [keys, props.activeKey, selectKey]);
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
  const publishProgress = (raw: number) => {
    'worklet';
    const progress = Math.max(0, Math.min(lastPage, raw));
    indicatorPosition.value = progress;
    projectProgress?.(progress);
    const pair = Math.floor(progress) * keys.length + Math.ceil(progress);
    const rounded = Math.round(progress);
    const nextEndpoint = Math.abs(progress - rounded) < 0.001 ? rounded : -1;
    if (pair !== visiblePair.value || nextEndpoint !== endpoint.value) {
      visiblePair.value = pair;
      endpoint.value = nextEndpoint;
      runOnJS(observe)(progress);
    }
  };
  const pageScroll = useEvent<PagerViewOnPageScrollEvent>(
    event => {
      'worklet';
      publishProgress(event.position + event.offset);
    },
    ['onPageScroll'],
  );
  const pageState = useEvent<
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
  const pageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    event => {
      'worklet';
      runOnJS(dispatch)(
        { type: 'selected', index: event.position },
        scrollOffset.value,
      );
    },
    ['onPageSelected'],
  );
  const finishScroll = useCallback(
    (index: number, y: number) => {
      dispatch({ type: 'scrollEndpoint', index }, y);
      dispatch({ type: 'selected', index }, y);
      dispatch({ type: 'idle' }, y);
    },
    [dispatch],
  );
  const headerPan = useMemo<HeaderPanTransport>(() => {
    const canStart = () => {
      'worklet';
      return (
        uiMounted.value &&
        scrollReady.value &&
        widthValue.value > 0 &&
        !gestureActive.value &&
        !nativeDragging.value &&
        headerSnapTarget.value < 0
      );
    };
    const snap = (target: number) => {
      'worklet';
      if (!uiMounted.value || !scrollReady.value || widthValue.value <= 0) {
        return;
      }
      headerDragging.value = false;
      headerSnapTarget.value = target;
      const observed = getLinkedScrollSettlement(
        nativeOffsetX.value / widthValue.value,
        keys.length,
        false,
      );
      if (
        nativePositionObserved.value &&
        observed === target &&
        Math.abs(headerLastCommandedX.value - target * widthValue.value) <
          widthValue.value * 0.001
      ) {
        nativeDragging.value = false;
        headerSnapTarget.value = -1;
        runOnJS(finishScroll)(target, scrollOffset.value);
        return;
      }
      // Keep the cancellation guard raised while stopping any previous native
      // animation. Only the new aligned target can complete this header snap.
      scrollTo(scrollRef, target * widthValue.value, 0, true);
      nativeDragging.value = false;
    };
    return {
      // Do not depend on leaf `interactive`: dragStart disables the buttons,
      // but must not disable/cancel the recognizer that started that drag.
      enabled:
        kind === 'scroll' &&
        headerReady &&
        props.activityEnabled &&
        props.interactionEnabled,
      canStart,
      onStart: () => {
        'worklet';
        // An external command can start after DOWN but before activation.
        if (!canStart()) {
          return;
        }
        gestureActive.value = true;
        nativeDragging.value = true;
        headerDragging.value = true;
        headerSnapTarget.value = -1;
        const offset = nativePositionObserved.value
          ? nativeOffsetX.value
          : indicatorPosition.value * widthValue.value;
        headerStartOffset.value = offset;
        headerLastCommandedX.value = offset;
        headerStartIndex.value = Math.max(
          0,
          Math.min(keys.length - 1, Math.round(offset / widthValue.value)),
        );
        runOnJS(dispatch)({ type: 'dragStart' }, scrollOffset.value);
        // Anchor this input to the idle native position. scrollTo(false) does
        // NOT cancel Android's programmatic ValueAnimator, so header gestures
        // accept only idle tracks at touch-down. Native row gestures retain
        // their own ability to grab/cancel an in-flight native animation.
        scrollTo(scrollRef, offset, 0, false);
      },
      onUpdate: translationX => {
        'worklet';
        if (!uiMounted.value || !headerDragging.value) {
          return;
        }
        // pagerMath accepts an integer starting page. Preserve the fractional
        // native offset when a user grabs an animation part way through it.
        const translated =
          translationX +
          headerStartIndex.value * widthValue.value -
          headerStartOffset.value;
        const progress = getPagerDragPosition({
          startIndex: headerStartIndex.value,
          translationX: translated,
          width: widthValue.value,
          pageCount: keys.length,
        });
        headerLastCommandedX.value = progress * widthValue.value;
        scrollTo(scrollRef, headerLastCommandedX.value, 0, false);
        // Native onScroll alone publishes position; do not race it with a
        // second per-frame indicator/nativeOffset writer from this gesture.
      },
      onEnd: (translationX, velocityX) => {
        'worklet';
        if (!uiMounted.value || !headerDragging.value) {
          return;
        }
        snap(
          resolvePagerTarget({
            startIndex: headerStartIndex.value,
            translationX:
              translationX +
              headerStartIndex.value * widthValue.value -
              headerStartOffset.value,
            velocityX,
            width: widthValue.value,
            pageCount: keys.length,
          }),
        );
      },
      onFinalize: () => {
        'worklet';
        // Failed vertical recognition never started a horizontal transition.
        // A completed onEnd already relinquished this input's ownership.
        if (uiMounted.value && headerDragging.value) {
          snap(headerStartIndex.value);
        }
      },
    };
  }, [
    dispatch,
    finishScroll,
    gestureActive,
    headerDragging,
    headerLastCommandedX,
    headerReady,
    headerSnapTarget,
    headerStartIndex,
    headerStartOffset,
    indicatorPosition,
    keys.length,
    kind,
    nativeDragging,
    nativeOffsetX,
    nativePositionObserved,
    props.activityEnabled,
    props.interactionEnabled,
    scrollOffset,
    scrollReady,
    scrollRef,
    uiMounted,
    widthValue,
  ]);
  const scroll = useAnimatedScrollHandler({
    onScroll: event => {
      nativeOffsetX.value = event.contentOffset.x;
      nativePositionObserved.value = true;
      if (widthValue.value > 0) {
        publishProgress(event.contentOffset.x / widthValue.value);
        const target = headerSnapTarget.value;
        if (
          target >= 0 &&
          getLinkedScrollSettlement(
            event.contentOffset.x / widthValue.value,
            keys.length,
            nativeDragging.value,
          ) === target
        ) {
          // The last drag scroll event may arrive after release. If it is
          // already the snap endpoint, native scrollTo can be zero-distance
          // and emit no momentumEnd. This is actual native endpoint evidence.
          headerSnapTarget.value = -1;
          runOnJS(finishScroll)(target, scrollOffset.value);
        }
      }
    },
    onBeginDrag: () => {
      gestureActive.value = true;
      nativeDragging.value = true;
      headerDragging.value = false;
      headerSnapTarget.value = -1;
      runOnJS(dispatch)({ type: 'dragStart' }, scrollOffset.value);
    },
    onEndDrag: event => {
      nativeDragging.value = false;
      nativeOffsetX.value = event.contentOffset.x;
      nativePositionObserved.value = true;
      const progress =
        widthValue.value > 0
          ? event.contentOffset.x / widthValue.value
          : initialIndex;
      const index = getLinkedScrollSettlement(progress, keys.length, false);
      if (index !== null && Math.abs(event.velocity?.x ?? 0) < 0.001) {
        runOnJS(finishScroll)(index, scrollOffset.value);
      }
    },
    onMomentumEnd: event => {
      const progress =
        widthValue.value > 0
          ? event.contentOffset.x / widthValue.value
          : initialIndex;
      const index = getLinkedScrollSettlement(
        progress,
        keys.length,
        nativeDragging.value,
      );
      if (
        index !== null &&
        (headerSnapTarget.value < 0 || headerSnapTarget.value === index)
      ) {
        headerSnapTarget.value = -1;
        nativeOffsetX.value = event.contentOffset.x;
        nativePositionObserved.value = true;
        runOnJS(finishScroll)(index, scrollOffset.value);
      }
    },
  });
  const contexts = keys.map(
    (key, index): LinkedScenePageContext => ({
      active:
        props.activityEnabled &&
        (index === state.settledIndex || revealed.includes(index)),
      interactive:
        props.interactionEnabled &&
        props.activityEnabled &&
        index === state.settledIndex &&
        state.phase === 'idle',
      contentTop: props.contentTop + pageTopInsets[index],
      viewportHeight: props.viewportHeight,
      minimumPageHeight: props.minimumPageHeight,
    }),
  );
  const pages = keys.map((key, index) => (
    <View
      key={key}
      collapsable={false}
      style={kind === 'scroll' ? { width, height: pagerHeight } : undefined}
      testID={`${props.testID}-page-${key}`}
      pointerEvents={contexts[index].interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={index !== state.settledIndex}
      importantForAccessibility={
        index === state.settledIndex ? 'auto' : 'no-hide-descendants'
      }>
      <View
        testID={`${props.testID}-content-${key}`}
        style={[styles.pageContent, { marginTop: pageTopInsets[index] }]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          setHeights(current =>
            current[index] === height
              ? current
              : current.map((value, i) => (i === index ? height : value)),
          );
        }}>
        {props.renderPage(key, contexts[index])}
      </View>
    </View>
  ));
  if (kind === 'pager') {
    return (
      <NativePager
        ref={nativeRef}
        initialPage={initialIndex}
        offscreenPageLimit={Math.max(1, keys.length - 1)}
        scrollEnabled={props.interactionEnabled}
        style={{ height: pagerHeight }}
        testID={`${props.testID}-pager`}
        overdrag={false}
        onPageScroll={pageScroll}
        onPageSelected={pageSelected}
        onPageScrollStateChanged={pageState}>
        {pages}
      </NativePager>
    );
  }
  return (
    <View
      style={[styles.trackViewport, { height: pagerHeight }]}
      testID={`${props.testID}-viewport`}>
      <Animated.ScrollView
        ref={setNativeScrollRef}
        horizontal
        pagingEnabled
        disableIntervalMomentum
        directionalLockEnabled
        nestedScrollEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={props.interactionEnabled}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        style={{ height: pagerHeight }}
        // A horizontal ScrollView still supports native vertical scrolling when
        // its content is taller than its viewport. Bound the native content box
        // to the active height; retained children measure intrinsically inside
        // fixed page slots and may overflow, without creating a second Y owner.
        contentContainerStyle={[styles.trackContent, { height: pagerHeight }]}
        testID={`${props.testID}-track`}
        onScroll={scroll}
        onLayout={event => {
          const next = event.nativeEvent.layout.width;
          if (next !== width) {
            widthValue.value = next;
            setWidth(next);
          }
        }}
        onContentSizeChange={contentWidth => {
          const current = latest.current;
          if (
            current.width > 0 &&
            contentWidth >= current.width * current.props.keys.length - 1 &&
            scrollLaidOutWidth.current !== current.width
          ) {
            scrollLaidOutWidth.current = current.width;
            // The content must have its real page widths before restoring a
            // nonzero initial page; an earlier command is clamped to zero.
            scrollRef.current?.scrollTo({
              x: machine.current.settledIndex * current.width,
              animated: false,
            });
            scrollReady.value = true;
            setHeaderReady(true);
            const pending = pendingBeforeLayout.current;
            pendingBeforeLayout.current = null;
            if (pending !== null) {
              selectKey(pending);
            }
          }
        }}>
        {pages}
      </Animated.ScrollView>
      {props.renderOverlay?.({ width, contexts, headerPan, nativeScrollX })}
    </View>
  );
}

const styles = StyleSheet.create({
  pageContent: { flexGrow: 0, flexShrink: 0 },
  trackContent: { alignItems: 'flex-start' },
  trackViewport: { overflow: 'hidden' },
  groupHeader: { position: 'absolute', top: 0, left: 0, zIndex: 1 },
});
