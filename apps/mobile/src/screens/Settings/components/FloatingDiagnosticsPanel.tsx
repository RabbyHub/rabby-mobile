import React from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  makeMutable,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useAutoLockCountDown } from './LockAbout';
import { colord } from 'colord';
import { NEED_DEVSETTINGBLOCKS } from '@/constant';
import { useFloatingView } from '@/hooks/appSettings';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { RcIconLogo } from '@/assets/icons/common';
import { Text, AnimateableText } from '@/components/Typography';
import {
  getModalGateDebugSnapshot,
  subscribeModalGateDebugSnapshot,
} from '@/utils/modalGate';
import type { ModalGateDebugSnapshot } from '@/utils/modalGate';

const modalDebugCount = makeMutable(0);
const modalDebugSummary = makeMutable('No blocking modals');
const modalDebugDetails = makeMutable('none');

const screenLayout = Dimensions.get('window');

const HANDLE_SIZE = 60;
const PANEL_WIDTH = 320;
const PANEL_BODY_WIDTH = PANEL_WIDTH - HANDLE_SIZE;
const PANEL_HEIGHT_MODAL_ONLY = 132;
const PANEL_HEIGHT_FULL = 156;
const VERTICAL_EDGE_PADDING = 40;
const HORIZONTAL_EDGE_PADDING = 0;
const SIDE_LEFT = 0;
const SIDE_RIGHT = 1;

function syncModalDebugSnapshot(snapshot: ModalGateDebugSnapshot) {
  const visibleBlockingModalCount = snapshot.visibleBlockingModalCount;
  const visibleBlockingModalIds = snapshot.visibleBlockingModalIds;

  modalDebugCount.value = visibleBlockingModalCount;
  modalDebugSummary.value = visibleBlockingModalCount
    ? `${visibleBlockingModalCount} blocking modal${
        visibleBlockingModalCount > 1 ? 's' : ''
      }`
    : 'No blocking modals';
  modalDebugDetails.value = visibleBlockingModalIds.length
    ? visibleBlockingModalIds.join('\n')
    : 'none';
}

function clamp(val: number, min: number, max: number) {
  'worklet';

  return Math.min(Math.max(val, min), max);
}

function getMinHandleTop() {
  'worklet';

  return VERTICAL_EDGE_PADDING;
}

function getMaxHandleTop() {
  'worklet';

  return screenLayout.height - VERTICAL_EDGE_PADDING - HANDLE_SIZE;
}

function getHandleOffsetY(handleTop: number, panelHeight: number) {
  'worklet';

  if (panelHeight <= HANDLE_SIZE) {
    return 0;
  }

  const min = getMinHandleTop();
  const max = getMaxHandleTop();
  const ratio =
    max === min ? 0 : (clamp(handleTop, min, max) - min) / (max - min);

  return ratio * (panelHeight - HANDLE_SIZE);
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

function getDockSideByHandleLeft(handleLeft: number) {
  'worklet';

  return handleLeft + HANDLE_SIZE / 2 < screenLayout.width / 2
    ? SIDE_LEFT
    : SIDE_RIGHT;
}

function getPanelHeight(options: { showAutoLockCountdown: boolean }) {
  if (options.showAutoLockCountdown) {
    return PANEL_HEIGHT_FULL;
  }

  return PANEL_HEIGHT_MODAL_ONLY;
}

export function FloatingDiagnosticsPanel() {
  const { styles } = useThemeStyles(getFloatingDiagnosticsPanelStyles);
  const { devNeedCountdown, countdownTextStyles, countdownTextProps } =
    useAutoLockCountDown();
  const {
    collapsed,
    toggleCollapsed,
    shouldShow: shouldShowFloatingView,
    showAutoLockCountdown,
  } = useFloatingView();

  const dockSide = useSharedValue(SIDE_RIGHT);
  const isDragging = useSharedValue(0);
  const handleTop = useSharedValue(120);
  const dragHandleLeft = useSharedValue(getCollapsedHandleLeft(dockSide.value));
  const dragHandleTop = useSharedValue(handleTop.value);
  const dragStartLeft = useSharedValue(dragHandleLeft.value);
  const dragStartTop = useSharedValue(handleTop.value);

  const shouldShow = shouldShowFloatingView;
  const panelHeight = React.useMemo(() => {
    if (collapsed) {
      return HANDLE_SIZE;
    }

    return getPanelHeight({
      showAutoLockCountdown,
    });
  }, [collapsed, showAutoLockCountdown]);

  const handleToggleCollapsed = React.useCallback(() => {
    toggleCollapsed();
  }, [toggleCollapsed]);

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
      handleTop.value - getHandleOffsetY(handleTop.value, panelHeight),
      getMinHandleTop(),
      screenLayout.height - VERTICAL_EDGE_PADDING - panelHeight,
    );

    return {
      left: getExpandedPanelLeft(dockSide.value),
      top: nextPanelTop,
      width: PANEL_WIDTH,
      height: panelHeight,
    };
  }, [collapsed, panelHeight]);

  const handleAnimatedStyles = useAnimatedStyle(() => {
    if (isDragging.value || collapsed) {
      return {
        left: 0,
        top: 0,
      };
    }

    return {
      left: getExpandedHandleLeft(dockSide.value),
      top: getHandleOffsetY(handleTop.value, panelHeight),
    };
  }, [collapsed, panelHeight]);

  const panelBodyAnimatedStyles = useAnimatedStyle(() => {
    const hidden = collapsed || !!isDragging.value;

    return {
      opacity: hidden ? 0 : 1,
      width: hidden ? 0 : PANEL_BODY_WIDTH,
      left: dockSide.value === SIDE_LEFT ? 0 : HANDLE_SIZE,
    };
  }, [collapsed]);

  const modalSummaryTextProps = useAnimatedProps(() => {
    return {
      text: modalDebugSummary.value,
    };
  });

  const modalSummaryTextStyles = useAnimatedStyle(() => {
    return {
      color: modalDebugCount.value
        ? '#FFB648'
        : colord('#ffffff').alpha(0.74).toRgbString(),
    };
  });

  const modalDetailTextProps = useAnimatedProps(() => {
    return {
      text: modalDebugDetails.value,
    };
  });

  const modalBadgeWrapStyles = useAnimatedStyle(() => {
    return {
      opacity: modalDebugCount.value > 0 ? 1 : 0,
      transform: [{ scale: modalDebugCount.value > 0 ? 1 : 0.8 }],
    };
  });

  const modalBadgeTextProps = useAnimatedProps(() => {
    return {
      text: `${modalDebugCount.value}`,
    };
  });

  const handleChromeAnimatedStyles = useAnimatedStyle(() => {
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

  const badgePositionAnimatedStyles = useAnimatedStyle(() => {
    const activeSide = isDragging.value
      ? getDockSideByHandleLeft(dragHandleLeft.value)
      : dockSide.value;

    return activeSide === SIDE_LEFT
      ? {
          left: undefined,
          right: 4,
        }
      : {
          left: 4,
          right: undefined,
        };
  });

  const panelChromeAnimatedStyles = useAnimatedStyle(() => {
    const activeSide = dockSide.value;

    return {
      borderColor: modalDebugCount.value
        ? 'rgba(255, 182, 72, 0.28)'
        : 'transparent',
      borderTopLeftRadius: activeSide === SIDE_LEFT ? 12 : 0,
      borderBottomLeftRadius: activeSide === SIDE_LEFT ? 12 : 0,
      borderTopRightRadius: activeSide === SIDE_RIGHT ? 12 : 0,
      borderBottomRightRadius: activeSide === SIDE_RIGHT ? 12 : 0,
    };
  });

  const composedGesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((_event, success) => {
        if (!success) {
          return;
        }

        runOnJS(handleToggleCollapsed)();
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
        dockSide.value =
          dragHandleLeft.value + HANDLE_SIZE / 2 < screenLayout.width / 2
            ? SIDE_LEFT
            : SIDE_RIGHT;
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
    handleToggleCollapsed,
    handleTop,
    isDragging,
  ]);

  React.useEffect(() => {
    syncModalDebugSnapshot(getModalGateDebugSnapshot());

    const unsubscribe = subscribeModalGateDebugSnapshot(snapshot => {
      syncModalDebugSnapshot(snapshot);
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const minTop = getMinHandleTop();
    const maxTop = getMaxHandleTop();

    handleTop.value = Math.min(Math.max(handleTop.value, minTop), maxTop);
  }, [handleTop]);

  if (!NEED_DEVSETTINGBLOCKS) {
    return null;
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <GestureHandlerRootView pointerEvents="box-none" style={styles.portal}>
      <Animated.View style={[styles.container, rootAnimatedStyles]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.panelBody,
            panelBodyAnimatedStyles,
            panelChromeAnimatedStyles,
          ]}>
          {showAutoLockCountdown && (
            <View style={styles.row}>
              <Text style={styles.label}>
                {devNeedCountdown ? 'Auto Lock after' : 'Auto Lock'}
              </Text>
              <AnimateableText
                animatedProps={countdownTextProps}
                style={countdownTextStyles}
              />
            </View>
          )}

          <View
            style={[
              styles.panelBlock,
              showAutoLockCountdown && styles.panelBlockGap,
            ]}>
            <View style={styles.row}>
              <Text style={styles.label}>Blocking Modals</Text>
              <AnimateableText
                animatedProps={modalSummaryTextProps}
                style={[styles.summaryText, modalSummaryTextStyles]}
              />
            </View>
            <AnimateableText
              animatedProps={modalDetailTextProps}
              style={styles.detailText}
            />
          </View>
        </Animated.View>

        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              styles.handle,
              handleAnimatedStyles,
              handleChromeAnimatedStyles,
            ]}>
            <RcIconLogo width={48} height={48} />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.badge,
                modalBadgeWrapStyles,
                badgePositionAnimatedStyles,
              ]}>
              <AnimateableText
                animatedProps={modalBadgeTextProps}
                style={styles.badgeText}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const getFloatingDiagnosticsPanelStyles = createGetStyles(colors => {
  return {
    portal: {
      position: 'absolute',
      inset: 0,
      zIndex: 999,
    },
    container: {
      position: 'absolute',
      backgroundColor: 'transparent',
    },
    handle: {
      position: 'absolute',
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      borderRadius: HANDLE_SIZE / 2,
      opacity: 0.94,
      backgroundColor: colors['blue-default'],
      justifyContent: 'center',
      alignItems: 'center',
    },
    panelBody: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: colord('#000000').alpha(0.56).toRgbString(),
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
      overflow: 'hidden',
    },
    label: {
      color: colord('#ffffff').alpha(0.82).toRgbString(),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    row: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    panelBlock: {
      width: '100%',
    },
    panelBlockGap: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colord('#ffffff').alpha(0.12).toRgbString(),
    },
    summaryText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    detailText: {
      marginTop: 6,
      color: colord('#ffffff').alpha(0.72).toRgbString(),
      fontSize: 12,
      lineHeight: 16,
    },
    badge: {
      position: 'absolute',
      top: 6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: '#FFB648',
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: '#111827',
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
    },
  };
});
