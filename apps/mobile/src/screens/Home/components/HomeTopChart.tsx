import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import { memo, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import {
  CurvePoint,
  formatSmallCurrencyValue,
  useSingleHomeCurveData,
} from '@/hooks/useCurve';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import { useCurrency } from '@/hooks/useCurrency';
import {
  FOLD_ASSETS_HEADER_HEIGHT,
  UNFOLD_ASSETS_HEADER_HEIGHT,
} from '@/constant/layout';
import Svg, { Path } from 'react-native-svg';
import { useHomeFoldChart } from '../Home';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ScreenWidth = Dimensions.get('screen').width;

function Chart({
  isOffline,
  balanceLoading,
  evmBalance,
  isNoAssets,
  pathColor,
}: // fold,
// setFold,
{
  isOffline: boolean;
  balanceLoading: boolean;
  evmBalance?: number | null;
  isNoAssets: boolean;
  pathColor: string;
  // fold: boolean;
  // setFold: (fold: boolean) => void;
}) {
  const { styles, colors } = useTheme2024({ getStyle });
  const [isInitialized, setIsInitialized] = useState(false);

  const { isFoldChart: fold } = useHomeFoldChart();

  const { isLoading, selectData: data } = useSingleHomeCurveData();
  console.debug('[perf] data', data);

  const isLoadingCurve = isLoading || (balanceLoading && !evmBalance);

  useEffect(() => {
    // 延迟初始化动画，避免页面切换时的卡顿
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View
      onTouchStart={e => {
        e.stopPropagation();
      }}
      style={[
        styles.container,
        {
          height: fold
            ? FOLD_ASSETS_HEADER_HEIGHT
            : UNFOLD_ASSETS_HEADER_HEIGHT,
        },
      ]}>
      <View style={styles.chartContainer}>
        <LineChart.Provider data={data.list}>
          <ChartHeader
            rawNetWorth={data.rawNetWorth}
            changePercent={data.changePercent}
            isLoss={data.isLoss}
            data={data.list}
            loading={isLoadingCurve}
          />
          {fold ? null : isOffline || isNoAssets ? null : !isLoadingCurve ? (
            isInitialized ? (
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
            )
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
  rawNetWorth: number;
  changePercent: string;
  isLoss: boolean;
  loading: boolean;
  data: CurvePoint[];
}
const ChartHeader = ({
  rawNetWorth,
  changePercent,
  isLoss,
  loading,
  data: _data,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();
  const [isInitialized, setIsInitialized] = useState(false);
  const { currency, formatCurrentCurrency } = useCurrency();

  const netWorth = useMemo(() => {
    return formatSmallCurrencyValue(rawNetWorth, { currency });
  }, [rawNetWorth, currency]);

  console.debug(
    '[perf] ChartHeader:: rawNetWorth, currentIndex, currentIndex.value',
    rawNetWorth,
    currentIndex,
    currentIndex.value,
  );

  const data = useMemo(() => {
    return (
      _data?.map(item => {
        return {
          ...item,
          netWorth: formatSmallCurrencyValue(item.value, { currency }),
          change: formatCurrentCurrency(item.rawChange),
        };
      }) || []
    );
  }, [_data, currency, formatCurrentCurrency]);

  useEffect(() => {
    // 延迟初始化动画计算
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, []);
  const percentChange = useDerivedValue(() => {
    // 如果还没初始化，返回默认值避免计算
    if (!isInitialized) {
      if (changePercent === '0%') {
        return changePercent;
      }
      return `${isLoss ? '-' : '+'}${changePercent}`;
    }

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
  }, [data, currentIndex.value, changePercent, isLoss, isInitialized]);

  const dateTime = useDerivedValue(() => {
    // 如果还没初始化，返回默认值
    if (!isInitialized) {
      return '24h';
    }

    return (
      (data?.[currentIndex?.value]?.netWorth
        ? data?.[currentIndex?.value]?.clockTimeString
        : '24h') || '24h'
    );
  }, [data, currentIndex, netWorth, isInitialized]);

  const formatNetWorth = useDerivedValue(() => {
    // 如果还没初始化，返回默认值
    if (!isInitialized) {
      return netWorth;
    }

    return data?.[currentIndex?.value]?.netWorth || netWorth;
  }, [data, currentIndex, netWorth, isInitialized]);

  const lossStyleProps = useAnimatedStyle(() => {
    // 如果还没初始化，使用默认样式
    if (!isInitialized) {
      if (changePercent === '0%') {
        return {
          ...styles.changePercent,
          display: loading ? 'none' : 'flex',
          color: colors2024['neutral-secondary'],
          stroke: colors2024['neutral-secondary'],
        };
      }
      const _color = isLoss
        ? colors2024['red-default']
        : colors2024['green-default'];
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: _color,
        stroke: _color,
      };
    }

    if (changePercent === '0%') {
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: colors2024['neutral-secondary'],
        stroke: colors2024['neutral-secondary'],
      };
    }
    if (data?.[currentIndex?.value]) {
      const _color = data?.[currentIndex?.value]?.isLoss
        ? colors2024['red-default']
        : colors2024['green-default'];
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: _color,
        stroke: _color,
      };
    }
    const _color = isLoss
      ? colors2024['red-default']
      : colors2024['green-default'];
    return {
      ...styles.changePercent,
      display: loading ? 'none' : 'flex',
      color: _color,
      stroke: _color,
    };
  }, [isLoss, data, currentIndex, colors2024, styles, loading, isInitialized]);

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

  const { isFoldChart: fold, setFoldChart: setFold } = useHomeFoldChart();

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
      <View style={styles.leftContainer}>
        <AnimateableText
          style={styles.netWorth}
          animatedProps={netWorthAnimatedProps}
        />
        {fold ? null : (
          <AnimateableText
            style={styles.changeTime}
            animatedProps={dateTimeAnimatedProps}
          />
        )}
      </View>
      <Pressable
        hitSlop={20}
        onPress={() => setFold(!fold)}
        style={styles.percentChangeContainer}>
        <AnimateableText
          style={lossStyleProps}
          animatedProps={percentChangeAnimatedProps}
        />
        <View>
          <Svg
            style={{
              transform: fold ? [{ rotate: '90deg' }] : [{ rotate: '270deg' }],
            }}
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none">
            <AnimatedPath
              d="M8.4 4.80005L15.6 12L8.4 19.2"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              animatedProps={lossStyleProps}
            />
          </Svg>
        </View>
      </Pressable>
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
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingLeft: 8,
    width: ScreenWidth - 32,
  },
  leftContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  percentChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 48,
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
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  container: {
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
