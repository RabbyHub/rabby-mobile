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
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  clampTrackPosition,
  resolveSettleTarget,
  splitTrackDelta,
  type LinkedTrackSettleMode,
  type TrackRange,
} from './continuousTrack';
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

/** Non-production only: discrete pager transitions for debug panels. */
export type LinkedSceneDiagnosticEvent =
  | {
      type: 'begin';
      start: number;
      track: number;
      snappedFrom: number | null;
      touchY: number;
    }
  | {
      type: 'end';
      axis: DragAxis;
      start: number;
      position: number;
      translationX: number;
      velocityPages: number;
      velocityX: number;
    }
  | {
      type: 'settle';
      axis: DragAxis;
      start: number;
      position: number;
      target: number;
      velocityPages: number;
    }
  | {
      type: 'commit';
      rootIndex: number;
      childIndex: number | undefined;
      changed: boolean;
    }
  | {
      type: 'jump';
      requested: number;
      applied: boolean;
      reason?: 'drag-active' | 'already-settling';
      from?: number;
    }
  | {
      type: 'mount';
      rootIndex: number;
      activeKey: string;
    };

export type LinkedScenePagerHandle = {
  selectPath: (path: LinkedScenePath) => void;
  selectTab: (key: string) => void;
  /** Cut straight to a path: no sweep across the pages in between. */
  jumpPath: (path: LinkedScenePath) => void;
  jumpTab: (key: string) => void;
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
  /**
   * Whether a horizontal drag may move between sibling child pages. When
   * false, the child track is presentation/click only and a drag always
   * routes to the adjacent parent, as if the parent had no children.
   */
  childSwipeEnabled?: boolean;
  /**
   * Release behaviour of the horizontal track.
   *
   * - `snap` (default): the track owns discrete pages and settles on one;
   * - `free`: the track rests exactly where the finger left it, which is what
   *   multi-level linked gestures need while levels hand off to each other.
   */
  settleMode?: LinkedTrackSettleMode;
  /**
   * Every leaf owns its own full-viewport vertical surface (a real scroll
   * view) instead of rows retained inside one outer scroll host. The pager
   * then always fills the viewport and no page needs a retained-layout inset.
   */
  fillViewport?: boolean;
  /**
   * Rendered inside the pager viewport, above the page track. Overlays placed
   * here keep native hit testing inside the same gesture area as the pages.
   */
  overlay?: React.ReactNode;
  /** Non-production only; called on discrete gesture/settle transitions. */
  onDiagnosticEvent?: (event: LinkedSceneDiagnosticEvent) => void;
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

type DragAxis = 'root' | 'child';

type DragState = {
  active: boolean;
  /** A successful release already scheduled its settle. */
  done: boolean;
  axis: DragAxis;
  rootKey: string;
  startChild: number;
  startRoot: number;
  startX: number;
  /**
   * Last non-zero x velocity observed during the drag. Used as a fallback
   * when the release sample is 0 (fingers often pause for a frame or two
   * before lifting, which hides a fast flick from `onEnd`).
   */
  lastVelocityX: number;
};

type RetainedTransition = {
  pagerHeight: number;
  scrollY: number;
};

const rootIndexOf = (model: LinkedSceneModel, key: string) =>
  Math.max(
    model.roots.findIndex(root => root.key === key),
    0,
  );

const childIndexOf = (model: LinkedSceneModel, path: LinkedScenePath) => {
  const root = model.roots[rootIndexOf(model, path.key)];
  if (!root || root.leaves.length < 2 || path.childKey === undefined) {
    return undefined;
  }
  const index = root.leaves.findIndex(
    leaf => leaf.path.childKey === path.childKey,
  );
  return index >= 0 ? index : undefined;
};

const initialChildTracks = (
  model: LinkedSceneModel,
  remembered: Readonly<Record<string, string>>,
  initial: LinkedScenePath,
) => {
  const tracks: Record<string, number> = {};
  for (const root of model.roots) {
    if (root.leaves.length < 2) {
      continue;
    }
    const rememberedChild = remembered[root.key];
    const index =
      root.key === initial.key && initial.childKey !== undefined
        ? root.leaves.findIndex(
            leaf => leaf.path.childKey === initial.childKey,
          )
        : root.leaves.findIndex(
            leaf => leaf.path.childKey === rememberedChild,
          );
    tracks[root.key] = Math.max(index, 0);
  }
  return tracks;
};

const EMPTY_INSETS: number[] = [];

type OwnerProps = LinkedScenePagerProps & {
  model: LinkedSceneModel;
  mode: LinkedScenePagingMode;
  width: number;
  remembered: React.RefObject<Record<string, string>>;
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
  // Non-null while a drag owns the gesture: the visible root window plus the
  // fact that no page may take taps. One React update per page crossing.
  const [dragFloor, setDragFloor] = useState<number | null>(null);
  const [retainedTransition, setRetainedTransition] =
    useState<RetainedTransition | null>(null);
  const [headers, setHeaders] = useState<Record<string, number>>({});
  const [heights, setHeights] = useState<number[]>(() =>
    model.leaves.map(() => 0),
  );
  const mounted = useRef(true);
  const latestProps = useRef(props);
  latestProps.current = props;
  settledRef.current = settled;
  const diagnosticsRef = useRef(props.onDiagnosticEvent);
  diagnosticsRef.current = props.onDiagnosticEvent;
  const emitDiagnostic = useCallback((event: LinkedSceneDiagnosticEvent) => {
    diagnosticsRef.current?.(event);
  }, []);
  // Keeps the worklet emit hops out of the hot path when no panel is open.
  const diagnosticsEnabled = useSharedValue(!!props.onDiagnosticEvent);
  useEffect(() => {
    diagnosticsEnabled.value = !!props.onDiagnosticEvent;
  }, [diagnosticsEnabled, props.onDiagnosticEvent]);

  const { gestureActive, indicatorPosition, scrollOffset, settleMode } = props;
  const widthValue = useSharedValue(width);
  const rootTrack = useSharedValue(rootIndexOf(model, initial.key));
  /** Target of the in-flight settle animation, -1 when the track is at rest. */
  const settlingRoot = useSharedValue(-1);
  /**
   * Who owns the in-flight animation: -1 none, 0 a gesture settle, 1 a
   * programmatic jump. A new touch finishes a gesture settle at its target but
   * takes a programmatic jump over from the nearest page.
   */
  const settlingSource = useSharedValue(-1);
  const childTracks = useSharedValue<Record<string, number>>(
    initialChildTracks(model, remembered.current, initial),
  );
  const drag = useSharedValue<DragState>({
    active: false,
    axis: 'root',
    done: false,
    rootKey: '',
    startChild: 0,
    startRoot: 0,
    startX: 0,
    lastVelocityX: 0,
  });
  const pageRange = useMemo<TrackRange>(
    () => ({ end: Math.max(model.roots.length - 1, 0), start: 0 }),
    [model],
  );
  const childSwipeEnabled = props.childSwipeEnabled ?? true;

  const minimum = getRetainedPagerMinimumPageHeight({
    viewportHeight: props.viewportHeight,
    tabHeight: props.pinnedHeight,
    minimumPageHeight: props.minimumPageHeight,
  });
  const settledLeafIndex = model.leaves.findIndex(
    leaf => leaf.physicalKey === linkedScenePhysicalKey(settled),
  );
  const retainedLayout = resolveRetainedPagerLayout({
    pageHeights: heights,
    settledIndex: Math.max(settledLeafIndex, 0),
    viewportHeight: props.viewportHeight,
    headerHeight: props.contentTop,
    tabHeight: props.pinnedHeight,
    minimumPageHeight: minimum,
    transitionScrollY: retainedTransition?.scrollY ?? null,
    transitionPagerHeight: retainedTransition?.pagerHeight,
  });
  const fillViewport = props.fillViewport === true;
  const pagerHeight = fillViewport
    ? props.viewportHeight
    : retainedLayout.pagerHeight;
  const pageTopInsets = fillViewport
    ? EMPTY_INSETS
    : retainedLayout.pageTopInsets;
  const presentedHeight = useSharedValue(pagerHeight);

  useLayoutEffect(() => {
    widthValue.value = width;
    presentedHeight.value = pagerHeight;
  }, [pagerHeight, presentedHeight, width, widthValue]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The indicator follows the exact track position, including mid-drag.
  useAnimatedReaction(
    () => rootTrack.value,
    value => {
      indicatorPosition.value = value;
    },
    [indicatorPosition],
  );
  useLayoutEffect(() => {
    gestureActive.value = false;
    indicatorPosition.value = rootIndexOf(model, initial.key);
    diagnosticsRef.current?.({
      type: 'mount',
      rootIndex: rootIndexOf(model, initial.key),
      activeKey: initial.key,
    });
  }, [gestureActive, indicatorPosition, initial.key, model]);

  const commitRootIndex = useCallback(
    (nextRootIndex: number) => {
    if (!mounted.current) {
      return;
    }
    const rootIndex = Math.max(
      0,
      Math.min(
        model.roots.length - 1,
        Math.round(nextRootIndex),
      ),
    );
    const root = model.roots[rootIndex];
    const childTrack = childTracks.value[root.key];
    const childIndex =
      root.leaves.length > 1 && childTrack !== undefined
        ? Math.max(0, Math.min(root.leaves.length - 1, Math.round(childTrack)))
        : undefined;
    const path: LinkedScenePath =
      childIndex === undefined
        ? { key: root.key }
        : {
            childKey: root.leaves[childIndex].path.childKey,
            key: root.key,
          };
    const changed =
      linkedScenePhysicalKey(settledRef.current) !==
      linkedScenePhysicalKey(path);
    if (path.childKey !== undefined) {
      remembered.current[path.key] = path.childKey;
    }
    settledRef.current = path;
    setSettled(current =>
      linkedScenePhysicalKey(current) === linkedScenePhysicalKey(path)
        ? current
        : path,
    );
    diagnosticsRef.current?.({
      type: 'commit',
      rootIndex,
      childIndex,
      changed,
    });
    setDragFloor(null);
    setRetainedTransition(null);
    gestureActive.value = false;
    if (changed) {
      latestProps.current.onPathChange(path);
    }
    },
    [childTracks, gestureActive, model],
  );

  const beginRetainedTransition = useCallback(
    (scrollY: number, height: number) => {
      if (fillViewport) {
        return;
      }
      setRetainedTransition({ pagerHeight: height, scrollY });
    },
    [fillViewport],
  );

  const publishDragFloor = useCallback((floor: number) => {
    setDragFloor(current => (current === floor ? current : floor));
  }, []);

  const transport = useMemo(() => {
    const settle = (
      axis: DragAxis,
      rootKey: string,
      velocityPages: number,
      start: number,
    ) => {
      'worklet';
      if (axis === 'child') {
        const root = model.roots.find(item => item.key === rootKey);
        if (!root) {
          return;
        }
        const range: TrackRange = {
          end: Math.max(root.leaves.length - 1, 0),
          start: 0,
        };
        const current = childTracks.value[rootKey] ?? 0;
        const target = resolveSettleTarget({
          mode: settleMode ?? 'snap',
          position: current,
          range,
          start,
          velocityPages,
        });
        if (diagnosticsEnabled.value) {
          runOnJS(emitDiagnostic)({
            type: 'settle',
            axis: 'child',
            start,
            position: current,
            target,
            velocityPages,
          });
        }
        if (Math.abs(target - current) < 0.0001) {
          runOnJS(commitRootIndex)(target);
          return;
        }
        childTracks.value = {
          ...childTracks.value,
          [rootKey]: withTiming(target, { duration: 180 }, finished => {
            if (finished) {
              runOnJS(commitRootIndex)(target);
            }
          }),
        };
        return;
      }
      const current = rootTrack.value;
      const target = resolveSettleTarget({
        mode: settleMode ?? 'snap',
        position: current,
        range: pageRange,
        start,
        velocityPages,
      });
      if (diagnosticsEnabled.value) {
        runOnJS(emitDiagnostic)({
          type: 'settle',
          axis: 'root',
          start,
          position: current,
          target,
          velocityPages,
        });
      }
      settlingRoot.value = target;
      settlingSource.value = 0;
      if (Math.abs(target - current) < 0.0001) {
        settlingRoot.value = -1;
        settlingSource.value = -1;
        runOnJS(commitRootIndex)(target);
        return;
      }
      rootTrack.value = withTiming(target, { duration: 180 }, finished => {
        if (finished) {
          settlingRoot.value = -1;
          settlingSource.value = -1;
          runOnJS(commitRootIndex)(target);
        }
      });
    };

    const begin = (translationX: number, touchY: number) => {
      'worklet';
      if (widthValue.value <= 0) {
        return;
      }
      // A finger always takes over from a discrete page. Finishing an
      // in-flight settle at its target keeps the baseline authoritative: the
      // new gesture can never inherit a fractional mid-animation position.
      const trackBefore = rootTrack.value;
      cancelAnimation(rootTrack);
      const interruptedTarget = settlingRoot.value;
      const interruptedSource = settlingSource.value;
      const trackAtRest =
        interruptedTarget >= 0 && interruptedSource !== 1
          ? interruptedTarget
          : Math.round(rootTrack.value);
      const rootIndex = Math.max(
        0,
        Math.min(
          model.roots.length - 1,
          Math.round(trackAtRest),
        ),
      );
      rootTrack.value = rootIndex;
      settlingRoot.value = -1;
      settlingSource.value = -1;
      if (diagnosticsEnabled.value) {
        runOnJS(emitDiagnostic)({
          type: 'begin',
          start: rootIndex,
          track: rootIndex,
          snappedFrom:
            Math.abs(trackBefore - rootIndex) > 0.001 ? trackBefore : null,
          touchY,
        });
      }
      const root = model.roots[rootIndex];
      const childEligible =
        childSwipeEnabled &&
        root.leaves.length > 1 &&
        touchY >= (headers[root.key] ?? 0);
      const childTrack = childTracks.value[root.key] ?? 0;
      const childOrigin = Math.round(childTrack);
      if (childEligible && childOrigin !== childTrack) {
        childTracks.value = {
          ...childTracks.value,
          [root.key]: childOrigin,
        };
      }
      drag.value = {
        active: true,
        axis: childEligible ? 'child' : 'root',
        done: false,
        rootKey: root.key,
        startChild: childOrigin,
        startRoot: rootTrack.value,
        startX: translationX,
        lastVelocityX: 0,
      };
      gestureActive.value = true;
      runOnJS(publishDragFloor)(rootIndex);
      runOnJS(beginRetainedTransition)(scrollOffset.value, presentedHeight.value);
    };

    const update = (translationX: number, velocityX: number) => {
      'worklet';
      const current = drag.value;
      if (!current.active || widthValue.value <= 0) {
        return;
      }
      if (velocityX !== 0) {
        drag.value = { ...current, lastVelocityX: velocityX };
      }
      const delta = -(translationX - current.startX) / widthValue.value;
      if (current.axis === 'child') {
        const root = model.roots.find(item => item.key === current.rootKey);
        if (!root) {
          return;
        }
        const range: TrackRange = {
          end: Math.max(root.leaves.length - 1, 0),
          start: 0,
        };
        // One gesture may move at most one child page; beyond that the parent
        // track takes over, which is also what a nested swipe should feel like.
        const gestureRange: TrackRange = {
          end: Math.min(range.end, current.startChild + 1),
          start: Math.max(range.start, current.startChild - 1),
        };
        const { overflow, position } = splitTrackDelta({
          delta,
          range: gestureRange,
          start: current.startChild,
        });
        childTracks.value = { ...childTracks.value, [root.key]: position };
        // The child consumed what it could; the rest moves the parent track so
        // a continued drag leaves the group instead of dead-ending.
        rootTrack.value = clampTrackPosition(
          current.startRoot + overflow,
          pageRange,
        );
        return;
      }
      // The drag itself is bounded to one page either side of the page the
      // gesture began on, so the visible travel and the settle target always
      // describe the same single-page intent.
      const gestureRange: TrackRange = {
        end: Math.min(pageRange.end, current.startRoot + 1),
        start: Math.max(pageRange.start, current.startRoot - 1),
      };
      rootTrack.value = clampTrackPosition(
        current.startRoot + delta,
        gestureRange,
      );
    };

    const end = (translationX: number, velocityX: number) => {
      'worklet';
      const current = drag.value;
      if (!current.active || widthValue.value <= 0) {
        return;
      }
      drag.value = { ...current, done: true };
      const releaseVelocityX =
        velocityX !== 0 ? velocityX : current.lastVelocityX;
      if (diagnosticsEnabled.value) {
        runOnJS(emitDiagnostic)({
          type: 'end',
          axis: current.axis,
          start:
            current.axis === 'child' ? current.startChild : current.startRoot,
          position:
            current.axis === 'child'
              ? childTracks.value[current.rootKey] ?? 0
              : rootTrack.value,
          translationX,
          velocityPages: -releaseVelocityX / widthValue.value,
          velocityX: releaseVelocityX,
        });
      }
      settle(
        current.axis,
        current.rootKey,
        -releaseVelocityX / widthValue.value,
        current.axis === 'child' ? current.startChild : current.startRoot,
      );
    };

    const finalize = () => {
      'worklet';
      const current = drag.value;
      if (!current.active) {
        return;
      }
      drag.value = { ...current, active: false };
      if (!current.done) {
        settle(
          current.axis,
          current.rootKey,
          0,
          current.axis === 'child' ? current.startChild : current.startRoot,
        );
      }
    };

    return { begin, end, finalize, update };
  }, [
    beginRetainedTransition,
    childSwipeEnabled,
    childTracks,
    commitRootIndex,
    diagnosticsEnabled,
    drag,
    emitDiagnostic,
    gestureActive,
    headers,
    model,
    pageRange,
    presentedHeight,
    publishDragFloor,
    rootTrack,
    scrollOffset,
    settlingRoot,
    settlingSource,
    settleMode,
    widthValue,
  ]);

  // While the finger owns the track, publish the visible root window so page
  // activity (store subscriptions / render gating) follows the preview.
  useAnimatedReaction(
    () => (drag.value.active ? Math.floor(rootTrack.value) : -1),
    value => {
      if (value < 0) {
        return;
      }
      runOnJS(publishDragFloor)(
        Math.max(0, Math.min(model.roots.length - 1, value)),
      );
    },
    [model],
  );

  const settleFromCurrent = useCallback(
    (path: LinkedScenePath) => {
      // While the finger owns the track, only the gesture may write it.
      if (drag.value.active) {
        diagnosticsRef.current?.({
          type: 'jump',
          requested: rootIndexOf(model, path.key),
          applied: false,
          reason: 'drag-active',
        });
        return;
      }
      const rootIndex = rootIndexOf(model, path.key);
      if (settlingRoot.value === rootIndex) {
        // Already animating to that page; writing the track here would only
        // cancel the animation.
        diagnosticsRef.current?.({
          type: 'jump',
          requested: rootIndex,
          applied: false,
          reason: 'already-settling',
        });
        return;
      }
      diagnosticsRef.current?.({
        type: 'jump',
        requested: rootIndex,
        applied: true,
        from: rootTrack.value,
      });
      cancelAnimation(rootTrack);
      rootTrack.value = rootIndex;
      settlingRoot.value = -1;
      settlingSource.value = -1;
      const childIndex = childIndexOf(model, path);
      if (childIndex !== undefined) {
        const root = model.roots[rootIndex];
        childTracks.value = {
          ...childTracks.value,
          [root.key]: childIndex,
        };
      }
      commitRootIndex(rootIndex);
    },
    [childTracks, commitRootIndex, drag, model, rootTrack, settlingRoot],
  );

  const selectPath = useCallback(
    (path: LinkedScenePath) => {
      // A programmatic jump must never fight an active drag.
      if (drag.value.active) {
        diagnosticsRef.current?.({
          type: 'jump',
          requested: rootIndexOf(model, path.key),
          applied: false,
          reason: 'drag-active',
        });
        return;
      }
      const resolved = resolveLinkedScenePath(model, path, remembered.current);
      const rootIndex = rootIndexOf(model, resolved.key);
      diagnosticsRef.current?.({
        type: 'jump',
        requested: rootIndex,
        applied: true,
        from: rootTrack.value,
      });
      const childIndex = childIndexOf(model, resolved);
      if (childIndex !== undefined) {
        const root = model.roots[rootIndex];
        childTracks.value = { ...childTracks.value, [root.key]: childIndex };
      }
      gestureActive.value = true;
      settlingRoot.value = rootIndex;
      settlingSource.value = 1;
      rootTrack.value = withTiming(rootIndex, { duration: 200 }, finished => {
        if (finished) {
          settlingRoot.value = -1;
          settlingSource.value = -1;
          runOnJS(commitRootIndex)(rootIndex);
        }
      });
    },
    [
      childTracks,
      commitRootIndex,
      drag,
      gestureActive,
      model,
      rootTrack,
      settlingRoot,
    ],
  );

  const jumpPath = useCallback(
    (path: LinkedScenePath) => {
      settleFromCurrent(
        resolveLinkedScenePath(model, path, remembered.current),
      );
    },
    [model, settleFromCurrent],
  );

  React.useImperativeHandle(
    props.ref,
    () => ({
      jumpPath,
      jumpTab: (key: string) => jumpPath({ key }),
      selectPath,
      selectTab: (key: string) => selectPath({ key }),
    }),
    [jumpPath, selectPath],
  );

  // `activePath` is an initial/declarative hint only. Following it on every
  // prop change created a second writer for the same track: a commit reported
  // a page to the caller, the caller re-rendered with that page, and the
  // follow effect could still fire after a newer gesture had taken over.
  // Programmatic navigation uses `selectTab`/`jumpTab` explicitly instead.
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
          if (!touch || event.numberOfTouches !== 1 || widthValue.value <= 0) {
            manager.fail();
          }
        })
        .onStart(event => {
          'worklet';
          transport.begin(event.translationX, event.y);
        })
        .onUpdate(event => {
          'worklet';
          transport.update(event.translationX, event.velocityX);
        })
        .onEnd((event, success) => {
          'worklet';
          if (success) {
            transport.end(event.translationX, event.velocityX);
          }
        })
        .onFinalize(transport.finalize),
    [enabled, testID, transport, widthValue],
  );
  const rootStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: -rootTrack.value * widthValue.value }],
    }),
    [],
  );

  const activeRootWindow = useMemo(() => {
    if (dragFloor === null) {
      return [rootIndexOf(model, settled.key), rootIndexOf(model, settled.key)];
    }
    const start = Math.max(
      0,
      Math.min(dragFloor, model.roots.length - 1),
    );
    return [start, Math.min(model.roots.length - 1, start + 1)];
  }, [dragFloor, model, settled.key]);

  const activeLeafKeys = useMemo(() => {
    const keys: string[] = [];
    const [start, end] = activeRootWindow;
    for (let index = start; index <= end; index += 1) {
      for (const leaf of model.roots[index].leaves) {
        keys.push(leaf.physicalKey);
      }
    }
    return keys;
  }, [activeRootWindow, model]);

  const settledKey = linkedScenePhysicalKey(settled);
  const settledRootKey = settled.key;

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
          {model.roots.map(root => {
            const grouped = root.leaves.length > 1;
            const interactiveRoot =
              enabled && dragFloor === null && root.key === settledRootKey;
            return (
              <LinkedRootPage
                key={root.key}
                root={root}
                width={width}
                widthValue={widthValue}
                height={pagerHeight}
                topInsets={pageTopInsets}
                childTracks={childTracks}
                grouped={grouped}
                onHeaderHeight={height =>
                  setHeaders(current =>
                    current[root.key] === height
                      ? current
                      : { ...current, [root.key]: height },
                  )
                }
                testID={testID}
                interactive={interactiveRoot}
                header={
                  grouped
                    ? props.renderGroupHeader?.(root.key, {
                        active:
                          props.activityEnabled &&
                          activeLeafKeys.some(key =>
                            root.leaves.some(
                              leaf => leaf.physicalKey === key,
                            ),
                          ),
                        childKey:
                          root.leaves[Math.round(
                            childTracks.value[root.key] ?? 0,
                          )]?.path.childKey,
                        interactive: interactiveRoot,
                        selectChild: childKey =>
                          selectPath({ childKey, key: root.key }),
                      }) ?? null
                    : null
                }
                headerHeight={
                  root.leaves.length > 1 ? headers[root.key] ?? 0 : 0
                }
                renderLeaf={(leaf, headerHeight) => {
                  const interactive =
                    enabled && dragFloor === null && leaf.physicalKey === settledKey;
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
                          { marginTop: pageTopInsets[leaf.index] ?? 0 },
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
                        {grouped ? <View style={{ height: headerHeight }} /> : null}
                        {props.renderLeaf(leaf.path, {
                          active:
                            props.activityEnabled &&
                            activeLeafKeys.includes(leaf.physicalKey),
                          contentTop:
                            props.contentTop +
                            (pageTopInsets[leaf.index] ?? 0) +
                            headerHeight,
                          interactive,
                          minimumPageHeight:
                            grouped && mode === 'nested'
                              ? 0
                              : Math.max(0, minimum - headerHeight),
                          viewportHeight: props.viewportHeight,
                        })}
                      </View>
                    </View>
                  );
                }}
              />
            );
          })}
        </Animated.View>
        {props.overlay}
      </View>
    </GestureDetector>
  );
}

function LinkedRootPage({
  childTracks,
  grouped,
  header,
  headerHeight,
  height,
  interactive,
  onHeaderHeight,
  renderLeaf,
  root,
  testID,
  topInsets,
  width,
  widthValue,
}: {
  childTracks: SharedValue<Record<string, number>>;
  grouped: boolean;
  header: React.ReactNode;
  headerHeight: number;
  height: number;
  interactive: boolean;
  onHeaderHeight: (height: number) => void;
  renderLeaf: (
    leaf: LinkedSceneRoot['leaves'][number],
    headerHeight: number,
  ) => React.ReactElement;
  root: LinkedSceneRoot;
  testID: string;
  topInsets: number[];
  width: number;
  widthValue: SharedValue<number>;
}) {
  const childStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX:
            -(childTracks.value[root.key] ?? 0) * widthValue.value,
        },
      ],
    }),
    [root.key],
  );
  const headerStyle = useAnimatedStyle(() => {
    const position = childTracks.value[root.key] ?? 0;
    const lower = Math.floor(position);
    const upper = Math.min(root.leaves.length - 1, lower + 1);
    const from = topInsets[root.firstLeafIndex + lower] ?? 0;
    const to = topInsets[root.firstLeafIndex + upper] ?? from;
    return { top: from + (to - from) * (position - lower) };
  }, [root, topInsets]);

  return (
    <View
      testID={testID + '-root-' + root.key}
      style={[styles.root, { height, width }]}>
      {grouped ? (
        <>
          <Animated.View
            testID={testID + '-group-' + root.key + '-track'}
            style={[
              styles.track,
              { height, width: width * root.leaves.length },
              childStyle,
            ]}>
            {root.leaves.map(leaf => renderLeaf(leaf, headerHeight))}
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
        renderLeaf(root.leaves[0], 0)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 0, flexShrink: 0 },
  groupHeader: { left: 0, position: 'absolute', top: 0, zIndex: 1 },
  root: { flexShrink: 0, overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  viewport: { overflow: 'hidden' },
});
