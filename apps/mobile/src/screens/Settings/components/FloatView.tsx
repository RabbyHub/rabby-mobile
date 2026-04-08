import React from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  makeMutable,
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
  useModalGateDiagnosticsEnabled,
} from '@/utils/modalGate';
import type { ModalGateDebugSnapshot } from '@/utils/modalGate';

const modalDebugCount = makeMutable(0);
const modalDebugSummary = makeMutable('No blocking modals');
const modalDebugDetails = makeMutable('none');

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
  return Math.min(Math.max(val, min), max);
}
const VIEW_W = 320;
const DRAGGER_SIZE = 60;
const PANEL_W = VIEW_W - DRAGGER_SIZE;
const INIT_RIGHT = VIEW_W - DRAGGER_SIZE;
const INIT_LAYOUT = {
  top: 100,
};
const screenLayout = Dimensions.get('screen');
export function FloatViewAutoLockCount() {
  const { styles } = useThemeStyles(getFloatViewAutoLockCountStyles);
  const { devNeedCountdown, countdownTextStyles, countdownTextProps } =
    useAutoLockCountDown();
  const {
    collapsed,
    toggleCollapsed,
    shouldShow: shouldShowFloatingView,
    showAutoLockCountdown,
  } = useFloatingView();
  const modalDiagnosticsEnabled = useModalGateDiagnosticsEnabled();

  const [translationX, translationY, prevTranslationX, prevTranslationY] = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translationY.value }],
    };
  });

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
      opacity: modalDiagnosticsEnabled && modalDebugCount.value > 0 ? 1 : 0,
      transform: [{ scale: modalDebugCount.value > 0 ? 1 : 0.8 }],
    };
  });

  const modalBadgeTextProps = useAnimatedProps(() => {
    return {
      text: `${modalDebugCount.value}`,
    };
  });

  const panelAccentStyles = useAnimatedStyle(() => {
    return {
      borderColor: modalDebugCount.value
        ? 'rgba(255, 182, 72, 0.28)'
        : 'transparent',
    };
  });

  const composedGesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        toggleCollapsed();
      });

    const pan = Gesture.Pan()
      .minDistance(5)
      .enabled(true)
      .runOnJS(true)
      .onStart(() => {
        prevTranslationX.value = translationX.value;
        prevTranslationY.value = translationY.value;
      })
      .onUpdate(event => {
        try {
          const maxTranslateX = screenLayout.width / 2 - 50;
          const maxTranslateY = screenLayout.height / 2 - 50;

          translationX.value = clamp(
            prevTranslationX.value + event.translationX,
            -maxTranslateX,
            maxTranslateX,
          );
          translationY.value = clamp(
            prevTranslationY.value + event.translationY,
            -maxTranslateY,
            maxTranslateY,
          );
        } catch (err: any) {
          console.error('onUpdate error', err?.message);
        }
      });

    const composed = Gesture.Race(...[pan, tap]);
    return composed;
  }, [
    toggleCollapsed,
    translationX,
    translationY,
    prevTranslationX,
    prevTranslationY,
  ]);

  React.useEffect(() => {
    if (!modalDiagnosticsEnabled) {
      syncModalDebugSnapshot({
        visibleBlockingModalCount: 0,
        visibleBlockingModalIds: [],
      });
      return;
    }

    syncModalDebugSnapshot(getModalGateDebugSnapshot());

    const unsubscribe = subscribeModalGateDebugSnapshot(snapshot => {
      syncModalDebugSnapshot(snapshot);
    });

    return unsubscribe;
  }, [modalDiagnosticsEnabled]);

  const shouldShow = shouldShowFloatingView || modalDiagnosticsEnabled;
  const panelHeight = React.useMemo(() => {
    if (collapsed) {
      return DRAGGER_SIZE;
    }

    if (showAutoLockCountdown && modalDiagnosticsEnabled) {
      return 156;
    }

    if (modalDiagnosticsEnabled) {
      return 132;
    }

    return DRAGGER_SIZE;
  }, [collapsed, modalDiagnosticsEnabled, showAutoLockCountdown]);

  if (!NEED_DEVSETTINGBLOCKS) return null;
  if (!shouldShow) return null;

  return (
    <GestureHandlerRootView
      style={[
        styles.gestureContainer,
        !collapsed && styles.containerExpanded,
        { height: panelHeight },
      ]}>
      <Animated.View
        style={[styles.container, animatedStyles, panelAccentStyles]}>
        <GestureDetector gesture={composedGesture}>
          <View style={styles.dragger}>
            <RcIconLogo width={48} height={48} />
            <Animated.View
              pointerEvents="none"
              style={[styles.badge, modalBadgeWrapStyles]}>
              <AnimateableText
                animatedProps={modalBadgeTextProps}
                style={styles.badgeText}
              />
            </Animated.View>
          </View>
        </GestureDetector>
        {!collapsed && (
          <View pointerEvents="none" style={styles.animatedView}>
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

            {modalDiagnosticsEnabled && (
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
            )}
          </View>
        )}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const getFloatViewAutoLockCountStyles = createGetStyles(colors => {
  return {
    gestureContainer: {
      flex: 1,
      position: 'absolute',
      // ...makeDebugBorder(),
      zIndex: 999,
      width: VIEW_W,
      top: INIT_LAYOUT.top,
      height: 60,
      right: -INIT_RIGHT,
    },
    container: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 6,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      overflow: 'hidden',
    },
    dragger: {
      borderTopLeftRadius: 60,
      borderBottomLeftRadius: 60,
      height: 60,
      width: 60,
      flexShrink: 0,
      opacity: 0.9,
      backgroundColor: colors['blue-default'],
      // ...makeDebugBorder('yellow'),
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    containerExpanded: {
      right: 0,
    },
    animatedView: {
      backgroundColor: colord('#000000').alpha(0.5).toRgbString(),
      flexShrink: 1,
      width: PANEL_W,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    label: {
      color: colord('#ffffff').alpha(0.8).toRgbString(),
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
      right: 4,
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
