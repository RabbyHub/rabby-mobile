import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/screens/Home/hooks/useCurve';
import { memo } from 'react';
import { Dimensions, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { formChartData } from '@/hooks/useCurve';
import {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
const ScreenWidth = Dimensions.get('screen').width;

function Chart({
  data,
  isOffline,
  loading,
  isNoAssets,
  pathColor,
}: {
  isOffline: boolean;
  data: ReturnType<typeof formChartData>;
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
}) {
  const { styles, colors } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        <LineChart.Provider data={data.list}>
          <ChartHeader
            netWorth={data.netWorth}
            change={data.change}
            changePercent={data.changePercent}
            isLoss={data.isLoss}
            data={data.list}
            loading={loading}
          />
          {isOffline || isNoAssets ? null : !loading ? (
            <LineChart
              height={104}
              width={ScreenWidth - 32}
              shape={d3Shape.curveCatmullRom}
              style={styles.chart}>
              <LineChart.Path
                showInactivePath={false}
                color={pathColor}
                width={2}>
                <LineChart.Gradient color={pathColor} />
              </LineChart.Path>
              <LineChart.CursorLine color={colors['neutral-line']} />
              <LineChart.CursorCrosshair
                color={pathColor}
                outerSize={12}
                size={8}
              />
            </LineChart>
          ) : (
            <CurveLoader style={styles.loading} />
          )}
        </LineChart.Provider>
      </View>
    </View>
  );
}
export const HomeTopChart = memo(Chart);

interface IHeaderProps {
  netWorth: string;
  change: string;
  changePercent: string;
  isLoss: boolean;
  loading: boolean;
  data: CurvePoint[];
}
export const ChartHeader = ({
  netWorth,
  change,
  changePercent,
  isLoss,
  loading,
  data,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();
  const percentChange = useDerivedValue(() => {
    const isActiveIndexData =
      data?.[currentIndex?.value]?.changePercent !== undefined;
    const formatChangePercent = isActiveIndexData
      ? data?.[currentIndex.value].changePercent
      : changePercent;
    const formatLoss = isActiveIndexData
      ? data?.[currentIndex.value].isLoss
      : isLoss;
    if (changePercent === '0%') {
      return changePercent;
    }
    return `${formatLoss ? '-' : '+'}${formatChangePercent}`;
  }, [data, currentIndex.value, change, changePercent, isLoss]);

  const dateTime = useDerivedValue(() => {
    return (
      (data?.[currentIndex?.value]?.netWorth
        ? data?.[currentIndex?.value]?.clockTimeString
        : '24h') || '24h'
    );
  }, [data, currentIndex, netWorth]);

  const formatNetWorth = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.netWorth || netWorth;
  }, [data, currentIndex, netWorth]);

  const lossStyleProps = useAnimatedStyle(() => {
    if (changePercent === '0%') {
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: colors2024['neutral-secondary'],
      };
    }
    if (data?.[currentIndex?.value]) {
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: data?.[currentIndex?.value]?.isLoss
          ? colors2024['red-default']
          : colors2024['green-default'],
      };
    }
    return {
      ...styles.changePercent,
      display: loading ? 'none' : 'flex',
      color: isLoss ? colors2024['red-default'] : colors2024['green-default'],
    };
  }, [isLoss, data, currentIndex, colors2024, styles, loading]);

  const netWorthAnimatedProps = useAnimatedProps(() => {
    return {
      text: formatNetWorth.value,
    };
  });
  const percentChangeAnimatedProps = useAnimatedProps(() => {
    return {
      text: percentChange.value,
    };
  });
  const dateTimeAnimatedProps = useAnimatedProps(() => {
    return {
      text: dateTime.value,
    };
  });

  if (loading) {
    return (
      <Skeleton
        width={181}
        height={42}
        style={styles.skeleton}
        LinearGradientComponent={LoadingLinear}
      />
    );
  }
  return (
    <View style={styles.charHeader}>
      <AnimateableText
        style={styles.netWorth}
        animatedProps={netWorthAnimatedProps}
      />
      <AnimateableText
        style={lossStyleProps}
        animatedProps={percentChangeAnimatedProps}
      />
      <AnimateableText
        style={styles.changeTime}
        animatedProps={dateTimeAnimatedProps}
      />
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  center: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginLeft: -16,
  },
  skeleton: {
    marginTop: 7,
    marginLeft: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  charHeader: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    paddingLeft: 8,
    width: ScreenWidth - 32,
  },
  netWorth: {
    fontSize: 40,
    lineHeight: 42,
    // textAlign: 'center',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    marginLeft: 8,
    marginRight: 4,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  container: {
    height: 159,
    width: ScreenWidth,
    overflow: 'hidden',
  },
  chartContainer: {
    paddingLeft: 16,
  },
  loading: {
    width: ScreenWidth - 32,
    paddingTop: 20,
    paddingHorizontal: 0,
  },
  chart: {
    position: 'relative',
  },
}));
