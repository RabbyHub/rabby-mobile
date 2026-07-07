import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  makeMutable,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import { AnimateableText, Text } from '@/components/Typography';
import { isNonPublicProductionEnv, NEED_DEVSETTINGBLOCKS } from '@/constant';
import { zustandByMMKV } from '@/core/storage/mmkv';
import {
  getDbSyncSummarySnapshot,
  subscribeDbSyncSummarySnapshot,
  type DbSyncSummarySnapshot,
  type DbSyncSummaryTask,
  type DbSyncWindowSummary,
} from '@/core/utils/startupDiagnostics';

const MAX_TASK_ROWS = 4;
const screenLayout = Dimensions.get('window');
const HANDLE_SIZE = 48;
const PANEL_WIDTH = Math.min(screenLayout.width - 24, 560);
const PANEL_BODY_WIDTH = PANEL_WIDTH - HANDLE_SIZE;
const PANEL_HEIGHT = Math.min(232, screenLayout.height * 0.8);
const VERTICAL_EDGE_PADDING = 40;
const HORIZONTAL_EDGE_PADDING = 0;
const SIDE_LEFT = 0;
const SIDE_RIGHT = 1;

const floatingDbSyncSummaryPanelStore = zustandByMMKV<{
  enabled: boolean;
}>('@FloatingDbSyncSummaryPanel', {
  enabled: false,
});

const dbSummaryTitle = makeMutable('DB sync summary');
const dbSummaryAge = makeMutable('');
const dbSummaryHandleLabel = makeMutable('DB');
const dbSummaryHasActiveWindow = makeMutable(0);
const dbSummaryMetricTasks = makeMutable('-');
const dbSummaryMetricBatches = makeMutable('-');
const dbSummaryMetricParams = makeMutable('-');
const dbSummaryMetricExecute = makeMutable('-');
const dbSummaryMetricGap = makeMutable('-');
const dbSummaryMetricStalls = makeMutable('-');
const dbSummaryTaskLines = Array.from({ length: MAX_TASK_ROWS }, () =>
  makeMutable(''),
);
const dbSummaryRuntimeEnabled = getDbSyncSummarySnapshot().enabled;

const toggleShowDbSyncSummaryPanel = (nextEnabled?: boolean) => {
  if (!isNonPublicProductionEnv) {
    return false;
  }

  let finalValue = false;
  floatingDbSyncSummaryPanelStore.setState(prev => {
    if (typeof nextEnabled !== 'boolean') {
      nextEnabled = !prev.enabled;
    }

    finalValue = nextEnabled;

    return {
      ...prev,
      enabled: finalValue,
    };
  });

  return finalValue;
};

export function useToggleShowDbSyncSummaryPanel() {
  const showDbSyncSummaryPanel = floatingDbSyncSummaryPanelStore(
    state => isNonPublicProductionEnv && state.enabled,
  );

  return {
    showDbSyncSummaryPanel,
    toggleShowDbSyncSummaryPanel,
  };
}

function clamp(value: number, min: number, max: number) {
  'worklet';

  return Math.min(Math.max(value, min), max);
}

function getMinHandleTop() {
  'worklet';

  return VERTICAL_EDGE_PADDING;
}

function getMaxHandleTop() {
  'worklet';

  return screenLayout.height - VERTICAL_EDGE_PADDING - HANDLE_SIZE;
}

function getHandleOffsetY(handleTop: number) {
  'worklet';

  if (PANEL_HEIGHT <= HANDLE_SIZE) {
    return 0;
  }

  const min = getMinHandleTop();
  const max = getMaxHandleTop();
  const ratio =
    max === min ? 0 : (clamp(handleTop, min, max) - min) / (max - min);

  return ratio * (PANEL_HEIGHT - HANDLE_SIZE);
}

function getCollapsedHandleLeft(side: number) {
  'worklet';

  return side === SIDE_LEFT
    ? HORIZONTAL_EDGE_PADDING
    : screenLayout.width - HANDLE_SIZE - HORIZONTAL_EDGE_PADDING;
}

function getExpandedPanelLeft(side: number) {
  'worklet';

  return side === SIDE_LEFT
    ? HORIZONTAL_EDGE_PADDING
    : screenLayout.width - PANEL_WIDTH - HORIZONTAL_EDGE_PADDING;
}

function getExpandedHandleLeft(side: number) {
  'worklet';

  return side === SIDE_LEFT ? PANEL_WIDTH - HANDLE_SIZE : 0;
}

function getPanelBodyLeft(side: number) {
  'worklet';

  return side === SIDE_LEFT ? 0 : HANDLE_SIZE;
}

function getDockSideByHandleLeft(handleLeft: number) {
  'worklet';

  return handleLeft + HANDLE_SIZE / 2 < screenLayout.width / 2
    ? SIDE_LEFT
    : SIDE_RIGHT;
}

function formatMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0ms';
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  return `${(value / 1000).toFixed(1)}s`;
}

function formatAge(timestamp?: number) {
  if (!timestamp) {
    return '-';
  }

  return formatMs(Date.now() - timestamp);
}

function formatTask(task: DbSyncSummaryTask) {
  const progress =
    task.totalBatches > 0
      ? `${task.completedBatches}/${task.totalBatches}`
      : `${task.completedBatches}`;
  const stageStatus =
    task.stage === task.status ? task.status : `${task.stage}/${task.status}`;
  const stageText = task.stageDetail
    ? `${stageStatus} ${task.stageDetail}`
    : stageStatus;

  return `#${task.id} ${task.taskFor}/${task.entityName} · ${stageText} · ${task.totalRows} rows · ${progress} batches`;
}

function getWindowTitle(summary: DbSyncWindowSummary, active: boolean) {
  return `${active ? 'Active' : 'Last'} DB sync #${summary.id} · ${
    active
      ? `${formatMs(summary.durationMs)} running`
      : formatMs(summary.durationMs)
  }`;
}

function syncDbSummaryMutableSnapshot(snapshot: DbSyncSummarySnapshot) {
  const activeWindow = snapshot.activeWindow;
  const summary = activeWindow || snapshot.lastWindow;
  const isActive = !!activeWindow;

  dbSummaryHasActiveWindow.value = isActive ? 1 : 0;
  dbSummaryHandleLabel.value = isActive ? 'DB*' : 'DB';

  if (!summary) {
    dbSummaryTitle.value = 'DB sync summary';
    dbSummaryAge.value = '';
    dbSummaryMetricTasks.value = '-';
    dbSummaryMetricBatches.value = '-';
    dbSummaryMetricParams.value = '-';
    dbSummaryMetricExecute.value = '-';
    dbSummaryMetricGap.value = '-';
    dbSummaryMetricStalls.value = '-';
    dbSummaryTaskLines.forEach((line, index) => {
      line.value = index === 0 ? 'No DB sync window yet' : '';
    });
    return;
  }

  dbSummaryTitle.value = getWindowTitle(summary, isActive);
  dbSummaryAge.value =
    !isActive && summary.endedAt ? `${formatAge(summary.endedAt)} ago` : '';
  dbSummaryMetricTasks.value = `${summary.taskCount} · ${summary.totalRows} rows`;
  dbSummaryMetricBatches.value = `${summary.completedBatches}/${summary.totalBatches}`;
  dbSummaryMetricParams.value = formatMs(summary.paramsBuildMs);
  dbSummaryMetricExecute.value = formatMs(summary.executeMs);
  dbSummaryMetricGap.value = formatMs(summary.maxGapMs);
  dbSummaryMetricStalls.value = `${summary.stallCount}`;

  const tasks = summary.tasks.slice(0, MAX_TASK_ROWS);
  dbSummaryTaskLines.forEach((line, index) => {
    line.value = tasks[index]
      ? formatTask(tasks[index])
      : index === 0
      ? 'No task recorded in this window'
      : '';
  });
}

function useSyncDbSummaryMutables() {
  React.useEffect(() => {
    syncDbSummaryMutableSnapshot(getDbSyncSummarySnapshot());

    return subscribeDbSyncSummarySnapshot(() => {
      syncDbSummaryMutableSnapshot(getDbSyncSummarySnapshot());
    });
  }, []);
}

function MutableSummaryText({
  value,
  style,
  numberOfLines,
}: {
  value: SharedValue<string>;
  style?: React.ComponentProps<typeof AnimateableText>['style'];
  numberOfLines?: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    return {
      text: value.value,
    };
  });

  return (
    <AnimateableText
      animatedProps={animatedProps}
      numberOfLines={numberOfLines}
      style={style}
    />
  );
}

function MutableTaskLine({ value }: { value: SharedValue<string> }) {
  const animatedProps = useAnimatedProps(() => {
    return {
      text: value.value,
    };
  });
  const wrapStyle = useAnimatedStyle(() => {
    return {
      opacity: value.value ? 1 : 0,
    };
  });

  return (
    <Animated.View style={wrapStyle}>
      <AnimateableText
        animatedProps={animatedProps}
        numberOfLines={1}
        style={styles.taskText}
      />
    </Animated.View>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: SharedValue<string>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <MutableSummaryText
        numberOfLines={1}
        style={styles.metricValue}
        value={value}
      />
    </View>
  );
}

function SummaryWindow() {
  return (
    <>
      <View style={styles.headerRow}>
        <MutableSummaryText
          numberOfLines={1}
          style={styles.title}
          value={dbSummaryTitle}
        />
        <MutableSummaryText
          numberOfLines={1}
          style={styles.muted}
          value={dbSummaryAge}
        />
      </View>
      <View style={styles.metricsGrid}>
        <SummaryMetric label="tasks" value={dbSummaryMetricTasks} />
        <SummaryMetric label="batches" value={dbSummaryMetricBatches} />
        <SummaryMetric label="params" value={dbSummaryMetricParams} />
        <SummaryMetric label="execute" value={dbSummaryMetricExecute} />
        <SummaryMetric label="max gap" value={dbSummaryMetricGap} />
        <SummaryMetric label="stalls" value={dbSummaryMetricStalls} />
      </View>
      <View style={styles.taskList}>
        {dbSummaryTaskLines.map((line, index) => (
          <MutableTaskLine key={index} value={line} />
        ))}
      </View>
    </>
  );
}

export function FloatingDbSyncSummaryPanel() {
  const { showDbSyncSummaryPanel } = useToggleShowDbSyncSummaryPanel();
  const [collapsed, setCollapsed] = React.useState(true);
  useSyncDbSummaryMutables();

  const dockSide = useSharedValue(SIDE_RIGHT);
  const isDragging = useSharedValue(0);
  const handleTop = useSharedValue(120);
  const dragHandleLeft = useSharedValue(getCollapsedHandleLeft(dockSide.value));
  const dragHandleTop = useSharedValue(handleTop.value);
  const dragStartLeft = useSharedValue(dragHandleLeft.value);
  const dragStartTop = useSharedValue(handleTop.value);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed(value => !value);
  }, []);

  const rootAnimatedStyles = useAnimatedStyle(() => {
    if (isDragging.value) {
      return {
        left: dragHandleLeft.value,
        top: dragHandleTop.value,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    }

    if (collapsed) {
      return {
        left: getCollapsedHandleLeft(dockSide.value),
        top: handleTop.value,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    }

    const nextPanelTop = clamp(
      handleTop.value - getHandleOffsetY(handleTop.value),
      getMinHandleTop(),
      screenLayout.height - VERTICAL_EDGE_PADDING - PANEL_HEIGHT,
    );

    return {
      left: getExpandedPanelLeft(dockSide.value),
      top: nextPanelTop,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    };
  }, [collapsed]);

  const handleAnimatedStyles = useAnimatedStyle(() => {
    if (isDragging.value || collapsed) {
      return {
        left: 0,
        top: 0,
      };
    }

    return {
      left: getExpandedHandleLeft(dockSide.value),
      top: getHandleOffsetY(handleTop.value),
    };
  }, [collapsed]);

  const panelAnimatedStyles = useAnimatedStyle(() => {
    const hidden = collapsed || !!isDragging.value;
    const activeSide = dockSide.value;

    return {
      opacity: hidden ? 0 : 1,
      width: hidden ? 0 : PANEL_BODY_WIDTH,
      left: getPanelBodyLeft(activeSide),
      borderTopLeftRadius: activeSide === SIDE_LEFT ? 10 : 0,
      borderBottomLeftRadius: activeSide === SIDE_LEFT ? 10 : 0,
      borderTopRightRadius: activeSide === SIDE_RIGHT ? 10 : 0,
      borderBottomRightRadius: activeSide === SIDE_RIGHT ? 10 : 0,
    };
  }, [collapsed]);

  const handleAnimatedChromeStyles = useAnimatedStyle(() => {
    const activeSide = isDragging.value
      ? getDockSideByHandleLeft(dragHandleLeft.value)
      : dockSide.value;

    return {
      borderTopLeftRadius: activeSide === SIDE_LEFT ? 0 : HANDLE_SIZE / 2,
      borderBottomLeftRadius: activeSide === SIDE_LEFT ? 0 : HANDLE_SIZE / 2,
      borderTopRightRadius: activeSide === SIDE_RIGHT ? 0 : HANDLE_SIZE / 2,
      borderBottomRightRadius: activeSide === SIDE_RIGHT ? 0 : HANDLE_SIZE / 2,
    };
  });
  const handleStateAnimatedStyles = useAnimatedStyle(() => {
    return {
      backgroundColor: dbSummaryHasActiveWindow.value
        ? 'rgba(68, 78, 96, 0.96)'
        : 'rgba(90, 98, 114, 0.9)',
      borderColor: dbSummaryHasActiveWindow.value
        ? 'rgba(73, 222, 128, 0.58)'
        : 'rgba(255, 255, 255, 0.35)',
    };
  });

  const composedGesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((_event, success) => {
        if (!success) {
          return;
        }

        runOnJS(toggleCollapsed)();
      });

    const pan = Gesture.Pan()
      .minDistance(4)
      .onStart(() => {
        const currentHandleLeft = collapsed
          ? getCollapsedHandleLeft(dockSide.value)
          : getExpandedPanelLeft(dockSide.value) +
            getExpandedHandleLeft(dockSide.value);

        dragStartLeft.value = currentHandleLeft;
        dragStartTop.value = handleTop.value;
        dragHandleLeft.value = currentHandleLeft;
        dragHandleTop.value = handleTop.value;
        isDragging.value = 1;
      })
      .onUpdate(event => {
        dragHandleLeft.value = clamp(
          dragStartLeft.value + event.translationX,
          HORIZONTAL_EDGE_PADDING,
          screenLayout.width - HANDLE_SIZE - HORIZONTAL_EDGE_PADDING,
        );
        dragHandleTop.value = clamp(
          dragStartTop.value + event.translationY,
          getMinHandleTop(),
          getMaxHandleTop(),
        );
      })
      .onEnd(() => {
        handleTop.value = dragHandleTop.value;
        dockSide.value = getDockSideByHandleLeft(dragHandleLeft.value);
        isDragging.value = 0;
      })
      .onFinalize(() => {
        isDragging.value = 0;
      });

    return Gesture.Race(pan, tap);
  }, [
    collapsed,
    dockSide,
    dragHandleLeft,
    dragHandleTop,
    dragStartLeft,
    dragStartTop,
    handleTop,
    isDragging,
    toggleCollapsed,
  ]);

  React.useEffect(() => {
    const minTop = getMinHandleTop();
    const maxTop = getMaxHandleTop();

    handleTop.value = Math.min(Math.max(handleTop.value, minTop), maxTop);
  }, [handleTop]);

  if (
    !NEED_DEVSETTINGBLOCKS ||
    !isNonPublicProductionEnv ||
    !showDbSyncSummaryPanel ||
    !dbSummaryRuntimeEnabled
  ) {
    return null;
  }

  return (
    <GestureHandlerRootView pointerEvents="box-none" style={styles.portal}>
      <Animated.View style={[styles.container, rootAnimatedStyles]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.panel, panelAnimatedStyles]}>
          <SummaryWindow />
        </Animated.View>

        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              styles.handle,
              handleAnimatedStyles,
              handleAnimatedChromeStyles,
              handleStateAnimatedStyles,
            ]}>
            <MutableSummaryText
              numberOfLines={1}
              style={styles.handleText}
              value={dbSummaryHandleLabel}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    inset: 0,
    zIndex: 10000,
  },
  container: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(9, 14, 31, 0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: 'rgba(90, 98, 114, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 8,
  },
  handleText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  headerRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  muted: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 10,
    lineHeight: 14,
  },
  metricsGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metric: {
    minWidth: 86,
    flexGrow: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricLabel: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 9,
    lineHeight: 12,
  },
  metricValue: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  taskList: {
    marginTop: 8,
    rowGap: 3,
  },
  taskText: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 10,
    lineHeight: 13,
  },
});
