import { useTheme2024 } from '@/hooks/theme';
import {
  getPerpsProFontStyle,
  PERPS_PRO_FONT_FAMILY,
} from '@/screens/PerpsPro/components/common/perpsProVisual';
import {
  getPerpsProTabIndicatorFrame,
  type PerpsProTabIndicatorLayout,
} from '@/screens/PerpsPro/components/common/PerpsProTabIndicator';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, type PathProps } from 'react-native-svg';

import type { PerpsProHistoryTab } from '../types';

const TABS: PerpsProHistoryTab[] = [
  'orders',
  'trade',
  'transaction',
  'funding',
];
const TAB_HORIZONTAL_PADDING = 16;
const TAB_INDICATOR_HEIGHT = 30;
const TAB_INDICATOR_RADIUS = 8;
const TAB_INDICATOR_TOP = 1;
const STRIP_MOMENTUM_VELOCITY_EPSILON = 0.01;
const STRIP_MOMENTUM_OFFSET_EPSILON = 0.5;
type PerpsProHistoryTabFrames = Partial<
  Record<PerpsProHistoryTab, LayoutRectangle>
>;
type PerpsProHistoryAnimatedScrollProps = Pick<
  ScrollViewProps,
  'contentOffset'
>;

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

const clampPerpsProHistoryStripOffset = (
  offset: number,
  maximumOffset: number,
) => {
  'worklet';
  return Math.max(0, Math.min(maximumOffset, offset));
};

const getCenteredPerpsProHistoryTabOffset = ({
  contentWidth,
  frame,
  viewportWidth,
}: {
  contentWidth: number;
  frame: PerpsProTabIndicatorLayout;
  viewportWidth: number;
}) => {
  if (contentWidth <= 0 || frame.width <= 0 || viewportWidth <= 0) {
    return null;
  }
  const maximumOffset = Math.max(0, contentWidth - viewportWidth);
  const centeredOffset =
    TAB_HORIZONTAL_PADDING + frame.x + frame.width / 2 - viewportWidth / 2;
  return clampPerpsProHistoryStripOffset(centeredOffset, maximumOffset);
};

export const getPerpsProHistoryTabStripAnchors = ({
  contentWidth,
  layouts,
  viewportWidth,
}: {
  contentWidth: number;
  layouts: readonly PerpsProTabIndicatorLayout[];
  viewportWidth: number;
}) => {
  if (
    layouts.length === 0 ||
    layouts.some(layout => layout.width <= 0) ||
    contentWidth <= 0 ||
    viewportWidth <= 0
  ) {
    return [];
  }

  const maximumOffset = Math.max(0, contentWidth - viewportWidth);
  const anchors: number[] = [];

  for (let index = 0; index < layouts.length; index += 1) {
    const frame = layouts[index]!;
    const centeredOffset = getCenteredPerpsProHistoryTabOffset({
      contentWidth,
      frame,
      viewportWidth,
    });
    if (centeredOffset === null) {
      return [];
    }
    if (index === 0) {
      anchors.push(centeredOffset);
      continue;
    }

    const previousFrame = layouts[index - 1]!;
    const previousOffset = anchors[index - 1]!;
    const leftEdgeTravel = frame.x - previousFrame.x;
    const rightEdgeTravel =
      frame.x + frame.width - (previousFrame.x + previousFrame.width);
    const directionalBudget = Math.max(
      0,
      Math.min(leftEdgeTravel, rightEdgeTravel),
    );
    const visibilityMinimum = clampPerpsProHistoryStripOffset(
      TAB_HORIZONTAL_PADDING + frame.x + frame.width - viewportWidth,
      maximumOffset,
    );
    const visibilityMaximum = clampPerpsProHistoryStripOffset(
      TAB_HORIZONTAL_PADDING + frame.x,
      maximumOffset,
    );
    const directionSafeMinimum = previousOffset;
    const directionSafeMaximum = clampPerpsProHistoryStripOffset(
      previousOffset + directionalBudget,
      maximumOffset,
    );
    const visibleDirectionSafeMinimum = Math.max(
      directionSafeMinimum,
      visibilityMinimum,
    );
    const visibleDirectionSafeMaximum = Math.min(
      directionSafeMaximum,
      visibilityMaximum,
    );
    const directionSafeOffset = Math.max(
      directionSafeMinimum,
      Math.min(centeredOffset, directionSafeMaximum),
    );

    // Visibility is preferred only inside the hard directional interval. If a
    // future translation produces incompatible geometry, preserving monotonic
    // pill edges takes precedence over introducing the original edge flash.
    anchors.push(
      visibleDirectionSafeMinimum <= visibleDirectionSafeMaximum
        ? Math.max(
            visibleDirectionSafeMinimum,
            Math.min(visibleDirectionSafeMaximum, centeredOffset),
          )
        : directionSafeOffset,
    );
  }

  return anchors;
};

export const getPerpsProHistoryStripOffset = ({
  anchors,
  bias,
  maximumOffset,
  position,
}: {
  anchors: readonly number[];
  bias: number;
  maximumOffset: number;
  position: number;
}) => {
  'worklet';
  if (anchors.length === 0 || maximumOffset <= 0) {
    return 0;
  }
  const maximumIndex = anchors.length - 1;
  const safePosition = Number.isFinite(position)
    ? Math.max(0, Math.min(maximumIndex, position))
    : 0;
  const fromIndex = Math.floor(safePosition);
  const toIndex = Math.min(maximumIndex, fromIndex + 1);
  const progress = safePosition - fromIndex;
  const from = anchors[fromIndex] ?? anchors[0]!;
  const to = anchors[toIndex] ?? from;
  return clampPerpsProHistoryStripOffset(
    from + (to - from) * progress + bias,
    maximumOffset,
  );
};

export const getPerpsProHistoryIndicatorPath = ({
  frame,
  stripOffset,
}: {
  frame: PerpsProTabIndicatorLayout;
  stripOffset: number;
}) => {
  'worklet';
  if (frame.width <= 0) {
    return '';
  }
  const left = TAB_HORIZONTAL_PADDING + frame.x - stripOffset;
  const right = left + frame.width;
  const top = TAB_INDICATOR_TOP;
  const bottom = top + TAB_INDICATOR_HEIGHT;
  const radius = Math.min(
    TAB_INDICATOR_RADIUS,
    frame.width / 2,
    TAB_INDICATOR_HEIGHT / 2,
  );

  return [
    `M ${left + radius} ${top}`,
    `H ${right - radius}`,
    `Q ${right} ${top} ${right} ${top + radius}`,
    `V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `H ${left + radius}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius}`,
    `V ${top + radius}`,
    `Q ${left} ${top} ${left + radius} ${top}`,
    'Z',
  ].join(' ');
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
}> = React.memo(({ activeTab, onChange, position }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [tabFrames, setTabFrames] = useState<PerpsProHistoryTabFrames>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const actualStripOffset = useSharedValue(0);
  const manualStripActive = useSharedValue(false);
  const stripBias = useSharedValue(0);
  const stripBiasGeometryVersion = useSharedValue('');

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
  const stripAnchors = useMemo(
    () =>
      getPerpsProHistoryTabStripAnchors({
        contentWidth,
        layouts: indicatorLayouts,
        viewportWidth,
      }),
    [contentWidth, indicatorLayouts, viewportWidth],
  );
  const maximumStripOffset = Math.max(0, contentWidth - viewportWidth);
  const stripGeometryReady =
    indicatorLayouts.length === TABS.length &&
    stripAnchors.length === TABS.length &&
    contentWidth > 0 &&
    viewportWidth > 0;
  const geometryVersion = useMemo(
    () =>
      [
        viewportWidth,
        contentWidth,
        ...indicatorLayouts.flatMap(layout => [layout.x, layout.width]),
        ...stripAnchors,
      ].join(':'),
    [contentWidth, indicatorLayouts, stripAnchors, viewportWidth],
  );

  const effectiveStripOffset = useDerivedValue(() => {
    if (manualStripActive.value) {
      return actualStripOffset.value;
    }
    return getPerpsProHistoryStripOffset({
      anchors: stripAnchors,
      bias:
        stripBiasGeometryVersion.value === geometryVersion
          ? stripBias.value
          : 0,
      maximumOffset: maximumStripOffset,
      position: position.value,
    });
  }, [geometryVersion, maximumStripOffset, position, stripAnchors]);

  const animatedScrollProps =
    useAnimatedProps<PerpsProHistoryAnimatedScrollProps>(() => {
      if (manualStripActive.value) {
        return {};
      }
      return {
        contentOffset: { x: effectiveStripOffset.value, y: 0 },
      };
    });

  const indicatorAnimatedProps = useAnimatedProps<PathProps>(() => {
    const frame = getPerpsProTabIndicatorFrame(
      position.value,
      indicatorLayouts,
    );
    return {
      d: getPerpsProHistoryIndicatorPath({
        frame,
        stripOffset: effectiveStripOffset.value,
      }),
      opacity: stripGeometryReady ? 1 : 0,
    };
  }, [indicatorLayouts, position, stripGeometryReady]);

  const updateManualStripBias = (offset: number) => {
    'worklet';
    actualStripOffset.value = offset;
    const naturalOffset = getPerpsProHistoryStripOffset({
      anchors: stripAnchors,
      bias: 0,
      maximumOffset: maximumStripOffset,
      position: position.value,
    });
    stripBias.value = offset - naturalOffset;
    stripBiasGeometryVersion.value = geometryVersion;
  };

  const handleScroll = useAnimatedScrollHandler({
    onBeginDrag: event => {
      manualStripActive.value = true;
      updateManualStripBias(event.contentOffset.x);
    },
    onEndDrag: event => {
      updateManualStripBias(event.contentOffset.x);
      const targetOffset = event.targetContentOffset?.x;
      const velocity = event.velocity?.x ?? 0;
      const momentumExpected =
        Math.abs(velocity) > STRIP_MOMENTUM_VELOCITY_EPSILON ||
        (targetOffset !== undefined &&
          Math.abs(targetOffset - event.contentOffset.x) >
            STRIP_MOMENTUM_OFFSET_EPSILON);
      manualStripActive.value = momentumExpected;
    },
    onMomentumBegin: () => {
      manualStripActive.value = true;
    },
    onMomentumEnd: event => {
      updateManualStripBias(event.contentOffset.x);
      manualStripActive.value = false;
    },
    onScroll: event => {
      actualStripOffset.value = event.contentOffset.x;
      if (manualStripActive.value) {
        updateManualStripBias(event.contentOffset.x);
      }
    },
  });

  return (
    <View style={styles.tabViewport}>
      <Svg
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.indicatorCanvas}>
        <AnimatedPath
          animatedProps={indicatorAnimatedProps}
          fill={styles.indicator.backgroundColor}
          testID="perps-pro-history-tab-indicator"
        />
      </Svg>
      <Animated.ScrollView
        animatedProps={animatedScrollProps}
        contentContainerStyle={styles.content}
        horizontal
        onContentSizeChange={width => setContentWidth(width)}
        onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        testID="perps-pro-history-tabs-scroll">
        <View accessibilityRole="tablist" style={styles.tabs}>
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
                {!stripGeometryReady && selected ? (
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
    </View>
  );
});

PerpsProHistoryTabs.displayName = 'PerpsProHistoryTabs';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tabViewport: {
    height: 32,
    position: 'relative' as const,
  },
  scroll: {
    flexGrow: 0,
  },
  indicatorCanvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
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
