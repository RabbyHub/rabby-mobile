import { useTheme2024 } from '@/hooks/theme';
import {
  getPerpsProFontStyle,
  PERPS_PRO_FONT_FAMILY,
} from '@/screens/PerpsPro/components/common/perpsProVisual';
import {
  getPerpsProTabIndicatorFrame,
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '@/screens/PerpsPro/components/common/PerpsProTabIndicator';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  Text as NativeText,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { PerpsProHistoryTab } from '../types';

const TABS: PerpsProHistoryTab[] = [
  'orders',
  'trade',
  'transaction',
  'funding',
];
const TAB_HORIZONTAL_PADDING = 16;
const STRIP_POSITION_EPSILON = 0.001;
const STRIP_OFFSET_EPSILON = 0.5;
type PerpsProHistoryTabFrames = Partial<
  Record<PerpsProHistoryTab, LayoutRectangle>
>;

const HISTORY_TAB_MEDIUM_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '500');
const HISTORY_TAB_BOLD_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '700');

export const updatePerpsProHistoryTabFrame = (
  tab: PerpsProHistoryTab,
  event: LayoutChangeEvent,
  setTabFrames: React.Dispatch<React.SetStateAction<PerpsProHistoryTabFrames>>,
) => {
  const { x, y, width, height } = event.nativeEvent.layout;
  const frame: LayoutRectangle = { x, y, width, height };

  setTabFrames(previous => {
    const current = previous[tab];
    if (
      current?.x === x &&
      current.y === y &&
      current.width === width &&
      current.height === height
    ) {
      return previous;
    }
    return {
      ...previous,
      [tab]: frame,
    };
  });
};

const getCenteredStripOffset = ({
  contentWidth,
  layouts,
  position,
  viewportWidth,
}: {
  contentWidth: number;
  layouts: readonly PerpsProTabIndicatorLayout[];
  position: number;
  viewportWidth: number;
}) => {
  'worklet';
  if (layouts.length === 0 || viewportWidth <= 0) {
    return 0;
  }
  const frame = getPerpsProTabIndicatorFrame(position, layouts);
  const maximumOffset = Math.max(0, contentWidth - viewportWidth);
  const centeredOffset =
    TAB_HORIZONTAL_PADDING + frame.x + frame.width / 2 - viewportWidth / 2;
  return Math.max(0, Math.min(maximumOffset, centeredOffset));
};

export const getPerpsProHistoryStripOffset = ({
  contentWidth,
  layouts,
  position,
  startOffset,
  startPosition,
  targetPosition,
  viewportWidth,
}: {
  contentWidth: number;
  layouts: readonly PerpsProTabIndicatorLayout[];
  position: number;
  startOffset: number;
  startPosition: number;
  targetPosition: number;
  viewportWidth: number;
}) => {
  'worklet';
  const naturalStart = getCenteredStripOffset({
    contentWidth,
    layouts,
    position: startPosition,
    viewportWidth,
  });
  const naturalCurrent = getCenteredStripOffset({
    contentWidth,
    layouts,
    position,
    viewportWidth,
  });
  const transitionDistance = Math.abs(targetPosition - startPosition);
  const progress =
    transitionDistance <= STRIP_POSITION_EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(1, Math.abs(position - startPosition) / transitionDistance),
        );

  // Preserve the user's real strip offset at the start of a generation, then
  // continuously converge to the naturally centered destination. A cancelled
  // pager gesture returns to the exact captured offset without a second jump.
  const offset = naturalCurrent + (startOffset - naturalStart) * (1 - progress);
  return Math.max(
    0,
    Math.min(Math.max(0, contentWidth - viewportWidth), offset),
  );
};

const PerpsProHistoryTabLabel: React.FC<{
  activeColor: string;
  inactiveColor: string;
  index: number;
  label: string;
  position: SharedValue<number>;
  style: StyleProp<TextStyle>;
}> = ({ activeColor, inactiveColor, index, label, position, style }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const maximumIndex = TABS.length - 1;
    const rawPosition = Number.isFinite(position.value) ? position.value : 0;
    const visualIndex = Math.round(
      Math.max(0, Math.min(maximumIndex, rawPosition)),
    );
    const active = visualIndex === index;
    return {
      color: active ? activeColor : inactiveColor,
      fontFamily: active
        ? HISTORY_TAB_BOLD_FONT_STYLE.fontFamily
        : HISTORY_TAB_MEDIUM_FONT_STYLE.fontFamily,
      fontWeight: active
        ? HISTORY_TAB_BOLD_FONT_STYLE.fontWeight
        : HISTORY_TAB_MEDIUM_FONT_STYLE.fontWeight,
    };
  }, [activeColor, inactiveColor, index, position]);

  return (
    <View style={labelStyles.container}>
      <NativeText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        numberOfLines={1}
        style={[style, labelStyles.measureText]}>
        {label}
      </NativeText>
      <Animated.Text
        numberOfLines={1}
        style={[style, labelStyles.visibleText, animatedStyle]}
        testID={`perps-pro-history-tab-label-${TABS[index]}`}>
        {label}
      </Animated.Text>
    </View>
  );
};

const labelStyles = {
  container: {
    position: 'relative' as const,
  },
  measureText: {
    ...HISTORY_TAB_BOLD_FONT_STYLE,
    opacity: 0,
  },
  visibleText: {
    left: 0,
    position: 'absolute' as const,
    right: 0,
    textAlign: 'center' as const,
    top: 0,
  },
};

export const PerpsProHistoryTabs: React.FC<{
  activeTab: PerpsProHistoryTab;
  onChange: (tab: PerpsProHistoryTab) => void;
  position: SharedValue<number>;
  transitionActive: SharedValue<boolean>;
  transitionAnimated: SharedValue<boolean>;
  transitionEpoch: SharedValue<number>;
  transitionStartPosition: SharedValue<number>;
  transitionTargetPosition: SharedValue<number>;
}> = React.memo(
  ({
    activeTab,
    onChange,
    position,
    transitionActive,
    transitionAnimated,
    transitionEpoch,
    transitionStartPosition,
    transitionTargetPosition,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const scrollRef =
      useAnimatedRef<React.ElementRef<typeof Animated.ScrollView>>();
    const [tabFrames, setTabFrames] = useState<PerpsProHistoryTabFrames>({});
    const [viewportWidth, setViewportWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const actualStripOffset = useSharedValue(0);
    const manualOverrideEpoch = useSharedValue(-1);
    const anchorEpoch = useSharedValue(-1);
    const anchorGeometryVersion = useSharedValue('');
    const anchorOffset = useSharedValue(0);
    const anchorPosition = useSharedValue(0);

    const indicatorLayouts = useMemo(() => {
      const layouts: PerpsProTabIndicatorLayout[] = [];
      for (const tab of TABS) {
        const frame = tabFrames[tab];
        if (!frame || frame.width <= 0) {
          return [];
        }
        layouts.push({ width: frame.width, x: frame.x });
      }
      return layouts;
    }, [tabFrames]);
    const geometryVersion = useMemo(
      () =>
        [
          viewportWidth,
          contentWidth,
          ...indicatorLayouts.flatMap(frame => [frame.x, frame.width]),
        ].join(':'),
      [contentWidth, indicatorLayouts, viewportWidth],
    );

    const handleScroll = useAnimatedScrollHandler({
      onBeginDrag: event => {
        actualStripOffset.value = event.contentOffset.x;
        manualOverrideEpoch.value = transitionEpoch.value;
      },
      onScroll: event => {
        actualStripOffset.value = event.contentOffset.x;
      },
    });

    useAnimatedReaction(
      () => ({
        active: transitionActive.value,
        animated: transitionAnimated.value,
        epoch: transitionEpoch.value,
        geometryVersion,
        position: position.value,
        startPosition: transitionStartPosition.value,
        targetPosition: transitionTargetPosition.value,
      }),
      current => {
        if (
          indicatorLayouts.length !== TABS.length ||
          viewportWidth <= 0 ||
          contentWidth <= 0
        ) {
          return;
        }

        const isFirstLayout = anchorEpoch.value < 0;
        const generationChanged = anchorEpoch.value !== current.epoch;
        const geometryChanged =
          anchorGeometryVersion.value !== current.geometryVersion;
        if (isFirstLayout || generationChanged || geometryChanged) {
          anchorEpoch.value = current.epoch;
          anchorGeometryVersion.value = current.geometryVersion;
          anchorOffset.value = actualStripOffset.value;
          const logicalStartDiffersFromCurrent =
            Math.abs(current.position - current.startPosition) >
            STRIP_POSITION_EPSILON;
          anchorPosition.value =
            (geometryChanged && !generationChanged) ||
            (generationChanged && logicalStartDiffersFromCurrent)
              ? current.position
              : current.startPosition;

          if (manualOverrideEpoch.value === current.epoch) {
            return;
          }
          if (isFirstLayout || !current.active || !current.animated) {
            const target = getCenteredStripOffset({
              contentWidth,
              layouts: indicatorLayouts,
              position: current.active
                ? current.animated
                  ? current.position
                  : current.targetPosition
                : current.position,
              viewportWidth,
            });
            if (
              Math.abs(target - actualStripOffset.value) > STRIP_OFFSET_EPSILON
            ) {
              scrollTo(scrollRef, target, 0, false);
              actualStripOffset.value = target;
            }
          }
          return;
        }

        if (manualOverrideEpoch.value === current.epoch) {
          return;
        }
        const target = current.animated
          ? getPerpsProHistoryStripOffset({
              contentWidth,
              layouts: indicatorLayouts,
              position: current.position,
              startOffset: anchorOffset.value,
              startPosition: anchorPosition.value,
              targetPosition: current.targetPosition,
              viewportWidth,
            })
          : getCenteredStripOffset({
              contentWidth,
              layouts: indicatorLayouts,
              position: current.active
                ? current.targetPosition
                : current.position,
              viewportWidth,
            });
        if (Math.abs(target - actualStripOffset.value) > STRIP_OFFSET_EPSILON) {
          scrollTo(scrollRef, target, 0, false);
          actualStripOffset.value = target;
        }
      },
      [
        contentWidth,
        geometryVersion,
        indicatorLayouts,
        scrollRef,
        transitionActive,
        viewportWidth,
      ],
    );

    return (
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        horizontal
        onContentSizeChange={width => setContentWidth(width)}
        onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={handleScroll}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        testID="perps-pro-history-tabs-scroll">
        <View accessibilityRole="tablist" style={styles.tabs}>
          <PerpsProTabIndicator
            layouts={indicatorLayouts}
            position={position}
            style={styles.indicator}
            testID="perps-pro-history-tab-indicator"
          />
          {TABS.map((tab, index) => {
            const selected = activeTab === tab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab}
                onLayout={event =>
                  updatePerpsProHistoryTabFrame(tab, event, setTabFrames)
                }
                onPress={() => onChange(tab)}
                style={styles.tab}
                testID={`perps-pro-history-tab-${tab}`}>
                {indicatorLayouts.length !== TABS.length && selected ? (
                  <View
                    pointerEvents="none"
                    style={styles.fallbackIndicator}
                    testID="perps-pro-history-tab-indicator-fallback"
                  />
                ) : null}
                <PerpsProHistoryTabLabel
                  activeColor={colors2024['neutral-contrast']}
                  inactiveColor={colors2024['neutral-secondary']}
                  index={index}
                  label={t(`page.perps.pro.history.tabs.${tab}`)}
                  position={position}
                  style={styles.text}
                />
              </Pressable>
            );
          })}
        </View>
      </Animated.ScrollView>
    );
  },
);

PerpsProHistoryTabs.displayName = 'PerpsProHistoryTabs';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  scroll: {
    flexGrow: 0,
  },
  content: {
    minWidth: '100%',
    paddingHorizontal: TAB_HORIZONTAL_PADDING,
  },
  tabs: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 32,
    position: 'relative',
  },
  tab: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  indicator: {
    backgroundColor: isLight
      ? '#131416'
      : colors2024['neutral-InvertHighlight'],
    borderRadius: 8,
    height: 30,
    top: 1,
    zIndex: 0,
  },
  fallbackIndicator: {
    backgroundColor: isLight
      ? '#131416'
      : colors2024['neutral-InvertHighlight'],
    borderRadius: 8,
    bottom: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 1,
  },
}));
