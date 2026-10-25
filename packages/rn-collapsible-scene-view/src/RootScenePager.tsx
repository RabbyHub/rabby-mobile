import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  beginRootSceneTouch,
  completeRootSceneMotion,
  createRootSceneMotion,
  finishRootSceneTouch,
  getRootSceneDragPosition,
  getRootSceneVisibleRange,
  requestRootSceneTarget,
  resolveRootSceneRelease,
  validateRootSceneKeys,
} from './rootScenePagerModel';

export type RootScenePageContext = {
  /** Remains the source page until settlement, including during previews. */
  selected: boolean;
  interactive: boolean;
  /** Selected page at rest, and pages crossed by the current transition. */
  visible: boolean;
};

export type RootScenePagerUI = {
  /** The moving track's exact fractional index; read only inside worklets. */
  readonly position: SharedValue<number>;
  /** The last UI-settled index, without waiting for its JS publication. */
  readonly selectedIndex: DerivedValue<number>;
  /** UI worklet: select a page, including while an earlier snap is moving. */
  readonly select: (index: number) => void;
};

export type RootSceneOverlayContext = {
  /** Remains the source page until settlement, including during previews. */
  selectedKey: string;
  /** Motion has settled; the host must still apply business authorization. */
  interactive: boolean;
  /** Stable UI presentation handle; business callbacks still use onSettled. */
  ui: RootScenePagerUI;
};

export type RootScenePagerProps = {
  keys: readonly string[];
  /** A changed value is a command. Echoing onSettled does not animate again. */
  requestedKey: string;
  onSettled: (key: string) => void;
  renderPage: (
    key: string,
    context: RootScenePageContext,
  ) => React.ReactElement | null;
  /** Shared chrome inside the gesture viewport, but outside the moving track. */
  renderOverlay?: (
    context: RootSceneOverlayContext,
  ) => React.ReactElement | null;
  /** Enables gestures/UI selections, not child controls or requestedKey commands. */
  enabled?: boolean;
  testID?: string;
  panGestureRef?: React.MutableRefObject<GestureType | undefined>;
  /** Optional UI worklet; veto at DOWN, before competing controls activate. */
  shouldStartGesture?: (point: {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
  }) => boolean;
};

type BlockRef = AnimatedRef<View>;
type GestureBlock = { ref: BlockRef; pageKey: string | null };
type RegisterBlock = (ref: BlockRef, pageKey: string | null) => () => void;
const GestureBlocksContext = createContext<RegisterBlock | null>(null);
const PageKeyContext = createContext<string | null>(null);

/** A native-measured exclusion for sliders/charts/inner pagers. No JS drag gate. */
export function RootScenePagerGestureBlock({
  children,
  ...viewProps
}: React.PropsWithChildren<ViewProps>) {
  const register = useContext(GestureBlocksContext);
  const pageKey = useContext(PageKeyContext);
  const ref = useAnimatedRef<View>();
  useLayoutEffect(() => register?.(ref, pageKey), [pageKey, ref, register]);
  return (
    <Animated.View {...viewProps} collapsable={false} ref={ref}>
      {children}
    </Animated.View>
  );
}

type Presentation = {
  key: string;
  visibleKeys: readonly string[];
  interactive: boolean;
};

const RootPageHost = memo(function RootPageHost({
  pageKey,
  width,
  selected,
  visible,
  interactive,
  renderPage,
  testID,
}: {
  pageKey: string;
  width: number;
  selected: boolean;
  visible: boolean;
  interactive: boolean;
  renderPage: RootScenePagerProps['renderPage'];
  testID: string;
}) {
  const context = useMemo(
    () => ({ selected, interactive, visible }),
    [selected, interactive, visible],
  );
  return (
    <View
      collapsable={false}
      testID={testID}
      style={[styles.page, { width }]}
      pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}>
      <PageKeyContext.Provider value={pageKey}>
        {renderPage(pageKey, context)}
      </PageKeyContext.Provider>
    </View>
  );
});

/** Fixed viewport / retained full screens. Owns no vertical scroll surface. */
export function RootScenePager(props: RootScenePagerProps) {
  const {
    enabled = true,
    shouldStartGesture,
    panGestureRef,
    testID = 'root-scene',
  } = props;
  const topology = validateRootSceneKeys(props.keys);
  const keys = useMemo<readonly [string, ...string[]]>(
    () => JSON.parse(topology),
    [topology],
  );
  const initial = useRef(Math.max(0, keys.indexOf(props.requestedKey))).current;
  const [width, setWidth] = useState(0);
  const [blocks, setBlocks] = useState<readonly GestureBlock[]>([]);
  const registerBlock = useCallback<RegisterBlock>((ref, pageKey) => {
    setBlocks(current =>
      current.some(item => item.ref === ref)
        ? current
        : [...current, { ref, pageKey }],
    );
    return () => setBlocks(current => current.filter(item => item.ref !== ref));
  }, []);
  const [presentation, setPresentation] = useState<Presentation>(() => ({
    key: keys[initial] ?? keys[0],
    visibleKeys: [keys[initial] ?? keys[0]],
    interactive: true,
  }));
  const latest = useRef(props);
  latest.current = props;
  const selectedKey = useRef(keys[initial] ?? keys[0]);
  const expectedEcho = useRef<string | null>(null);
  const mounted = useRef(false);
  const lastPublishedEpoch = useRef(-1);
  const requestId = useRef(0);
  const widthValue = useSharedValue(0);
  const position = useSharedValue(initial);
  const motion = useSharedValue(createRootSceneMotion(initial));
  const selectedIndex = useDerivedValue(() => motion.value.selected);
  const uiEnabled = useSharedValue(enabled);
  const uiRequestId = useSharedValue(0);
  const uiMounted = useSharedValue(true);
  const touchEpoch = useSharedValue(-1);
  const visibleRange = useSharedValue('');

  useLayoutEffect(() => {
    uiEnabled.value = enabled;
  }, [enabled, uiEnabled]);

  const publish = useCallback(
    (epoch: number, command: number, next: Presentation, settled: boolean) => {
      if (
        !mounted.current ||
        command !== requestId.current ||
        epoch < lastPublishedEpoch.current
      ) {
        return;
      }
      lastPublishedEpoch.current = epoch;
      setPresentation(current =>
        current.key === next.key &&
        current.interactive === next.interactive &&
        current.visibleKeys.length === next.visibleKeys.length &&
        current.visibleKeys.every(
          (key, index) => key === next.visibleKeys[index],
        )
          ? current
          : next,
      );
      if (settled && selectedKey.current !== next.key) {
        selectedKey.current = next.key;
        expectedEcho.current = next.key;
        latest.current.onSettled(next.key);
      }
    },
    [],
  );

  const transport = useMemo(() => {
    const publishMoving = (target: number) => {
      'worklet';
      const range = getRootSceneVisibleRange(
        position.value,
        target,
        keys.length,
      );
      const signature = `${motion.value.epoch}:${range[0]}:${range[1]}`;
      if (visibleRange.value === signature) {
        return;
      }
      visibleRange.value = signature;
      runOnJS(publish)(
        motion.value.epoch,
        uiRequestId.value,
        {
          key: keys[motion.value.selected] ?? keys[0],
          visibleKeys: keys.slice(range[0], range[1] + 1),
          interactive: false,
        },
        false,
      );
    };
    const complete = (epoch: number) => {
      'worklet';
      if (!uiMounted.value) {
        return;
      }
      const state = motion.value;
      const next = completeRootSceneMotion(state, epoch);
      if (next === state) {
        return;
      }
      motion.value = next;
      position.value = next.selected;
      visibleRange.value = '';
      runOnJS(publish)(
        epoch,
        uiRequestId.value,
        {
          key: keys[next.selected] ?? keys[0],
          visibleKeys: [keys[next.selected] ?? keys[0]],
          interactive: true,
        },
        true,
      );
    };
    const animate = () => {
      'worklet';
      if (
        !uiMounted.value ||
        widthValue.value <= 0 ||
        motion.value.phase !== 'snap'
      ) {
        return;
      }
      const { target, epoch } = motion.value;
      cancelAnimation(position);
      if (Math.abs(position.value - target) < 0.0001) {
        complete(epoch);
      } else {
        publishMoving(target);
        position.value = withTiming(target, { duration: 220 }, finished => {
          'worklet';
          if (finished) {
            complete(epoch);
          }
        });
      }
    };
    const command = (index: number, id: number) => {
      'worklet';
      if (!uiMounted.value) {
        return;
      }
      uiRequestId.value = id;
      // A same-endpoint command still acknowledges the current request id: the
      // preceding completion may be queued on JS and rejected by its old id.
      if (motion.value.phase === 'idle' && motion.value.selected === index) {
        motion.value = requestRootSceneTarget(motion.value, index);
        complete(motion.value.epoch);
        return;
      }
      motion.value = requestRootSceneTarget(motion.value, index);
      if (motion.value.phase === 'snap') {
        animate();
      }
    };
    const down = () => {
      'worklet';
      motion.value = beginRootSceneTouch(motion.value, position.value);
      touchEpoch.value = motion.value.epoch;
      cancelAnimation(position);
    };
    const update = (translationX: number) => {
      'worklet';
      if (
        touchEpoch.value !== motion.value.epoch ||
        motion.value.phase !== 'drag'
      ) {
        return;
      }
      position.value = getRootSceneDragPosition(
        motion.value.startPosition,
        translationX,
        widthValue.value,
        keys.length,
      );
      publishMoving(position.value);
    };
    const start = (translationX: number) => {
      'worklet';
      if (
        touchEpoch.value !== motion.value.epoch ||
        motion.value.phase !== 'touch'
      ) {
        return;
      }
      motion.value = { ...motion.value, phase: 'drag' };
      update(translationX);
    };
    const end = (translationX: number, velocityX: number) => {
      'worklet';
      if (
        touchEpoch.value !== motion.value.epoch ||
        motion.value.phase !== 'drag'
      ) {
        return;
      }
      update(translationX);
      const target = resolveRootSceneRelease(
        motion.value.startPosition,
        position.value,
        translationX,
        velocityX,
        keys.length,
      );
      motion.value = finishRootSceneTouch(motion.value, target);
      touchEpoch.value = -1;
      animate();
    };
    const finalize = () => {
      'worklet';
      if (touchEpoch.value !== motion.value.epoch) {
        return;
      }
      const state = motion.value;
      if (
        state.phase === 'touch' &&
        state.queued === null &&
        state.target === state.selected &&
        Math.abs(position.value - state.selected) < 0.0001
      ) {
        // Ordinary taps and native vertical drags never entered our gesture.
        // Keep controls active, with no JS publication or transition renders.
        motion.value = createRootSceneMotion(state.selected, state.epoch + 1);
        touchEpoch.value = -1;
        return;
      }
      // Includes DOWN-only taps/vertical failures and cancelled ACTIVE gestures.
      motion.value = finishRootSceneTouch(motion.value, motion.value.target);
      touchEpoch.value = -1;
      animate();
    };
    return { animate, command, down, start, update, end, finalize };
  }, [
    keys,
    motion,
    position,
    publish,
    touchEpoch,
    uiMounted,
    uiRequestId,
    visibleRange,
    widthValue,
  ]);

  const ui = useMemo<RootScenePagerUI>(
    () => ({
      position,
      selectedIndex,
      select: (index: number) => {
        'worklet';
        if (
          !uiMounted.value ||
          !uiEnabled.value ||
          widthValue.value <= 0 ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= keys.length
        ) {
          return;
        }
        // This is another UI-owned navigation intent, not a new JS command.
        // Keep the JS request fence while command() advances the motion epoch,
        // so interrupted snaps cannot commit and onSettled still echoes once.
        // In particular, never mirror position through requestedKey/React.
        transport.command(index, uiRequestId.value);
      },
    }),
    [
      keys,
      position,
      selectedIndex,
      transport,
      uiEnabled,
      uiMounted,
      uiRequestId,
      widthValue,
    ],
  );
  const overlayContext = useMemo<RootSceneOverlayContext>(
    () => ({
      selectedKey: presentation.key,
      interactive: presentation.interactive,
      ui,
    }),
    [presentation.key, presentation.interactive, ui],
  );

  useLayoutEffect(() => {
    mounted.current = true;
    runOnUI(() => {
      'worklet';
      uiMounted.value = true;
    })();
    return () => {
      mounted.current = false;
      runOnUI(() => {
        'worklet';
        uiMounted.value = false;
        motion.value = createRootSceneMotion(
          motion.value.selected,
          motion.value.epoch + 1,
        );
        touchEpoch.value = -1;
        cancelAnimation(position);
      })();
    };
  }, [motion, position, touchEpoch, uiMounted]);

  const previousGeometry = useRef({ keys, width: 0 });
  useLayoutEffect(() => {
    const previous = previousGeometry.current;
    previousGeometry.current = { keys, width };
    if (previous.width === width && previous.keys === keys) {
      return;
    }
    const { animate } = transport;
    runOnUI(() => {
      'worklet';
      const state = motion.value;
      const nextSelected = Math.max(
        0,
        keys.indexOf(previous.keys[state.selected] ?? previous.keys[0]),
      );
      const targetKey =
        previous.keys[
          state.queued ??
            (state.phase === 'snap' ? state.target : state.selected)
        ];
      const nextTarget = Math.max(
        0,
        keys.indexOf(targetKey ?? previous.keys[0]),
      );
      motion.value = {
        ...createRootSceneMotion(nextSelected, state.epoch + 1),
        phase: 'snap',
        target: nextTarget,
      };
      touchEpoch.value = -1;
      cancelAnimation(position);
      position.value = nextSelected;
      widthValue.value = width;
      visibleRange.value = '';
      animate();
    })();
  }, [
    keys,
    motion,
    position,
    touchEpoch,
    transport,
    visibleRange,
    width,
    widthValue,
  ]);

  const previousRequest = useRef(props.requestedKey);
  useLayoutEffect(() => {
    if (previousRequest.current === props.requestedKey) {
      return;
    }
    previousRequest.current = props.requestedKey;
    const index = Math.max(0, keys.indexOf(props.requestedKey));
    // Echoes of a completed selection must not queue a return during a new drag.
    if (expectedEcho.current === keys[index]) {
      expectedEcho.current = null;
      return;
    }
    expectedEcho.current = null;
    const id = ++requestId.current;
    runOnUI(transport.command)(index, id);
  }, [keys, props.requestedKey, transport]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
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
          widthValue.value <= 0 ||
          !uiMounted.value ||
          (shouldStartGesture && !shouldStartGesture(touch))
        ) {
          manager.fail();
          return;
        }
        for (const block of blocks) {
          if (
            block.pageKey !== null &&
            block.pageKey !== keys[motion.value.selected]
          ) {
            continue;
          }
          const rect = measure(block.ref);
          // Layout readiness must not allow the pager to steal a slider's DOWN.
          if (
            !rect ||
            (touch.absoluteX >= rect.pageX &&
              touch.absoluteX <= rect.pageX + rect.width &&
              touch.absoluteY >= rect.pageY &&
              touch.absoluteY <= rect.pageY + rect.height)
          ) {
            manager.fail();
            return;
          }
        }
        transport.down();
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
      .onFinalize(transport.finalize);
    if (panGestureRef) {
      pan.withRef(panGestureRef);
    }
    return pan;
  }, [
    blocks,
    enabled,
    keys,
    motion,
    panGestureRef,
    shouldStartGesture,
    testID,
    transport,
    uiMounted,
    widthValue,
  ]);
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -position.value * widthValue.value }],
  }));

  return (
    <GestureBlocksContext.Provider value={registerBlock}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.viewport}
          testID={testID + '-viewport'}
          onLayout={event => {
            const next = event.nativeEvent.layout.width;
            if (Number.isFinite(next) && next > 0) {
              setWidth(current =>
                Math.abs(current - next) > 0.5 ? next : current,
              );
            }
          }}>
          <Animated.View
            testID={testID + '-track'}
            style={[styles.track, { width: width * keys.length }, trackStyle]}>
            {keys.map(key => (
              <RootPageHost
                key={key}
                pageKey={key}
                width={width}
                selected={presentation.key === key}
                visible={presentation.visibleKeys.includes(key)}
                interactive={
                  presentation.interactive && presentation.key === key
                }
                renderPage={props.renderPage}
                testID={`${testID}-page-${key}`}
              />
            ))}
          </Animated.View>
          {props.renderOverlay ? (
            <View
              pointerEvents="box-none"
              style={StyleSheet.absoluteFill}
              testID={`${testID}-overlay`}>
              {props.renderOverlay(overlayContext)}
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </GestureBlocksContext.Provider>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  track: { height: '100%', flexDirection: 'row' },
  page: { height: '100%', overflow: 'hidden' },
});
