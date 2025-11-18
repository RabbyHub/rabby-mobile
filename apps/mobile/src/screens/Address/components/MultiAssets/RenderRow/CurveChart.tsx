import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import {
  formChartData,
  CurvePoint,
  formatSmallCurrencyValue,
} from '@/hooks/useCurve';
import { memo, useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { useTriggerUpdate } from '../hooks/triggerUpdate';
import { useCurrency } from '@/hooks/useCurrency';
import { BALANCE_HIDE_TYPE } from '@/screens/Home/hooks/useHideBalance';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import RcIconSmallWalletCC from '@/assets2024/icons/home/IconSmallWalletCC.svg';
import RcIconSmallArrowCC from '@/assets2024/icons/home/IconSmallArrowCC.svg';
import { atom, useAtom, useAtomValue } from 'jotai';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ScreenWidth = Dimensions.get('screen').width;

export const foldMultiChartAtom = atom<boolean>(true);

function Chart({
  data,
  isOffline,
  loading,
  isNoAssets,
  pathColor,
  hideType,
  loadingNewCurve,
  accountsLength,
}: {
  isOffline: boolean;
  data: ReturnType<typeof formChartData>;
  loading: boolean;
  loadingNewCurve: boolean;
  isNoAssets: boolean;
  pathColor: string;
  hideType: BALANCE_HIDE_TYPE;
  accountsLength?: number;
}) {
  const { styles, colors } = useTheme2024({ getStyle });
  const { setTriggerUpdate } = useTriggerUpdate();
  const isFoldMultiChart = useAtomValue(foldMultiChartAtom);

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

  return (
    <View style={[styles.container]}>
      <View style={styles.chartContainer}>
        <LineChart.Provider data={data.list}>
          <ChartHeader
            loading={loadingNewCurve}
            rawNetWorth={data.rawNetWorth}
            rawChange={data.rawChange}
            changePercent={data.changePercent}
            isLoss={data.isLoss}
            data={data.list}
            hideType={hideType}
            accountsLength={accountsLength}
          />
          {isFoldMultiChart ? null : isOffline ||
            isNoAssets ? null : !loading ? (
            isInitialized ? (
              <LineChart
                height={114}
                width={ScreenWidth - 72}
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
  rawNetWorth: number;
  rawChange: number;
  changePercent: string;
  isLoss: boolean;
  data: CurvePoint[];
  hideType: BALANCE_HIDE_TYPE;
  loading: boolean;
  accountsLength?: number;
}
export const ChartHeader = ({
  rawNetWorth,
  rawChange,
  changePercent,
  isLoss,
  hideType,
  data: _data,
  loading,
  accountsLength,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();
  const [isInitialized, setIsInitialized] = useState(false);
  const { currency, formatCurrentCurrency } = useCurrency();
  const [isFoldMultiChart, setIsFoldMultiChart] = useAtom(foldMultiChartAtom);
  const netWorth = useMemo(() => {
    return formatSmallCurrencyValue(rawNetWorth, { currency });
  }, [rawNetWorth, currency]);
  const change = useMemo(() => {
    return formatCurrentCurrency(Math.abs(rawChange));
  }, [formatCurrentCurrency, rawChange]);

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
    if (hideType === 'HIDE') {
      return {
        ...styles.changePercent,
        display: 'flex',
        color: colors2024['neutral-body'],
      };
    }
    // 如果还没初始化，使用默认样式
    if (!isInitialized) {
      return {
        ...styles.changePercent,
        display: 'flex',
        color: isLoss ? colors2024['red-default'] : colors2024['green-default'],
      };
    }

    if (data?.[currentIndex?.value]) {
      return {
        ...styles.changePercent,
        display: 'flex',
        color: data?.[currentIndex?.value]?.isLoss
          ? colors2024['red-default']
          : colors2024['green-default'],
      };
    }
    return {
      ...styles.changePercent,
      display: 'flex',
      color: isLoss ? colors2024['red-default'] : colors2024['green-default'],
    };
  }, [isLoss, data, currentIndex, colors2024, styles, isInitialized, hideType]);

  const netWorthAnimatedProps = useAnimatedProps(() => {
    return {
      text: hideType === 'HIDE' ? '******' : formatNetWorth.value,
    };
  }, [formatNetWorth.value, hideType]);

  const percentChangeAnimatedProps = useAnimatedProps(() => {
    return {
      text: hideType === 'HIDE' ? '***' : percentChange.value,
    };
  }, [percentChange.value, hideType]);

  const dateTimeAnimatedProps = useAnimatedProps(() => {
    return {
      text: hideType === 'HIDE' ? '' : dateTime.value,
    };
  }, [dateTime.value, hideType]);

  const arrowStrokeProps = useAnimatedProps(() => {
    let strokeColor: string;
    if (hideType === 'HIDE') {
      strokeColor = colors2024['neutral-body'];
    } else if (!isInitialized) {
      strokeColor = isLoss
        ? colors2024['red-default']
        : colors2024['green-default'];
    } else if (data?.[currentIndex?.value]) {
      strokeColor = data?.[currentIndex.value]?.isLoss
        ? colors2024['red-default']
        : colors2024['green-default'];
    } else {
      strokeColor = isLoss
        ? colors2024['red-default']
        : colors2024['green-default'];
    }
    return {
      stroke: strokeColor,
    };
  }, [isLoss, data, currentIndex, colors2024, isInitialized, hideType]);

  return (
    <View style={styles.charHeader}>
      <View style={styles.netWorthContainer}>
        {loading ? (
          <Skeleton
            width={181}
            height={44}
            style={styles.skeletonNetWorth}
            LinearGradientComponent={LoadingLinear}
          />
        ) : (
          <AnimateableText
            style={[
              styles.netWorth,
              hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
            ]}
            animatedProps={netWorthAnimatedProps}
          />
        )}
        <View style={[styles.accountBg]}>
          <RcIconSmallWalletCC color={colors2024['neutral-title-1']} />
          <Text style={styles.accountText}>
            {accountsLength && accountsLength >= 10 ? '10' : accountsLength}
          </Text>
          <RcIconSmallArrowCC color={colors2024['neutral-title-1']} />
        </View>
      </View>
      {loading ? (
        <Skeleton
          width={100}
          height={22}
          style={styles.skeletonNetWorth}
          LinearGradientComponent={LoadingLinear}
        />
      ) : (
        <View
          style={[
            styles.changeSection,
            hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
          ]}>
          <AnimateableText
            style={lossStyleProps}
            animatedProps={percentChangeAnimatedProps}
          />
          <AnimateableText
            style={styles.changeTime}
            animatedProps={dateTimeAnimatedProps}
          />
          <Pressable
            hitSlop={50}
            onPress={e => {
              e.stopPropagation();
              setIsFoldMultiChart(pre => !pre);
            }}
            style={styles.percentChangeContainer}>
            <Svg
              style={{
                transform: isFoldMultiChart
                  ? [{ rotate: '90deg' }]
                  : [{ rotate: '270deg' }],
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
                animatedProps={arrowStrokeProps}
              />
            </Svg>
          </Pressable>
        </View>
      )}
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
  skeletonNetWorth: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  charHeader: {
    alignContent: 'flex-start',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    width: ScreenWidth - 72,
    gap: 6,
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    // height: HEADER_CHART_HEIGHT,
    paddingHorizontal: 20,
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-0']
    //   : colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  chartContainer: {},
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
  bg: {
    position: 'absolute',
    left: 0,
    width: ScreenWidth,
    height: 32,
    zIndex: -100,
  },
  balanceOpacity: {
    opacity: 0.2,
  },
  netWorthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountBg: {
    minWidth: 74,
    padding: 8,
    paddingLeft: 11,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-line'],
    shadowColor: colors2024['brand-light-1'],
    shadowOffset: { width: 0, height: 9.411 },
    shadowOpacity: 0.1,
    shadowRadius: 22.587,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    // position: 'absolute',
    // top: 28,
    // right: 20,
    // elevation: 500,
  },
  accountText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    color: colors2024['neutral-title-1'],
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    paddingLeft: 6,
  },
  percentChangeContainer: {
    // flexDirection: 'row',
    // alignItems: 'center',
    // justifyContent: 'flex-end',
  },
}));
