import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import { formChartData, CurvePoint } from '@/hooks/useCurve';
import { memo, useEffect, useMemo, useCallback, useState } from 'react';
import { Dimensions, ImageBackground, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { ALERT_HEIGHT, HEADER_CHART_HEIGHT } from '@/constant/layout';
import {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { GlobalWarning } from '@/components2024/GlobalWarning/Warining';
import { useTranslation } from 'react-i18next';
import { useTriggerUpdate } from '../hooks/triggerUpdate';

const ScreenWidth = Dimensions.get('screen').width;

function Chart({
  data,
  isOffline,
  loading,
  isNoAssets,
  pathColor,
  handleScroll,
  isDisConnnect,
}: {
  isOffline: boolean;
  data: ReturnType<typeof formChartData>;
  loading: boolean;
  isNoAssets: boolean;
  pathColor: string;
  isDisConnnect: boolean;
  handleScroll: (y: number) => void;
}) {
  const { styles, colors, isLight } = useTheme2024({ getStyle });
  const { setTriggerUpdate } = useTriggerUpdate();
  const { t } = useTranslation();

  const topBg = useMemo(() => {
    if (data.isLoss) {
      if (isLight) {
        return require('@/assets2024/singleHome/home-loss-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-loss-dark-bg-2.png');
      }
    } else {
      if (isLight) {
        return require('@/assets2024/singleHome/home-profit-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-profit-dark-bg-2.png');
      }
    }
  }, [data.isLoss, isLight]);

  const scrollY = useCurrentTabScrollY();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 延迟初始化动画，避免页面切换时的卡顿
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 150);

    return () => {
      clearTimeout(timer);
      setTriggerUpdate?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScrollCallback = useCallback(
    (currentScrollY: number) => {
      if (isInitialized) {
        handleScroll(currentScrollY);
      }
    },
    [handleScroll, isInitialized],
  );

  useAnimatedReaction(
    () => scrollY.value,
    currentScrollY => {
      // 只有在初始化后才处理滚动事件
      runOnJS(handleScrollCallback)(currentScrollY);
    },
  );

  return (
    <View
      style={[
        styles.container,
        { height: HEADER_CHART_HEIGHT + (isDisConnnect ? ALERT_HEIGHT : 0) },
      ]}>
      <ImageBackground
        source={topBg}
        resizeMode="cover"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 150,
        }}
      />

      <GlobalWarning
        hasError={isDisConnnect}
        description={t('component.globalWarning.networkError.globalDesc')}
        style={styles.globalWarning}
        onRefresh={() => {
          setTriggerUpdate(true);
        }}
      />

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
            isInitialized ? (
              <LineChart
                height={114}
                width={ScreenWidth - 32}
                shape={d3Shape.curveCatmullRom}
                style={styles.relative}>
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
export const MultiChart = memo(Chart);

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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 延迟初始化动画计算
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, []);
  const percentChange = useDerivedValue(() => {
    // 如果还没初始化，返回默认值避免计算
    if (!isInitialized) {
      return `${isLoss ? '-' : '+'}${changePercent}(${
        isLoss ? '-' : '+'
      }${change})`;
    }

    const isActiveIndexData =
      data?.[currentIndex?.value]?.changePercent !== undefined;
    const formatChangeValue = isActiveIndexData
      ? data?.[currentIndex.value].change
      : change;
    const formatChangePercent = isActiveIndexData
      ? data?.[currentIndex.value].changePercent
      : changePercent;
    const formatLoss = isActiveIndexData
      ? data?.[currentIndex.value].isLoss
      : isLoss;
    return `${formatLoss ? '-' : '+'}${formatChangePercent}(${
      formatLoss ? '-' : '+'
    }${formatChangeValue})`;
  }, [data, currentIndex.value, change, changePercent, isLoss, isInitialized]);

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
      return {
        ...styles.changePercent,
        display: loading ? 'none' : 'flex',
        color: isLoss ? colors2024['red-default'] : colors2024['green-default'],
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
  }, [isLoss, data, currentIndex, colors2024, styles, loading, isInitialized]);

  const netWorthAnimatedProps = useAnimatedProps(() => {
    return {
      text: formatNetWorth.value,
    };
  }, [formatNetWorth.value]);

  const percentChangeAnimatedProps = useAnimatedProps(() => {
    return {
      text: percentChange.value,
    };
  }, [percentChange.value]);

  const dateTimeAnimatedProps = useAnimatedProps(() => {
    return {
      text: dateTime.value,
    };
  }, [dateTime.value]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Skeleton
          width={181}
          height={42}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
    );
  }
  return (
    <View style={styles.charHeader}>
      <AnimateableText
        style={styles.netWorth}
        animatedProps={netWorthAnimatedProps}
      />
      <View style={styles.changeSection}>
        <AnimateableText
          style={lossStyleProps}
          animatedProps={percentChangeAnimatedProps}
        />
        <AnimateableText
          style={styles.changeTime}
          animatedProps={dateTimeAnimatedProps}
        />
      </View>
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginLeft: -16,
  },
  skeleton: {
    marginTop: 20,
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  charHeader: {
    alignContent: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    width: ScreenWidth - 32,
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 42,
    textAlign: 'center',
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
    height: HEADER_CHART_HEIGHT,
    width: ScreenWidth,
    paddingTop: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  chartContainer: {
    paddingLeft: 16,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginBottom: 13,
  },
  loading: {
    width: ScreenWidth - 32,
    paddingTop: 20,
    paddingHorizontal: 0,
  },
  relative: { position: 'relative' },
}));
