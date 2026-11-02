import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import * as d3Shape from 'd3-shape';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Stop } from 'react-native-svg';
import { LineChart } from 'react-native-wagmi-charts';
import RcPnlTipTail from '@/assets2024/memecoin/pnl-tip-tail.svg';
import { AnimateableText, Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useChartTapCursor } from '@/screens/Perps/components/PerpsPortfolioChart';
import { createGetStyles2024 } from '@/utils/styles';
import type { MemePnlPoint } from '../data/types';
import { formatMemePnlUsd } from '../ui/formatBalance';

export const MEME_PNL_CURVE_WIDTH = 128;
const CURVE_HEIGHT = 52;
// keeps the stroke inside the box at the curve's highest and lowest points
const CURVE_Y_GUTTER = 2;
// wagmi centers a flat line; the design keeps it at the top of its area
const FLAT_Y_RANGE = { min: -1, max: 0 };
const CURVE_AREA_OPACITY = 0.16;
const CURSOR_DOT_SIZE = 5;
// quick swipes on the chart keep scrolling the page
const CURSOR_HOLD_MS = 150;
const TIP_BG = 'rgba(19, 20, 22, 0.95)';
const TIP_TEXT = '#D3D8E0';
const TIP_TAIL_WIDTH = 12.1244;
// the tip sits this far above the curve, wherever the point is
const TIP_ABOVE_CURVE = 4;
// the tip may run past the curve up to the card edge
const TIP_MAX_RIGHT = MEME_PNL_CURVE_WIDTH + 16;

const PnlTip = ({ points }: { points: MemePnlPoint[] }) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex, currentX, isActive } = LineChart.useChart();
  const bubbleWidth = useSharedValue(0);
  const gainColor = colors2024['green-default'];
  const lossColor = colors2024['red-default'];

  const { timeTexts, valueTexts, losses } = useMemo(
    () => ({
      timeTexts: points.map(p => dayjs(p.timestamp).format('MM/DD, HH:mm')),
      valueTexts: points.map(p => formatMemePnlUsd(p.value)),
      losses: points.map(p => p.value < 0),
    }),
    [points],
  );

  const timeProps = useAnimatedProps(() => {
    return { text: timeTexts[currentIndex.value] ?? '' };
  }, [timeTexts, currentIndex]);
  const valueProps = useAnimatedProps(() => {
    return { text: valueTexts[currentIndex.value] ?? '' };
  }, [valueTexts, currentIndex]);
  const valueColorStyle = useAnimatedStyle(
    () => ({
      color: losses[currentIndex.value] ? lossColor : gainColor,
    }),
    [losses, lossColor, gainColor],
  );
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: isActive.value && bubbleWidth.value ? 1 : 0,
    transform: [
      {
        translateX: Math.min(
          currentX.value - bubbleWidth.value / 2,
          TIP_MAX_RIGHT - bubbleWidth.value,
        ),
      },
    ],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    opacity: isActive.value ? 1 : 0,
    transform: [{ translateX: currentX.value - TIP_TAIL_WIDTH / 2 }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.tipBubble, bubbleStyle]}
        onLayout={e => {
          bubbleWidth.value = e.nativeEvent.layout.width;
        }}>
        <AnimateableText style={styles.tipText} animatedProps={timeProps} />
        <View style={styles.tipValueRow}>
          <Text style={styles.tipText}>{t('page.memeCoin.pnlTipLabel')}</Text>
          <AnimateableText
            style={[styles.tipValue, valueColorStyle]}
            animatedProps={valueProps}
          />
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.tipTail, tailStyle]}>
        <RcPnlTipTail />
      </Animated.View>
    </>
  );
};

const CurveBody = ({
  points,
  color,
  flat,
}: {
  points: MemePnlPoint[];
  color: string;
  flat: boolean;
}) => {
  const { colors2024 } = useTheme2024({ getStyle });
  const handleTap = useChartTapCursor({
    disabled: flat,
    pointCount: points.length,
    plotWidth: MEME_PNL_CURVE_WIDTH,
    inset: 0,
  });

  return (
    <Pressable onPress={e => handleTap(e.nativeEvent.locationX)}>
      <LineChart
        width={MEME_PNL_CURVE_WIDTH}
        height={CURVE_HEIGHT}
        yGutter={CURVE_Y_GUTTER}
        shape={d3Shape.curveMonotoneX}>
        <LineChart.Path
          color={color}
          width={1.5}
          showInactivePath={false}
          pathProps={{ isTransitionEnabled: false }}>
          <LineChart.Gradient color={color}>
            <Stop
              offset="0%"
              stopColor={color}
              stopOpacity={CURVE_AREA_OPACITY}
            />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LineChart.Gradient>
        </LineChart.Path>
        {flat ? null : (
          <>
            <LineChart.CursorLine
              color={colors2024['neutral-foot']}
              lineProps={{
                strokeWidth: 1,
                strokeDasharray: '1 3',
                strokeLinecap: 'round',
              }}
            />
            <LineChart.CursorCrosshair
              color={color}
              outerSize={CURSOR_DOT_SIZE}
              size={CURSOR_DOT_SIZE}
              minDurationMs={CURSOR_HOLD_MS}
            />
            <PnlTip points={points} />
          </>
        )}
      </LineChart>
    </Pressable>
  );
};

export const MemePnlCurve = React.memo(function MemePnlCurve({
  points,
  color,
}: {
  points: MemePnlPoint[];
  color: string;
}) {
  const flat = points.every(point => point.value === 0);
  return (
    <LineChart.Provider data={points} yRange={flat ? FLAT_Y_RANGE : undefined}>
      <CurveBody points={points} color={color} flat={flat} />
    </LineChart.Provider>
  );
});

const getStyle = createGetStyles2024(() => ({
  tipBubble: {
    position: 'absolute',
    left: 0,
    bottom: CURVE_HEIGHT + TIP_ABOVE_CURVE,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: TIP_BG,
  },
  tipTail: {
    position: 'absolute',
    left: 0,
    top: -TIP_ABOVE_CURVE,
  },
  tipValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '400',
    color: TIP_TEXT,
  },
  tipValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
  },
}));
