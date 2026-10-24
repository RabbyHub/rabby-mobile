import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  buildLinkedSceneModel,
  linkedScenePhysicalKey,
  resolveLinkedScenePath,
  type LinkedSceneModel,
  type LinkedScenePage,
  type LinkedScenePath,
  type LinkedScenePagingMode,
  type LinkedSceneRoot,
} from './linkedSceneModel';
import {
  createLinkedPresentationCommandEdge,
  getLinkedPresentationChildPosition,
  getLinkedPresentationDragFraction,
  getLinkedPresentationRootPosition,
  resolveLinkedPresentationEndpoint,
  resolveLinkedPresentationGestureEdge,
  type LinkedPresentationEdge,
} from './linkedPresentationModel';
import {
  getRetainedPagerMinimumPageHeight,
  resolveRetainedPagerLayout,
} from './retainedPagerLayout';

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
  /** A mounting decision: flat route order or precise child hit regions. */
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

/** Horizontal presentation only; the caller remains the sole native Y owner. */
export function LinkedScenePager(props: LinkedScenePagerProps) {
  const mode = useRef(props.pagingMode ?? 'flat').current;
  const candidate = useMemo(
    () => buildLinkedSceneModel(props.pages),
    [props.pages],
  );
  // A caller may rebuild its page array without changing the topology. Keep
  // the gesture worklet closure stable across those ordinary React renders.
  const stableModel = useRef(candidate);
  if (stableModel.current.topologyKey !== candidate.topologyKey) {
    stableModel.current = candidate;
  }
  const model = stableModel.current;
  const remembered = useRef<Record<string, string>>({});
  const [layout, setLayout] = useState({ width: 0, generation: 0 });
  if ((props.pagingMode ?? 'flat') !== mode) {
    throw new Error('Remount LinkedScenePager before changing pagingMode');
  }
  return (
    <View
      testID={(props.testID ?? 'linked-scene') + '-layout'}
      onLayout={event => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0) {
          setLayout(current =>
            Math.abs(current.width - nextWidth) > 0.5
              ? {
                  width: nextWidth,
                  generation: current.generation + (current.width > 0 ? 1 : 0),
                }
              : current,
          );
        }
      }}>
      <LinkedScenePagerOwner
        key={model.topologyKey + ':' + layout.generation}
        {...props}
        model={model}
        mode={mode}
        width={layout.width}
        remembered={remembered}
      />
    </View>
  );
}

type MotionState = {
  /** One horizontal owner: idle / finger / snap / settled React geometry. */
  phase: 'idle' | 'drag' | 'snap' | 'commit';
  epoch: number;
  settled: LinkedScenePath;
  remembered: Record<string, string>;
  edge: LinkedPresentationEdge | null;
  queued: LinkedScenePath | null;
};

type Transition = {
  epoch: number;
  sourceIndex: number;
  scrollY: number;
  pagerHeight: number;
  activeKeys: string[];
};

type OwnerProps = LinkedScenePagerProps & {
  model: LinkedSceneModel;
  mode: LinkedScenePagingMode;
  width: number;
  remembered: React.RefObject<Record<string, string>>;
};

const rootPosition = (
  model: LinkedSceneModel,
  state: MotionState,
  progress: number,
) => {
  'worklet';
  return state.edge
    ? getLinkedPresentationRootPosition(state.edge, progress)
    : model.roots.findIndex(root => root.key === state.settled.key);
};

const childPosition = (
  root: LinkedSceneRoot,
  state: MotionState,
  progress: number,
) => {
  'worklet';
  if (state.edge) {
    return getLinkedPresentationChildPosition(
      state.edge,
      root.rootIndex,
      progress,
    );
  }
  const key =
    state.settled.key === root.key
      ? state.settled.childKey
      : state.remembered[root.key];
  return Math.max(
    0,
    root.leaves.findIndex(leaf => leaf.path.childKey === key),
  );
};

function LinkedScenePagerOwner({
  model,
  mode,
  width,
  remembered,
  ...props
}: OwnerProps) {
  const initial = useRef(
    resolveLinkedScenePath(model, props.activePath, remembered.current),
  ).current;
  const initialRequest = useRef(props.activePath).current;
  if (
    initial.childKey !== undefined &&
    remembered.current[initial.key] === undefined
  ) {
    remembered.current[initial.key] = initial.childKey;
  }
  const [settled, setSettled] = useState(initial);
  const settledRef = useRef(initial);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [settlementEpoch, setSettlementEpoch] = useState(0);
  const [headers, setHeaders] = useState<Record<string, number>>({});
  const [heights, setHeights] = useState(() => model.leaves.map(() => 0));
  const latestEpoch = useRef(0);
  const mounted = useRef(true);
  const latestProps = useRef(props);
  latestProps.current = props;
  const motion = useSharedValue<MotionState>({
    phase: 'idle',
    epoch: 0,
    settled: initial,
    remembered: { ...remembered.current },
    edge: null,
    queued: null,
  });
  const fraction = useSharedValue(0);
  const uiMounted = useSharedValue(true);
  const widthValue = useSharedValue(width);
  const measured = useSharedValue({
    headers,
    heights,
    topInsets: heights.map(() => 0),
  });
  const presentedHeight = useSharedValue(0);
  const touchY = useSharedValue(0);
  const gestureStarted = useSharedValue(false);
  const gestureEnded = useSharedValue(false);
  const interrupted = useSharedValue(false);
  const snapEndpoint = useSharedValue<0 | 1>(0);
  const pausedSnap = useSharedValue<{ epoch: number; endpoint: 0 | 1 } | null>(
    null,
  );
  const interruptedEndpoint = useSharedValue<0 | 1>(0);
  const childEligible = useSharedValue(false);
  const startFraction = useSharedValue(0);
  const startTranslation = useSharedValue(0);
  const capturedY = useSharedValue(0);
  const capturedHeight = useSharedValue(0);
  const { gestureActive, indicatorPosition, scrollOffset } = props;
  const minimum = getRetainedPagerMinimumPageHeight({
    viewportHeight: props.viewportHeight,
    tabHeight: props.pinnedHeight,
    minimumPageHeight: props.minimumPageHeight,
  });
  const settledIndex = model.leaves.findIndex(
    leaf => leaf.physicalKey === linkedScenePhysicalKey(settled),
  );
  const { pagerHeight, pageTopInsets } = resolveRetainedPagerLayout({
    pageHeights: heights,
    settledIndex: transition?.sourceIndex ?? settledIndex,
    viewportHeight: props.viewportHeight,
    headerHeight: props.contentTop,
    tabHeight: props.pinnedHeight,
    minimumPageHeight: minimum,
    transitionScrollY: transition?.scrollY ?? null,
    transitionPagerHeight: transition?.pagerHeight,
  });

  useLayoutEffect(() => {
    widthValue.value = width;
    measured.value = { headers, heights, topInsets: pageTopInsets };
    presentedHeight.value = pagerHeight;
  }, [
    headers,
    heights,
    measured,
    pageTopInsets,
    pagerHeight,
    presentedHeight,
    width,
    widthValue,
  ]);

  useLayoutEffect(() => {
    mounted.current = true;
    uiMounted.value = true;
    return () => {
      mounted.current = false;
      uiMounted.value = false;
      cancelAnimation(fraction);
    };
  }, [fraction, uiMounted]);

  // Only the indicator observes progress. Header and rows inherit one Orders
  // ancestor transform instead of following each other's scrolling events.
  useAnimatedReaction(
    () => rootPosition(model, motion.value, fraction.value),
    value => {
      indicatorPosition.value = value;
    },
    [model, indicatorPosition],
  );
  useLayoutEffect(() => {
    gestureActive.value = false;
    indicatorPosition.value = model.roots.findIndex(
      root => root.key === initial.key,
    );
  }, [gestureActive, indicatorPosition, initial.key, model]);

  const began = useCallback(
    (
      epoch: number,
      edge: LinkedPresentationEdge,
      y: number,
      height: number,
    ) => {
      if (!mounted.current || epoch < latestEpoch.current) {
        return;
      }
      latestEpoch.current = epoch;
      const activeKeys =
        edge.scope === 'child'
          ? [
              linkedScenePhysicalKey(edge.fromPath),
              linkedScenePhysicalKey(edge.toPath),
            ]
          : model.roots
              .filter(
                root =>
                  root.rootIndex >=
                    Math.min(edge.fromRootIndex, edge.toRootIndex) &&
                  root.rootIndex <=
                    Math.max(edge.fromRootIndex, edge.toRootIndex),
              )
              .map(
                root =>
                  root.leaves[edge.frozenChildPositions[root.rootIndex] ?? 0]
                    .physicalKey,
              );
      setTransition(current => ({
        epoch,
        sourceIndex:
          current?.sourceIndex ??
          model.leaves.findIndex(
            leaf => leaf.physicalKey === linkedScenePhysicalKey(edge.fromPath),
          ),
        scrollY: current?.scrollY ?? y,
        pagerHeight: current?.pagerHeight ?? height,
        activeKeys,
      }));
    },
    [model],
  );
  const finished = useCallback(
    (epoch: number, path: LinkedScenePath) => {
      if (!mounted.current || epoch < latestEpoch.current) {
        return;
      }
      latestEpoch.current = epoch;
      if (path.childKey !== undefined) {
        remembered.current[path.key] = path.childKey;
      }
      const changed =
        linkedScenePhysicalKey(settledRef.current) !==
        linkedScenePhysicalKey(path);
      settledRef.current = path;
      setSettled(path);
      setTransition(null);
      setSettlementEpoch(epoch);
      if (changed) {
        latestProps.current.onPathChange(path);
      }
    },
    [remembered],
  );

  const transport = useMemo(() => {
    const complete = (endpoint: 0 | 1, epoch: number) => {
      'worklet';
      const current = motion.value;
      if (!uiMounted.value || current.epoch !== epoch) {
        return;
      }
      const target = current.edge
        ? endpoint
          ? current.edge.toPath
          : current.edge.fromPath
        : current.settled;
      motion.value = {
        ...current,
        phase: 'commit',
        settled: target,
        remembered:
          target.childKey === undefined
            ? current.remembered
            : { ...current.remembered, [target.key]: target.childKey },
      };
      runOnJS(finished)(epoch, target);
    };
    const snap = (endpoint: 0 | 1) => {
      'worklet';
      const current = motion.value;
      if (!current.edge) {
        return;
      }
      pausedSnap.value = null;
      snapEndpoint.value = endpoint;
      motion.value = { ...current, phase: 'snap' };
      const epoch = current.epoch;
      if (Math.abs(fraction.value - endpoint) < 0.0001) {
        fraction.value = endpoint;
        complete(endpoint, epoch);
      } else {
        // One animation owner, including clicks. No native scroller is driven
        // by another scroller or by a frame-by-frame scroll command.
        fraction.value = withTiming(endpoint, { duration: 180 }, didFinish => {
          if (didFinish) {
            complete(endpoint, epoch);
          }
        });
      }
    };
    const request = (path: LinkedScenePath) => {
      'worklet';
      if (!uiMounted.value) {
        return;
      }
      const current = motion.value;
      if (current.phase !== 'idle' || widthValue.value <= 0) {
        motion.value = { ...current, queued: path };
        return;
      }
      const edge = createLinkedPresentationCommandEdge({
        model,
        fromPath: current.settled,
        toPath: path,
        remembered: current.remembered,
      });
      if (!edge) {
        motion.value = { ...current, queued: null };
        return;
      }
      const epoch = current.epoch + 1;
      motion.value = { ...current, epoch, edge, phase: 'snap', queued: null };
      fraction.value = 0;
      gestureActive.value = true;
      runOnJS(began)(epoch, edge, scrollOffset.value, presentedHeight.value);
      snap(1);
    };
    const acknowledge = (epoch: number) => {
      'worklet';
      const current = motion.value;
      if (
        !uiMounted.value ||
        current.epoch !== epoch ||
        current.phase !== 'commit'
      ) {
        return;
      }
      motion.value = { ...current, phase: 'idle', edge: null, queued: null };
      fraction.value = 0;
      gestureActive.value = false;
      if (current.queued) {
        request(current.queued);
      }
    };
    const chooseGestureEdge = (translationX: number) => {
      'worklet';
      const current = motion.value;
      return resolveLinkedPresentationGestureEdge({
        model,
        fromPath: current.settled,
        direction: translationX < 0 ? 1 : -1,
        pagingMode: mode,
        childEligible: childEligible.value,
        remembered: current.remembered,
      });
    };
    return {
      request,
      acknowledge,
      flush: () => {
        'worklet';
        const current = motion.value;
        if (
          current.phase === 'idle' &&
          current.queued &&
          widthValue.value > 0
        ) {
          request(current.queued);
        }
      },
      down: (y: number) => {
        'worklet';
        touchY.value = y;
        const current = motion.value;
        if (current.phase === 'snap' && current.edge && !pausedSnap.value) {
          // Reserve this exact animation at DOWN, not at horizontal activation:
          // otherwise a near-finished snap can enter commit and swallow the drag.
          // A tap or vertical failure resumes the same endpoint in finalize.
          // Hand ownership over before canceling; any completion from the old
          // snap belongs to the previous transaction, even before activation.
          const epoch = current.epoch + 1;
          motion.value = { ...current, epoch };
          pausedSnap.value = {
            epoch,
            endpoint: snapEndpoint.value,
          };
          cancelAnimation(fraction);
        }
      },
      start: (translationX: number) => {
        'worklet';
        const current = motion.value;
        if (
          !uiMounted.value ||
          widthValue.value <= 0 ||
          current.phase === 'commit'
        ) {
          return;
        }
        gestureStarted.value = true;
        gestureEnded.value = false;
        interrupted.value = current.phase === 'snap' && current.edge !== null;
        interruptedEndpoint.value =
          pausedSnap.value?.endpoint ?? snapEndpoint.value;
        pausedSnap.value = null;
        cancelAnimation(fraction);
        startFraction.value = interrupted.value ? fraction.value : 0;
        startTranslation.value = interrupted.value ? translationX : 0;
        const source = model.leaves.find(
          leaf => leaf.physicalKey === linkedScenePhysicalKey(current.settled),
        )!;
        const headerHeight = measured.value.headers[source.path.key] ?? 0;
        const inset = measured.value.topInsets[source.index] ?? 0;
        childEligible.value =
          source.childIndex !== undefined &&
          touchY.value >= inset + headerHeight &&
          touchY.value < inset + (measured.value.heights[source.index] ?? 0);
        capturedY.value = scrollOffset.value;
        capturedHeight.value = presentedHeight.value;
        const edge = interrupted.value
          ? current.edge
          : chooseGestureEdge(translationX);
        const epoch = current.epoch + 1;
        motion.value = { ...current, phase: 'drag', epoch, edge };
        gestureActive.value = true;
        if (edge) {
          if (!interrupted.value) {
            fraction.value = getLinkedPresentationDragFraction({
              edge,
              startFraction: 0,
              translationX,
              width: widthValue.value,
            });
          }
          runOnJS(began)(epoch, edge, capturedY.value, capturedHeight.value);
        }
      },
      update: (translationX: number) => {
        'worklet';
        if (
          !gestureStarted.value ||
          !uiMounted.value ||
          motion.value.phase !== 'drag'
        ) {
          return;
        }
        let current = motion.value;
        if (!interrupted.value) {
          const nextEdge = chooseGestureEdge(translationX);
          if (
            nextEdge?.direction !== current.edge?.direction ||
            nextEdge?.scope !== current.edge?.scope
          ) {
            motion.value = { ...current, edge: nextEdge };
            current = motion.value;
            if (nextEdge) {
              runOnJS(began)(
                current.epoch,
                nextEdge,
                capturedY.value,
                capturedHeight.value,
              );
            }
          }
        }
        if (current.edge) {
          fraction.value = getLinkedPresentationDragFraction({
            edge: current.edge,
            startFraction: startFraction.value,
            translationX: translationX - startTranslation.value,
            width: widthValue.value,
          });
        }
      },
      end: (translationX: number, velocityX: number) => {
        'worklet';
        if (
          !gestureStarted.value ||
          !uiMounted.value ||
          motion.value.phase !== 'drag'
        ) {
          return;
        }
        gestureEnded.value = true;
        const current = motion.value;
        if (!current.edge) {
          complete(0, current.epoch);
          return;
        }
        snap(
          resolveLinkedPresentationEndpoint({
            edge: current.edge,
            startFraction: startFraction.value,
            fraction: fraction.value,
            translationX: translationX - startTranslation.value,
            velocityX,
            width: widthValue.value,
          }),
        );
      },
      finalize: () => {
        'worklet';
        if (!gestureStarted.value) {
          const paused = pausedSnap.value;
          pausedSnap.value = null;
          if (
            paused &&
            uiMounted.value &&
            motion.value.phase === 'snap' &&
            motion.value.epoch === paused.epoch
          ) {
            snap(paused.endpoint);
          }
          return;
        }
        gestureStarted.value = false;
        if (
          !uiMounted.value ||
          gestureEnded.value ||
          motion.value.phase !== 'drag'
        ) {
          return;
        }
        if (motion.value.edge) {
          // A cancelled takeover preserves the command/gesture it interrupted.
          // An ordinary drag from idle still returns to its committed source.
          snap(interrupted.value ? interruptedEndpoint.value : 0);
        } else {
          complete(0, motion.value.epoch);
        }
      },
    };
  }, [
    began,
    capturedHeight,
    capturedY,
    childEligible,
    finished,
    fraction,
    gestureActive,
    gestureEnded,
    gestureStarted,
    interrupted,
    interruptedEndpoint,
    measured,
    mode,
    model,
    motion,
    pausedSnap,
    presentedHeight,
    scrollOffset,
    snapEndpoint,
    startFraction,
    startTranslation,
    touchY,
    uiMounted,
    widthValue,
  ]);

  useLayoutEffect(() => {
    runOnUI(transport.acknowledge)(settlementEpoch);
  }, [settlementEpoch, transport]);
  useLayoutEffect(() => {
    runOnUI(transport.flush)();
  }, [transport, width]);

  const selectPath = useCallback(
    (path: LinkedScenePath) => {
      runOnUI(transport.request)(path);
    },
    [transport],
  );
  React.useImperativeHandle(
    props.ref,
    () => ({ selectPath, selectTab: key => selectPath({ key }) }),
    [selectPath],
  );
  const previous = useRef(linkedScenePhysicalKey(props.activePath));
  useEffect(() => {
    const nextKey = linkedScenePhysicalKey(props.activePath);
    if (previous.current !== nextKey) {
      previous.current = nextKey;
      if (nextKey !== linkedScenePhysicalKey(settledRef.current)) {
        selectPath(props.activePath);
      }
    }
  }, [props.activePath, selectPath]);
  useEffect(() => {
    if (
      linkedScenePhysicalKey(initialRequest) !== linkedScenePhysicalKey(initial)
    ) {
      latestProps.current.onPathChange(initial);
    }
  }, [initial, initialRequest]);

  const enabled = props.activityEnabled && (props.interactionEnabled ?? true);
  const testID = props.testID ?? 'linked-scene';
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(testID + '-pan')
        .enabled(enabled)
        .maxPointers(1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onTouchesDown((event, manager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (
            !touch ||
            event.numberOfTouches !== 1 ||
            !uiMounted.value ||
            widthValue.value <= 0 ||
            motion.value.phase === 'commit'
          ) {
            manager.fail();
          } else {
            transport.down(touch.y);
          }
        })
        .onStart(event => {
          'worklet';
          transport.start(event.translationX);
        })
        .onUpdate(event => {
          'worklet';
          transport.update(event.translationX);
        })
        .onEnd((event, success) => {
          'worklet';
          if (success) {
            transport.end(event.translationX, event.velocityX);
          }
        })
        .onFinalize(transport.finalize),
    [enabled, motion, testID, transport, uiMounted, widthValue],
  );
  const rootStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX:
            -rootPosition(model, motion.value, fraction.value) *
            widthValue.value,
        },
      ],
    }),
    [model],
  );
  const activeKeys = transition?.activeKeys ?? [
    linkedScenePhysicalKey(settled),
  ];

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID + '-viewport'}
        style={[styles.viewport, { height: pagerHeight }]}>
        <Animated.View
          testID={testID + '-root-track'}
          style={[
            styles.track,
            { width: width * model.roots.length, height: pagerHeight },
            rootStyle,
          ]}>
          {model.roots.map(root => (
            <LinkedRootPage
              key={root.key}
              root={root}
              motion={motion}
              fraction={fraction}
              widthValue={widthValue}
              width={width}
              height={pagerHeight}
              topInsets={pageTopInsets}
              onHeaderHeight={height =>
                setHeaders(current =>
                  current[root.key] === height
                    ? current
                    : { ...current, [root.key]: height },
                )
              }
              testID={testID}
              interactive={enabled && !transition && settled.key === root.key}
              header={props.renderGroupHeader?.(root.key, {
                active:
                  props.activityEnabled &&
                  root.leaves.some(leaf =>
                    activeKeys.includes(leaf.physicalKey),
                  ),
                interactive: enabled && !transition && settled.key === root.key,
                childKey:
                  settled.key === root.key
                    ? settled.childKey
                    : remembered.current[root.key] ??
                      root.leaves[0].path.childKey,
                selectChild: childKey =>
                  selectPath({ key: root.key, childKey }),
              })}
              renderLeaf={leaf => {
                const grouped = leaf.childIndex !== undefined;
                const headerHeight = grouped ? headers[root.key] ?? 0 : 0;
                const interactive =
                  enabled &&
                  !transition &&
                  leaf.physicalKey === linkedScenePhysicalKey(settled);
                return (
                  <View
                    key={leaf.physicalKey}
                    testID={testID + '-page-' + leaf.physicalKey}
                    style={{ width, height: pagerHeight }}
                    pointerEvents={interactive ? 'auto' : 'none'}
                    accessibilityElementsHidden={!interactive}
                    importantForAccessibility={
                      interactive ? 'auto' : 'no-hide-descendants'
                    }>
                    <View
                      testID={testID + '-content-' + leaf.physicalKey}
                      style={[
                        styles.content,
                        { marginTop: pageTopInsets[leaf.index] },
                      ]}
                      onLayout={event => {
                        const height = event.nativeEvent.layout.height;
                        setHeights(current =>
                          current[leaf.index] === height
                            ? current
                            : current.map((value, index) =>
                                index === leaf.index ? height : value,
                              ),
                        );
                      }}>
                      {grouped && <View style={{ height: headerHeight }} />}
                      {props.renderLeaf(leaf.path, {
                        active:
                          props.activityEnabled &&
                          activeKeys.includes(leaf.physicalKey),
                        interactive,
                        contentTop:
                          props.contentTop +
                          pageTopInsets[leaf.index] +
                          headerHeight,
                        viewportHeight: props.viewportHeight,
                        // Precise child hit bounds follow actual content. The
                        // outer viewport supplies short-page blank space.
                        minimumPageHeight:
                          grouped && mode === 'nested'
                            ? 0
                            : Math.max(0, minimum - headerHeight),
                      })}
                    </View>
                  </View>
                );
              }}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function LinkedRootPage({
  root,
  motion,
  fraction,
  widthValue,
  width,
  height,
  topInsets,
  onHeaderHeight,
  header,
  interactive,
  testID,
  renderLeaf,
}: {
  root: LinkedSceneRoot;
  motion: SharedValue<MotionState>;
  fraction: SharedValue<number>;
  widthValue: SharedValue<number>;
  width: number;
  height: number;
  topInsets: number[];
  onHeaderHeight: (height: number) => void;
  header: React.ReactNode;
  interactive: boolean;
  testID: string;
  renderLeaf: (leaf: LinkedSceneRoot['leaves'][number]) => React.ReactElement;
}) {
  const grouped = root.leaves[0].childIndex !== undefined;
  const childStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX:
            -childPosition(root, motion.value, fraction.value) *
            widthValue.value,
        },
      ],
    }),
    [root],
  );
  const headerStyle = useAnimatedStyle(() => {
    const position = childPosition(root, motion.value, fraction.value);
    const lower = Math.floor(position);
    const upper = Math.min(root.leaves.length - 1, lower + 1);
    const from = topInsets[root.firstLeafIndex + lower] ?? 0;
    const to = topInsets[root.firstLeafIndex + upper] ?? from;
    return { top: from + (to - from) * (position - lower) };
  }, [root, topInsets]);
  return (
    <View
      testID={testID + '-root-' + root.key}
      style={[styles.root, { width, height }]}>
      {grouped ? (
        <>
          <Animated.View
            testID={testID + '-group-' + root.key + '-track'}
            style={[
              styles.track,
              { width: width * root.leaves.length, height },
              childStyle,
            ]}>
            {root.leaves.map(renderLeaf)}
          </Animated.View>
          <Animated.View
            style={[styles.groupHeader, { width }, headerStyle]}
            pointerEvents={interactive ? 'auto' : 'none'}
            accessibilityElementsHidden={!interactive}
            importantForAccessibility={
              interactive ? 'auto' : 'no-hide-descendants'
            }>
            <View
              testID={testID + '-group-' + root.key}
              onLayout={event =>
                onHeaderHeight(event.nativeEvent.layout.height)
              }>
              {header}
            </View>
          </Animated.View>
        </>
      ) : (
        renderLeaf(root.leaves[0])
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  root: { overflow: 'hidden', flexShrink: 0 },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  content: { flexGrow: 0, flexShrink: 0 },
  groupHeader: { position: 'absolute', left: 0, top: 0, zIndex: 1 },
});
