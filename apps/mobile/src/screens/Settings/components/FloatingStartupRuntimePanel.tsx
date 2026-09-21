import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  makeMutable,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { AnimateableText, Text } from '@/components/Typography';
import {
  getFeatureActivationDiagnosticsSnapshot,
  subscribeFeatureActivationDiagnostics,
  type FeatureActivationEventRecord,
} from '@/core/utils/featureActivationDiagnostics';
import {
  getServiceRuntimeDiagnosticsSnapshot,
  subscribeServiceRuntimeDiagnostics,
  type ServiceCallRecord,
  type ServiceLifecycleEventRecord,
  type ServiceRuntimeDiagnosticsSnapshot,
} from '@/core/serviceApi/serviceRuntimeDiagnostics';
import {
  getStartupRuntimeDiagnosticsSnapshot,
  subscribeStartupRuntimeDiagnostics,
  type StartupModuleLoadRecord,
  type StartupRuntimeDiagnosticsSnapshot,
} from '@/startup/runtimeDiagnostics';

const MAX_MODULE_ROWS = 3;
const MAX_SERVICE_ROWS = 4;
const MAX_FEATURE_ROWS = 3;
const screenLayout = Dimensions.get('window');
const HANDLE_SIZE = 48;
const PANEL_WIDTH = Math.min(screenLayout.width - 24, 580);
const PANEL_BODY_WIDTH = PANEL_WIDTH - HANDLE_SIZE;
const PANEL_HEIGHT = Math.min(380, screenLayout.height * 0.8);
const VERTICAL_EDGE_PADDING = 40;
const HORIZONTAL_EDGE_PADDING = 0;
const SIDE_LEFT = 0;
const SIDE_RIGHT = 1;

const runtimePhaseTitle = makeMutable('bootstrap: module-evaluation');
const runtimePhaseReason = makeMutable('runtime_diagnostics_loaded');
const runtimeHandleLabel = makeMutable('SM');
const runtimeTone = makeMutable(0);
const runtimeMetricLoaded = makeMutable('0');
const runtimeMetricLoading = makeMutable('0');
const runtimeMetricErrors = makeMutable('0');
const runtimeMetricElapsed = makeMutable('0ms');
const runtimeModuleLines = Array.from({ length: MAX_MODULE_ROWS }, () =>
  makeMutable(''),
);
const runtimeServiceSummary = makeMutable('pending 0 | slow 0 | rejected 0');
const runtimeServiceLines = Array.from({ length: MAX_SERVICE_ROWS }, () =>
  makeMutable(''),
);
const runtimeFeatureLines = Array.from({ length: MAX_FEATURE_ROWS }, () =>
  makeMutable(''),
);
const startupRuntimeDiagnosticsEnabled =
  getStartupRuntimeDiagnosticsSnapshot().enabled;
let latestRuntimeLoadingCount = 0;
let latestRuntimeErrorCount = 0;
let latestServicePendingCount = 0;
let latestServiceSlowCount = 0;
let latestServiceErrorCount = 0;

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

function formatModuleLine(record: StartupModuleLoadRecord) {
  const status =
    record.status === 'loading'
      ? 'loading'
      : record.status === 'error'
      ? 'error'
      : 'loaded';
  const duration =
    record.status === 'loading'
      ? formatMs(Date.now() - record.requestedAt)
      : formatMs(record.durationMs);

  return `${status} | ${record.taskStage} | ${record.group}/${record.name} | ${duration}`;
}

function formatFeatureLine(record: FeatureActivationEventRecord) {
  return `${record.feature}#${record.visitNumber}: ${
    record.event
  } | +${formatMs(record.elapsedMs)} / ${formatMs(record.stepMs)}`;
}

function formatServiceCallLine(record: ServiceCallRecord) {
  const duration =
    record.status === 'pending'
      ? formatMs(Date.now() - record.requestedAt)
      : formatMs(record.durationMs);
  const route = record.route ? ` @${record.route}` : '';

  return `${record.status}${record.slow ? '!' : ''} | ${record.semantic} ${
    record.serviceName
  }.${record.method}${route} | ${duration}`;
}

function formatServiceEventLine(record: ServiceLifecycleEventRecord) {
  const duration = record.durationMs ? ` | ${formatMs(record.durationMs)}` : '';
  return `${record.status} | ${record.serviceName}${duration}`;
}

function syncPanelTone() {
  const errorCount = latestRuntimeErrorCount + latestServiceErrorCount;
  const activeCount =
    latestRuntimeLoadingCount +
    latestServicePendingCount +
    latestServiceSlowCount;

  runtimeTone.value = errorCount > 0 ? 2 : activeCount > 0 ? 1 : 0;
  runtimeHandleLabel.value =
    errorCount > 0 ? 'SM!' : activeCount > 0 ? 'SM*' : 'SM';
}

function syncRuntimeMutables(snapshot: StartupRuntimeDiagnosticsSnapshot) {
  runtimePhaseTitle.value = `${snapshot.phase}: ${snapshot.milestone}`;
  runtimePhaseReason.value = snapshot.phaseReason;
  runtimeMetricLoaded.value = `${snapshot.loadedCount}`;
  runtimeMetricLoading.value = `${snapshot.loadingCount}`;
  runtimeMetricErrors.value = `${snapshot.errorCount}`;
  runtimeMetricElapsed.value = formatMs(
    snapshot.updatedAt - snapshot.startedAt,
  );
  latestRuntimeLoadingCount = snapshot.loadingCount;
  latestRuntimeErrorCount = snapshot.errorCount;
  syncPanelTone();

  runtimeModuleLines.forEach((line, index) => {
    line.value = snapshot.modules[index]
      ? formatModuleLine(snapshot.modules[index])
      : index === 0
      ? 'No governed module recorded yet'
      : '';
  });
}

function syncServiceMutables(snapshot: ServiceRuntimeDiagnosticsSnapshot) {
  latestServicePendingCount = snapshot.pendingCallCount;
  latestServiceSlowCount = snapshot.slowPendingCallCount;
  latestServiceErrorCount = snapshot.errorCount;
  runtimeServiceSummary.value = `loading ${snapshot.loadingServiceCount} | pending ${snapshot.pendingCallCount} | slow ${snapshot.slowPendingCallCount} | rejected ${snapshot.rejectedCallCount}`;

  const relevantCalls = snapshot.calls.filter(
    record =>
      record.status === 'pending' ||
      record.status === 'rejected' ||
      record.slow,
  );
  const rows = [
    ...relevantCalls.map(formatServiceCallLine),
    ...snapshot.serviceEvents.map(formatServiceEventLine),
  ].slice(0, MAX_SERVICE_ROWS);

  runtimeServiceLines.forEach((line, index) => {
    line.value = rows[index]
      ? rows[index]
      : index === 0
      ? 'No deferred service activity recorded yet'
      : '';
  });
  syncPanelTone();
}

function useSyncStartupRuntimeMutables() {
  React.useEffect(() => {
    syncRuntimeMutables(getStartupRuntimeDiagnosticsSnapshot());
    syncServiceMutables(getServiceRuntimeDiagnosticsSnapshot());
    const syncFeatureMutables = () => {
      const snapshot = getFeatureActivationDiagnosticsSnapshot();
      runtimeFeatureLines.forEach((line, index) => {
        line.value = snapshot.events[index]
          ? formatFeatureLine(snapshot.events[index])
          : index === 0
          ? 'No feature activation recorded yet'
          : '';
      });
    };
    syncFeatureMutables();

    const unsubscribeRuntime = subscribeStartupRuntimeDiagnostics(() => {
      syncRuntimeMutables(getStartupRuntimeDiagnosticsSnapshot());
    });
    const unsubscribeServices = subscribeServiceRuntimeDiagnostics(() => {
      syncServiceMutables(getServiceRuntimeDiagnosticsSnapshot());
    });
    const unsubscribeFeatures =
      subscribeFeatureActivationDiagnostics(syncFeatureMutables);

    return () => {
      unsubscribeRuntime();
      unsubscribeServices();
      unsubscribeFeatures();
    };
  }, []);
}

function MutableText({
  value,
  style,
  numberOfLines,
}: {
  value: SharedValue<string>;
  style?: React.ComponentProps<typeof AnimateableText>['style'];
  numberOfLines?: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    text: value.value,
  }));

  return (
    <AnimateableText
      animatedProps={animatedProps}
      numberOfLines={numberOfLines}
      style={style}
    />
  );
}

function ModuleLine({ value }: { value: SharedValue<string> }) {
  const animatedProps = useAnimatedProps(() => ({
    text: value.value,
  }));

  return (
    <View style={styles.moduleLine}>
      <AnimateableText
        animatedProps={animatedProps}
        numberOfLines={1}
        style={styles.moduleText}
      />
    </View>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: SharedValue<string>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <MutableText numberOfLines={1} style={styles.metricValue} value={value} />
    </View>
  );
}

function RuntimeWindow() {
  return (
    <>
      <View style={styles.headerRow}>
        <MutableText
          numberOfLines={1}
          style={styles.title}
          value={runtimePhaseTitle}
        />
        <MutableText
          numberOfLines={1}
          style={styles.muted}
          value={runtimeMetricElapsed}
        />
      </View>
      <MutableText
        numberOfLines={1}
        style={styles.reason}
        value={runtimePhaseReason}
      />
      <View style={styles.metricsGrid}>
        <Metric label="loaded" value={runtimeMetricLoaded} />
        <Metric label="loading" value={runtimeMetricLoading} />
        <Metric label="errors" value={runtimeMetricErrors} />
      </View>
      <View style={styles.moduleList}>
        {runtimeModuleLines.map((line, index) => (
          <ModuleLine key={index} value={line} />
        ))}
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>services</Text>
        <MutableText
          numberOfLines={1}
          style={styles.sectionSummary}
          value={runtimeServiceSummary}
        />
      </View>
      <View style={styles.serviceList}>
        {runtimeServiceLines.map((line, index) => (
          <ModuleLine key={index} value={line} />
        ))}
      </View>
      <Text style={styles.sectionLabelStandalone}>feature cycles</Text>
      <View style={styles.featureList}>
        {runtimeFeatureLines.map((line, index) => (
          <ModuleLine key={index} value={line} />
        ))}
      </View>
    </>
  );
}

function FloatingStartupRuntimePanelContent() {
  const [collapsed, setCollapsed] = React.useState(true);
  useSyncStartupRuntimeMutables();

  const dockSide = useSharedValue(SIDE_RIGHT);
  const isDragging = useSharedValue(0);
  const handleTop = useSharedValue(320);
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

    const panelTop = clamp(
      handleTop.value - getHandleOffsetY(handleTop.value),
      getMinHandleTop(),
      screenLayout.height - VERTICAL_EDGE_PADDING - PANEL_HEIGHT,
    );

    return {
      left: getExpandedPanelLeft(dockSide.value),
      top: panelTop,
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

  const handleChromeStyles = useAnimatedStyle(() => {
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

  const handleStateStyles = useAnimatedStyle(() => {
    const tone = runtimeTone.value;
    return {
      backgroundColor:
        tone === 2
          ? 'rgba(127, 29, 29, 0.94)'
          : tone === 1
          ? 'rgba(68, 78, 96, 0.96)'
          : 'rgba(90, 98, 114, 0.9)',
      borderColor:
        tone === 2
          ? 'rgba(248, 113, 113, 0.68)'
          : tone === 1
          ? 'rgba(73, 222, 128, 0.58)'
          : 'rgba(255, 255, 255, 0.35)',
    };
  });

  const gesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((_event, success) => {
        if (success) {
          runOnJS(toggleCollapsed)();
        }
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

  return (
    <View pointerEvents="box-none" style={styles.portal}>
      <Animated.View style={[styles.container, rootAnimatedStyles]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.panel, panelAnimatedStyles]}>
          <RuntimeWindow />
        </Animated.View>
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.handle,
              handleAnimatedStyles,
              handleChromeStyles,
              handleStateStyles,
            ]}>
            <MutableText
              numberOfLines={1}
              style={styles.handleText}
              value={runtimeHandleLabel}
            />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

export function FloatingStartupRuntimePanel() {
  if (!startupRuntimeDiagnosticsEnabled) {
    return null;
  }

  return <FloatingStartupRuntimePanelContent />;
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    inset: 0,
    zIndex: 10010,
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
    borderWidth: StyleSheet.hairlineWidth,
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
  reason: {
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 9,
    lineHeight: 12,
  },
  metricsGrid: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  metric: {
    minWidth: 72,
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
  moduleList: {
    marginTop: 8,
    rowGap: 3,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    lineHeight: 12,
  },
  sectionHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 6,
  },
  sectionSummary: {
    flexShrink: 1,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'right',
  },
  sectionLabelStandalone: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    lineHeight: 12,
  },
  serviceList: {
    marginTop: 3,
    rowGap: 3,
  },
  featureList: {
    marginTop: 3,
    rowGap: 3,
  },
  moduleText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 10,
    lineHeight: 13,
  },
  moduleLine: {
    height: 13,
  },
});
