import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AnimateableText, Text } from '@/components/Typography';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { splitNumberByStep } from '@/utils/number';
import {
  formatPortfolioTooltipTime,
  toChartPoints,
  type PortfolioData,
  type PortfolioPeriodKey,
} from '@/hooks/perps/perpsPortfolio';

export const PERPS_CHART_LINE_COLOR = '#50D2C1';

const SPARKLINE_WIDTH = 140;
const SPARKLINE_HEIGHT = 60;
const EXPANDED_CHART_HEIGHT = 120;

const PERIOD_TABS: { key: PortfolioPeriodKey; label: string }[] = [
  { key: 'day', label: '1D' },
  { key: 'week', label: '1W' },
  { key: 'month', label: '1M' },
  { key: 'allTime', label: 'All' },
];

const FLAT_ZERO_POINTS = [
  { timestamp: 0, value: 0 },
  { timestamp: 1, value: 0 },
];

export type PerpsPortfolioChartProps = {
  data: PortfolioData | null;
  isEmpty: boolean;
  expanded: boolean;
  width: number;
};

const TOOLTIP_X_GUTTER = 4;
const TOOLTIP_TAIL_H = 5;
const TOOLTIP_TAIL_W = 12;
// Distance between the tail tip and the cursor point.
const TOOLTIP_POINT_GAP = 6;
// Keep the tail clear of the bubble's rounded corners (radius 12), otherwise
// a gap opens between the tail and the curved edge.
const TOOLTIP_TAIL_MARGIN = 12;
const CROSSHAIR_OUTER = 12;
// The dot's visual center stops at the chart edge instead of sliding out.
const clampCursorX = (x: number, chartWidth: number) => {
  'worklet';
  const half = CROSSHAIR_OUTER / 2;
  return Math.min(Math.max(x, half), Math.max(chartWidth - half, half));
};

/**
 * Self-positioned cursor tooltip. LineChart.Tooltip clamps itself inside the
 * chart box (a point near the top pins the bubble to the edge and it stops
 * tracking), and the ancestors clip with overflow:hidden anyway — so this
 * follows currentX/currentY directly and flips BELOW the point when there is
 * not enough headroom above it, standard chart-tooltip behavior.
 */
const PortfolioTooltip = ({
  timeTexts,
  valueTexts,
  chartWidth,
}: {
  timeTexts: string[];
  valueTexts: string[];
  chartWidth: number;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { currentIndex, currentX, currentY, isActive } = LineChart.useChart();
  const bubbleWidth = useSharedValue(0);
  const bubbleHeight = useSharedValue(0);

  const timeProps = useAnimatedProps(() => {
    return { text: timeTexts[currentIndex.value] ?? '' };
  }, [timeTexts, currentIndex]);
  const valueProps = useAnimatedProps(() => {
    return { text: valueTexts[currentIndex.value] ?? '' };
  }, [valueTexts, currentIndex]);

  const wrapperStyle = useAnimatedStyle(() => {
    const bw = bubbleWidth.value;
    const bh = bubbleHeight.value;
    if (!bw || !bh || !chartWidth) {
      return { opacity: 0 };
    }
    const targetX = clampCursorX(currentX.value, chartWidth);
    const left = Math.min(
      Math.max(targetX - bw / 2, TOOLTIP_X_GUTTER),
      chartWidth - bw - TOOLTIP_X_GUTTER,
    );
    const flipBelow =
      currentY.value < bh + TOOLTIP_TAIL_H + TOOLTIP_POINT_GAP + 2;
    const top = flipBelow
      ? currentY.value + TOOLTIP_TAIL_H + TOOLTIP_POINT_GAP
      : currentY.value - bh - TOOLTIP_TAIL_H - TOOLTIP_POINT_GAP;
    return {
      opacity: isActive.value ? 1 : 0,
      transform: [{ translateX: left }, { translateY: top }],
    };
  }, [chartWidth]);

  // The bubble clamps at the chart edges while the cursor keeps moving — the
  // tail slides within the bubble so it always points at the cursor's x.
  const makeTailStyle = (pointsDown: boolean) => () => {
    'worklet';
    const bw = bubbleWidth.value;
    const bh = bubbleHeight.value;
    if (!bw || !bh || !chartWidth) {
      return { opacity: 0, left: 0 };
    }
    const targetX = clampCursorX(currentX.value, chartWidth);
    const left = Math.min(
      Math.max(targetX - bw / 2, TOOLTIP_X_GUTTER),
      chartWidth - bw - TOOLTIP_X_GUTTER,
    );
    const flipBelow =
      currentY.value < bh + TOOLTIP_TAIL_H + TOOLTIP_POINT_GAP + 2;
    const tailLeft = Math.min(
      Math.max(targetX - left - TOOLTIP_TAIL_W / 2, TOOLTIP_TAIL_MARGIN),
      Math.max(bw - TOOLTIP_TAIL_W - TOOLTIP_TAIL_MARGIN, TOOLTIP_TAIL_MARGIN),
    );
    return { opacity: flipBelow === pointsDown ? 0 : 1, left: tailLeft };
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tailDownStyle = useAnimatedStyle(makeTailStyle(true), [chartWidth]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tailUpStyle = useAnimatedStyle(makeTailStyle(false), [chartWidth]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tooltip, wrapperStyle]}
      onLayout={e => {
        bubbleWidth.value = e.nativeEvent.layout.width;
        bubbleHeight.value = e.nativeEvent.layout.height;
      }}>
      <AnimateableText style={styles.tooltipTime} animatedProps={timeProps} />
      <AnimateableText style={styles.tooltipValue} animatedProps={valueProps} />
      <Animated.View style={[styles.tooltipTailDown, tailDownStyle]} />
      <Animated.View style={[styles.tooltipTailUp, tailUpStyle]} />
    </Animated.View>
  );
};

/**
 * Cursor dot whose visual center stops at the chart edge instead of sliding
 * half-out of it. Overrides the crosshair wrapper's own transform (style
 * arrays: last transform wins). MUST be rendered inside <LineChart>: the
 * derived currentY needs the chart's dimensions context (outside it, the
 * path is missing and currentY reads -1, pinning the dot to the top).
 */
const ClampedCrosshair = ({ chartWidth }: { chartWidth: number }) => {
  const { currentX, currentY, isActive } = LineChart.useChart();
  const crosshairClampStyle = useAnimatedStyle(() => {
    const half = CROSSHAIR_OUTER / 2;
    return {
      transform: [
        { translateX: clampCursorX(currentX.value, chartWidth) - half },
        { translateY: currentY.value - half },
        { scale: withTiming(isActive.value ? 1 : 0, { duration: 120 }) },
      ],
    };
  }, [chartWidth]);

  return (
    <LineChart.CursorCrosshair
      color={PERPS_CHART_LINE_COLOR}
      outerSize={CROSSHAIR_OUTER}
      size={8}
      crosshairWrapperProps={{ style: crosshairClampStyle }}
      // Without a press threshold the cursor's LongPressGestureHandler
      // (minDurationMs=0) claims every touch and the page cannot be scrolled
      // from the chart area; 150ms keeps quick swipes as scrolls and
      // press-and-hold as cursor moves.
      minDurationMs={150}
    />
  );
};

/**
 * Expanded chart body. Lives inside LineChart.Provider so it can drive the
 * cursor shared values for the tap interaction: a single tap snaps the
 * cursor to the nearest point and auto-hides it after 2s (a long-press still
 * works as the continuous cursor). The clip wrapper keeps the crosshair dot
 * from bleeding past the chart bounds at the edges.
 */
const ExpandedChartBody = ({
  points,
  width,
  isEmpty,
  timeTexts,
  valueTexts,
  cursorLineColor,
}: {
  points: { timestamp: number; value: number }[];
  width: number;
  isEmpty: boolean;
  timeTexts: string[];
  valueTexts: string[];
  cursorLineColor: string;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { currentX, currentIndex, isActive } = LineChart.useChart();
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  const handleTap = (locationX: number) => {
    if (isEmpty || points.length < 2 || !width) {
      return;
    }
    // Same x mapping as wagmi's path: timestamps scaled linearly to [0, width].
    const t0 = points[0].timestamp;
    const span = points[points.length - 1].timestamp - t0 || 1;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const x = ((points[i].timestamp - t0) / span) * width;
      const dist = Math.abs(x - locationX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    const snappedX = ((points[nearest].timestamp - t0) / span) * width;
    currentIndex.value = nearest;
    currentX.value = snappedX;
    isActive.value = true;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      // Skip the auto-hide if a long-press has moved the cursor meanwhile.
      if (Math.abs(currentX.value - snappedX) < 0.5) {
        isActive.value = false;
        currentIndex.value = -1;
      }
    }, 2_000);
  };

  return (
    <Pressable onPress={e => handleTap(e.nativeEvent.locationX)}>
      <View style={styles.chartClip}>
        <LineChart
          width={width}
          height={EXPANDED_CHART_HEIGHT}
          shape={d3Shape.curveLinear}>
          <LineChart.Path
            color={PERPS_CHART_LINE_COLOR}
            width={1.5}
            showInactivePath={false}>
            <LineChart.Gradient color={PERPS_CHART_LINE_COLOR} />
          </LineChart.Path>
          {!isEmpty && (
            <>
              <LineChart.CursorLine color={cursorLineColor} />
              <ClampedCrosshair chartWidth={width} />
              <PortfolioTooltip
                timeTexts={timeTexts}
                valueTexts={valueTexts}
                chartWidth={width}
              />
            </>
          )}
        </LineChart>
      </View>
    </Pressable>
  );
};

export const PerpsPortfolioChart: React.FC<PerpsPortfolioChartProps> = ({
  data,
  isEmpty,
  expanded,
  width,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [period, setPeriod] = useState<PortfolioPeriodKey>('day');

  // No period memory: every expand starts back at 1D.
  useEffect(() => {
    if (expanded) {
      setPeriod('day');
    }
  }, [expanded]);

  const activePeriod = expanded ? period : 'day';

  const points = useMemo(() => {
    if (isEmpty || !data) {
      return FLAT_ZERO_POINTS;
    }
    const chartPoints = toChartPoints(data[activePeriod]);
    if (!chartPoints.length) {
      return FLAT_ZERO_POINTS;
    }
    if (chartPoints.length === 1) {
      // wagmi-charts needs at least 2 points to draw a path.
      return [
        chartPoints[0],
        { ...chartPoints[0], timestamp: chartPoints[0].timestamp + 1 },
      ];
    }
    return chartPoints;
  }, [data, isEmpty, activePeriod]);

  // Tooltip strings are only consumed by the expanded chart's cursor — the
  // always-mounted sparkline must not pay for formatting hundreds of points.
  const { timeTexts, valueTexts } = useMemo(() => {
    if (!expanded) {
      return { timeTexts: [], valueTexts: [] };
    }
    return {
      timeTexts: points.map(p => formatPortfolioTooltipTime(p.timestamp)),
      valueTexts: points.map(p => `$${splitNumberByStep(p.value.toFixed(2))}`),
    };
  }, [points, expanded]);

  if (!expanded) {
    return (
      <LineChart.Provider data={points}>
        <LineChart
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          shape={d3Shape.curveLinear}>
          <LineChart.Path
            color={PERPS_CHART_LINE_COLOR}
            width={1.5}
            showInactivePath={false}>
            <LineChart.Gradient color={PERPS_CHART_LINE_COLOR} />
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
    );
  }

  return (
    <View>
      <LineChart.Provider data={points}>
        <ExpandedChartBody
          points={points}
          width={width}
          isEmpty={isEmpty}
          timeTexts={timeTexts}
          valueTexts={valueTexts}
          cursorLineColor={colors2024['neutral-line']}
        />
      </LineChart.Provider>
      <View style={styles.tabRow}>
        {PERIOD_TABS.map(tab => {
          const isActive = tab.key === period;
          return (
            <TouchableOpacity
              key={tab.key}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              onPress={() => setPeriod(tab.key)}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  chartClip: {
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    marginTop: 4,
  },
  tabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  tabTextActive: {
    fontWeight: '700',
    color: PERPS_CHART_LINE_COLOR,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(19, 20, 22, 0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  tooltipTime: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: '#C5C5CF',
  },
  tooltipValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tooltipTailDown: {
    position: 'absolute',
    bottom: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(19, 20, 22, 0.95)',
  },
  tooltipTailUp: {
    position: 'absolute',
    top: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(19, 20, 22, 0.95)',
  },
}));
