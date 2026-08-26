import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
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

const TOOLTIP_X_GUTTER = 8;
const TOOLTIP_TAIL_H = 5;
const TOOLTIP_TAIL_W = 12;
// Distance between the tail tip and the cursor point.
const TOOLTIP_POINT_GAP = 6;

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
    const left = Math.min(
      Math.max(currentX.value - bw / 2, TOOLTIP_X_GUTTER),
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
    const left = Math.min(
      Math.max(currentX.value - bw / 2, TOOLTIP_X_GUTTER),
      chartWidth - bw - TOOLTIP_X_GUTTER,
    );
    const flipBelow =
      currentY.value < bh + TOOLTIP_TAIL_H + TOOLTIP_POINT_GAP + 2;
    const tailLeft = Math.min(
      Math.max(currentX.value - left - TOOLTIP_TAIL_W / 2, 8),
      Math.max(bw - TOOLTIP_TAIL_W - 8, 8),
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
      timeTexts: points.map(p =>
        formatPortfolioTooltipTime(p.timestamp, activePeriod),
      ),
      valueTexts: points.map(p => `$${splitNumberByStep(p.value.toFixed(2))}`),
    };
  }, [points, activePeriod, expanded]);

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
              <LineChart.CursorLine color={colors2024['neutral-line']} />
              <LineChart.CursorCrosshair
                color={PERPS_CHART_LINE_COLOR}
                outerSize={12}
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
                chartWidth={width}
              />
            </>
          )}
        </LineChart>
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
    bottom: -5,
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
    top: -5,
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
