import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import Animated, {
  Easing,
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
// The plot area is inset by half the cursor dot on each side, so the dot on
// the first/last point still lands fully inside the container. Geometry, not
// clipping: Android's `overflow: 'hidden'` does not reliably clip children
// that are positioned with a transform (which the crosshair is).
const CURSOR_INSET = CROSSHAIR_OUTER / 2;

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
    const targetX = currentX.value;
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
    const targetX = currentX.value;
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

  const tailDownStyle = useAnimatedStyle(makeTailStyle(true), [chartWidth]);

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
 * Collapsed mini chart with the same draw-on reveal as the expanded chart.
 * Mount-triggered: it replays when the card first shows data and every time
 * the chart collapses back (the card remounts this instance).
 */
const SparklineChart = ({
  points,
}: {
  points: { timestamp: number; value: number }[];
}) => {
  const { styles } = useTheme2024({ getStyle });
  const drawProgress = useSharedValue(0);
  useEffect(() => {
    drawProgress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [drawProgress]);
  const drawStyle = useAnimatedStyle(() => ({
    width: drawProgress.value * SPARKLINE_WIDTH,
  }));

  return (
    <LineChart.Provider data={points}>
      <Animated.View style={[styles.chartClip, drawStyle]}>
        <LineChart
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          shape={d3Shape.curveMonotoneX}>
          <LineChart.Path
            color={PERPS_CHART_LINE_COLOR}
            width={1.5}
            showInactivePath={false}>
            <LineChart.Gradient color={PERPS_CHART_LINE_COLOR} />
          </LineChart.Path>
        </LineChart>
      </Animated.View>
    </LineChart.Provider>
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

  const plotWidth = Math.max(width - CURSOR_INSET * 2, 0);

  // Draw-on effect: the clip window sweeps left -> right, revealing the line
  // and its gradient. The parent keys this component by period, so every
  // expand AND every period switch remounts it — drawProgress starts at 0 on
  // the very first frame (resetting it in an effect would run after commit
  // and let the new curve flash at full width for one frame).
  const drawProgress = useSharedValue(0);
  useEffect(() => {
    drawProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [drawProgress]);
  const drawStyle = useAnimatedStyle(
    () => ({
      width: drawProgress.value * width,
    }),
    [width],
  );

  const handleTap = (locationX: number) => {
    if (isEmpty || points.length < 2 || plotWidth <= 0) {
      return;
    }
    // Same x mapping as wagmi's path: WITHOUT an xDomain it spaces points
    // EVENLY BY INDEX (timestamps are ignored), scaleLinear [0, len-1] ->
    // [0, plotWidth]. A timestamp-based mapping drifts wherever the sampling
    // interval is irregular — worst at both ends of the day series.
    // locationX is relative to the pressable, so drop the plot's inset.
    const step = plotWidth / (points.length - 1);
    const nearest = Math.min(
      Math.max(Math.round((locationX - CURSOR_INSET) / step), 0),
      points.length - 1,
    );
    const snappedX = nearest * step;
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
      {/* The reveal clip spans the FULL width (insets included) so it never
          cuts the cursor dot once the sweep has finished. */}
      <Animated.View style={[styles.chartClip, drawStyle]}>
        <View style={styles.plotInset}>
          <LineChart
            width={plotWidth}
            height={EXPANDED_CHART_HEIGHT}
            shape={d3Shape.curveMonotoneX}>
            <LineChart.Path
              color={PERPS_CHART_LINE_COLOR}
              width={1.5}
              showInactivePath={false}
              // No shape morphing: on a period switch the old path would still
              // be interpolating toward the new one while the draw-on sweep
              // reveals it, making the left end flicker vertically. The reveal
              // is the only animation.
              pathProps={{ isTransitionEnabled: false }}>
              <LineChart.Gradient color={PERPS_CHART_LINE_COLOR} />
            </LineChart.Path>
            {!isEmpty && (
              <>
                <LineChart.CursorLine color={cursorLineColor} />
                <LineChart.CursorCrosshair
                  color={PERPS_CHART_LINE_COLOR}
                  outerSize={CROSSHAIR_OUTER}
                  size={8}
                  // Without a press threshold the cursor's LongPressGestureHandler
                  // (minDurationMs=0) claims every touch and the page cannot be
                  // scrolled from the chart area; 150ms keeps quick swipes as
                  // scrolls and press-and-hold as cursor moves.
                  minDurationMs={150}
                />
                <PortfolioTooltip
                  timeTexts={timeTexts}
                  valueTexts={valueTexts}
                  chartWidth={plotWidth}
                />
              </>
            )}
          </LineChart>
        </View>
      </Animated.View>
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
    const [only] = chartPoints;
    if (chartPoints.length === 1 && only) {
      // wagmi-charts needs at least 2 points to draw a path.
      return [only, { ...only, timestamp: only.timestamp + 1 }];
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
    return <SparklineChart points={points} />;
  }

  return (
    <View>
      <LineChart.Provider data={points}>
        <ExpandedChartBody
          // Remount per period: the draw-on progress restarts from 0 before
          // the new curve's first frame, so it never flashes at full width.
          key={activePeriod}
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
  plotInset: {
    paddingHorizontal: CURSOR_INSET,
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
