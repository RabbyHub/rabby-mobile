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
import { keyringService } from '@/core/services';
import { zustandByMMKV } from '@/core/storage/mmkv';
import {
  getKeyringRuntimeConvergenceSnapshot,
  subscribeKeyringRuntimeConvergenceSnapshot,
  type KeyringRuntimeConvergenceRecord,
  type KeyringRuntimeConvergenceSnapshot,
} from '@/core/utils/startupDiagnostics';

const MAX_ACCOUNT_ROWS = 4;
const MAX_RECORD_ROWS = 2;
const screenLayout = Dimensions.get('window');
const HANDLE_SIZE = 48;
const PANEL_WIDTH = Math.min(screenLayout.width - 24, 560);
const PANEL_BODY_WIDTH = PANEL_WIDTH - HANDLE_SIZE;
const PANEL_HEIGHT = Math.min(308, screenLayout.height * 0.8);
const VERTICAL_EDGE_PADDING = 40;
const HORIZONTAL_EDGE_PADDING = 0;
const SIDE_LEFT = 0;
const SIDE_RIGHT = 1;

const floatingKeyringRuntimePanelStore = zustandByMMKV<{
  enabled: boolean;
}>('@FloatingKeyringRuntimePanel', {
  enabled: false,
});

const keyringRuntimeTitle = makeMutable('Keyring runtime');
const keyringRuntimeAge = makeMutable('');
const keyringRuntimeHandleLabel = makeMutable('KR');
const keyringRuntimeTone = makeMutable(0);
const keyringRuntimeMetricStatus = makeMutable('idle');
const keyringRuntimeMetricUnlock = makeMutable('-');
const keyringRuntimeMetricRuntime = makeMutable('-');
const keyringRuntimeMetricKeyrings = makeMutable('-');
const keyringRuntimeMetricWait = makeMutable('-');
const keyringRuntimeMetricRun = makeMutable('-');
const keyringRuntimeMetricPerf = makeMutable('-');
const keyringRuntimeAccountLines = Array.from(
  { length: MAX_ACCOUNT_ROWS },
  () => makeMutable(''),
);
const keyringRuntimeRecordLines = Array.from({ length: MAX_RECORD_ROWS }, () =>
  makeMutable(''),
);
const keyringRuntimeDiagnosticsEnabled =
  getKeyringRuntimeConvergenceSnapshot().enabled;

const toggleShowKeyringRuntimePanel = (nextEnabled?: boolean) => {
  if (!isNonPublicProductionEnv) {
    return false;
  }

  let finalValue = false;
  floatingKeyringRuntimePanelStore.setState(prev => {
    finalValue = typeof nextEnabled === 'boolean' ? nextEnabled : !prev.enabled;

    return {
      ...prev,
      enabled: finalValue,
    };
  });

  return finalValue;
};

export function useToggleShowKeyringRuntimePanel() {
  const showKeyringRuntimePanel = floatingKeyringRuntimePanelStore(
    state => isNonPublicProductionEnv && state.enabled,
  );

  return {
    showKeyringRuntimePanel,
    toggleShowKeyringRuntimePanel,
  };
}

type DisplayedKeyringLike = {
  type?: string;
  accounts?: {
    address?: string;
    brandName?: string;
    type?: string;
  }[];
};

type KeyringRuntimeMemStoreState = {
  isUnlocked?: boolean;
  keyringRuntimeReady?: boolean;
  keyringRuntimeRestoring?: boolean;
  keyringRuntimeRestoreError?: string | null;
  keyrings?: DisplayedKeyringLike[];
};

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

function formatRuntimeState(snapshot: KeyringRuntimeConvergenceSnapshot) {
  const ready =
    snapshot.runtimeReady === null
      ? '?'
      : snapshot.runtimeReady
      ? 'ready'
      : 'not ready';
  const restoring = snapshot.runtimeRestoring ? 'restoring' : '';
  const count =
    typeof snapshot.keyringCount === 'number'
      ? `${snapshot.keyringCount} kr`
      : '';

  return [ready, restoring, count].filter(Boolean).join(' · ') || '-';
}

function formatPerf(snapshot: KeyringRuntimeConvergenceSnapshot) {
  if (!snapshot.lastPerfEvent) {
    return '-';
  }

  const elapsed =
    snapshot.lastPerfElapsedMs > 0
      ? ` · ${formatMs(snapshot.lastPerfElapsedMs)}`
      : '';

  return `${snapshot.lastPerfEvent}${elapsed}`;
}

function formatShortAddress(address?: string) {
  if (!address) {
    return '-';
  }

  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatKeyringAccountLine(account: {
  address?: string;
  type?: string;
  brandName?: string;
}) {
  const type = account.type || '-';
  const brandName = account.brandName || '-';

  return `${formatShortAddress(account.address)} · ${type} · ${brandName}`;
}

function getKeyringAccountSnapshot(state: KeyringRuntimeMemStoreState) {
  const keyrings = Array.isArray(state.keyrings) ? state.keyrings : [];
  const accounts = keyrings.flatMap(keyring =>
    Array.isArray(keyring.accounts)
      ? keyring.accounts.map(account => ({
          address: account.address,
          type: account.type || keyring.type || '',
          brandName: account.brandName || keyring.type || '',
        }))
      : [],
  );

  return {
    keyrings,
    accounts,
  };
}

function syncKeyringRuntimeMemStoreMutables(
  state: KeyringRuntimeMemStoreState,
) {
  const { keyrings, accounts } = getKeyringAccountSnapshot(state);
  const isUnlocked = !!state.isUnlocked;
  const runtimeReady = !!state.keyringRuntimeReady;
  const runtimeRestoring = !!state.keyringRuntimeRestoring;
  const runtimeError = state.keyringRuntimeRestoreError;

  keyringRuntimeMetricUnlock.value = isUnlocked ? 'unlocked' : 'locked';
  keyringRuntimeMetricRuntime.value = [
    runtimeReady ? 'ready' : 'not ready',
    runtimeRestoring ? 'restoring' : '',
    runtimeError ? 'error' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  keyringRuntimeMetricKeyrings.value = `${keyrings.length} kr · ${accounts.length} acct`;

  keyringRuntimeAccountLines.forEach((line, index) => {
    if (index === MAX_ACCOUNT_ROWS - 1 && accounts.length > MAX_ACCOUNT_ROWS) {
      line.value = `+${accounts.length - index} more accounts`;
      return;
    }

    line.value = accounts[index]
      ? formatKeyringAccountLine(accounts[index])
      : index === 0
      ? isUnlocked && runtimeReady
        ? 'No runtime account'
        : 'Runtime accounts not restored yet'
      : '';
  });
}

function formatRecordLine(record: KeyringRuntimeConvergenceRecord) {
  const generation =
    typeof record.generation === 'number' ? `#${record.generation}` : '#-';
  const elapsed =
    typeof record.elapsedMs === 'number' && record.elapsedMs > 0
      ? ` · ${formatMs(record.elapsedMs)}`
      : '';
  const error = record.error ? ` · ${record.error}` : '';
  const reason = record.reason ? ` · ${record.reason}` : '';

  return `${formatAge(record.timestamp)} ago · ${generation} · ${
    record.status
  } · ${record.event}${reason}${elapsed}${error}`;
}

function syncKeyringRuntimeMutableSnapshot(
  snapshot: KeyringRuntimeConvergenceSnapshot,
) {
  const active = snapshot.status === 'waiting' || snapshot.status === 'running';
  const hasError = snapshot.status === 'error';

  keyringRuntimeTone.value = hasError ? 2 : active ? 1 : 0;
  keyringRuntimeHandleLabel.value = hasError ? 'KR!' : active ? 'KR*' : 'KR';

  if (!snapshot.event) {
    keyringRuntimeTitle.value = 'Keyring runtime';
    keyringRuntimeAge.value = '';
    keyringRuntimeMetricStatus.value = 'idle';
    keyringRuntimeMetricWait.value = '-';
    keyringRuntimeMetricRun.value = '-';
    keyringRuntimeMetricPerf.value = '-';
    keyringRuntimeRecordLines.forEach((line, index) => {
      line.value = index === 0 ? 'No keyring convergence event yet' : '';
    });
    return;
  }

  keyringRuntimeTitle.value = snapshot.event;
  keyringRuntimeAge.value = `${formatAge(snapshot.updatedAt)} ago`;
  keyringRuntimeMetricStatus.value = snapshot.status;
  keyringRuntimeMetricRuntime.value = formatRuntimeState(snapshot);
  keyringRuntimeMetricWait.value = formatMs(snapshot.waitMs);
  keyringRuntimeMetricRun.value = formatMs(snapshot.elapsedMs);
  keyringRuntimeMetricPerf.value = formatPerf(snapshot);

  const records = snapshot.records.slice(0, MAX_RECORD_ROWS);
  keyringRuntimeRecordLines.forEach((line, index) => {
    line.value = records[index]
      ? formatRecordLine(records[index])
      : index === 0
      ? 'No keyring convergence event yet'
      : '';
  });
}

function useSyncKeyringRuntimeMutables() {
  React.useEffect(() => {
    syncKeyringRuntimeMutableSnapshot(getKeyringRuntimeConvergenceSnapshot());

    return subscribeKeyringRuntimeConvergenceSnapshot(() => {
      syncKeyringRuntimeMutableSnapshot(getKeyringRuntimeConvergenceSnapshot());
    });
  }, []);
}

function useSyncKeyringRuntimeMemStoreMutables() {
  React.useEffect(() => {
    const sync = (state: KeyringRuntimeMemStoreState) => {
      syncKeyringRuntimeMemStoreMutables(state);
    };

    sync(keyringService.memStore.getState());
    keyringService.memStore.subscribe(sync);

    return () => {
      keyringService.memStore.unsubscribe(sync);
    };
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

function MutableRecordLine({ value }: { value: SharedValue<string> }) {
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
        style={styles.recordText}
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
          value={keyringRuntimeTitle}
        />
        <MutableSummaryText
          numberOfLines={1}
          style={styles.muted}
          value={keyringRuntimeAge}
        />
      </View>
      <View style={styles.metricsGrid}>
        <SummaryMetric label="status" value={keyringRuntimeMetricStatus} />
        <SummaryMetric label="unlock" value={keyringRuntimeMetricUnlock} />
        <SummaryMetric label="runtime" value={keyringRuntimeMetricRuntime} />
        <SummaryMetric label="keyrings" value={keyringRuntimeMetricKeyrings} />
        <SummaryMetric label="wait" value={keyringRuntimeMetricWait} />
        <SummaryMetric label="run" value={keyringRuntimeMetricRun} />
      </View>
      <View style={styles.accountList}>
        {keyringRuntimeAccountLines.map((line, index) => (
          <MutableRecordLine key={index} value={line} />
        ))}
      </View>
      <SummaryMetric label="last perf" value={keyringRuntimeMetricPerf} />
      <View style={styles.recordList}>
        {keyringRuntimeRecordLines.map((line, index) => (
          <MutableRecordLine key={index} value={line} />
        ))}
      </View>
    </>
  );
}

export function FloatingKeyringRuntimePanel() {
  const { showKeyringRuntimePanel } = useToggleShowKeyringRuntimePanel();
  const [collapsed, setCollapsed] = React.useState(true);
  useSyncKeyringRuntimeMutables();
  useSyncKeyringRuntimeMemStoreMutables();

  const dockSide = useSharedValue(SIDE_RIGHT);
  const isDragging = useSharedValue(0);
  const handleTop = useSharedValue(240);
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
    const tone = keyringRuntimeTone.value;

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
    !showKeyringRuntimePanel ||
    !keyringRuntimeDiagnosticsEnabled
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
              value={keyringRuntimeHandleLabel}
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
  recordList: {
    marginTop: 6,
    rowGap: 3,
  },
  accountList: {
    marginTop: 8,
    rowGap: 3,
  },
  recordText: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 10,
    lineHeight: 13,
  },
});
