import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint, formatSmallCurrencyValue } from '@/hooks/useCurve';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { useCurrency } from '@/hooks/useCurrency';
import { BALANCE_HIDE_TYPE } from '@/screens/Home/hooks/useHideBalance';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import RcIconSmallWalletCC from '@/assets2024/icons/home/IconSmallWalletCC.svg';
import RcIconSmallArrowCC from '@/assets2024/icons/home/IconSmallArrowCC.svg';
import Svg, { Path } from 'react-native-svg';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { useAccountInfo } from '../hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { ThemeColors2024 } from '@rabby-wallet/base-utils';
import { useIsFocused } from '@react-navigation/native';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { create } from 'zustand';
import {
  useScene24hBalanceCombinedData,
  useSceneIsLoading,
  useSceneIsLoadingNew,
} from '@/hooks/useScene24hBalance';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ScreenWidth = Dimensions.get('screen').width;

export const useFoldMultiChartStore = create<{
  isFoldMultiChart: boolean;
  setIsFoldMultiChart: (v: boolean) => void;
}>(set => ({
  isFoldMultiChart: true,
  setIsFoldMultiChart: v => set({ isFoldMultiChart: v }),
}));

export const MultiChart = memo(function MultiChart({
  hideType,
}: {
  hideType: BALANCE_HIDE_TYPE;
}) {
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const { isFoldMultiChart, setIsFoldMultiChart } = useFoldMultiChartStore();

  const { combinedData: data } = useScene24hBalanceCombinedData('Home');
  const { isLoadingNew: loadingNewCurve } = useSceneIsLoadingNew('Home');

  const { top10Addresses } = useAccountInfo();
  const { accountsLength, getTotalBalance } = useAccountsBalance();
  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const isNavFocused = useIsFocused();
  const {
    // useless
    combineData: combineCurveData,
    // useless
    isLoadingNew: isLoadingCurve,
    // TODO: only useful action, migrate it
    refresh: refreshCurve,
  } = useMultiCurve(top10Addresses, {
    isNavigationFocused: isNavFocused,
    disableAutoFetch: true,
    totalBalance: top10Balance.total,
    totalEvmBalance: top10Balance.totalEvm,
  });

  const combineData = useMemo(() => {
    return {
      ...combineCurveData,
      rawNetWorth: data.rawNetWorth,
      rawChange: data.rawChange,
      change: data.change,
      changePercent: data.changePercent,
      isLoss: data.isLoss,
    };
  }, [combineCurveData, data]);

  const pathColor = useMemo(
    () =>
      !combineData.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, combineData.isLoss],
  );
  const toggleFoldMultiChart = useCallback(() => {
    if (isFoldMultiChart) {
      refreshCurve();
    }
    setIsFoldMultiChart(!isFoldMultiChart);
  }, [setIsFoldMultiChart, isFoldMultiChart, refreshCurve]);

  const chartsData = combineCurveData.list;

  const heightAnim = useSharedValue(0);
  const opacityAnim = useSharedValue(0);

  const CHART_HEIGHT = 114;
  useEffect(() => {
    const DURATION = 200;
    if (isFoldMultiChart) {
      heightAnim.value = withTiming(0, {
        easing: Easing.inOut(Easing.ease),
        duration: DURATION,
      });
      opacityAnim.value = withTiming(0, { duration: DURATION });
    } else {
      heightAnim.value = withTiming(CHART_HEIGHT, {
        easing: Easing.inOut(Easing.ease),
        duration: DURATION,
      });
      opacityAnim.value = withTiming(1, { duration: DURATION });
    }
  }, [isFoldMultiChart, heightAnim, opacityAnim]);

  const animatedHeightStyle = useAnimatedStyle(() => {
    return {
      height: heightAnim.value,
    };
  });

  const animOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: opacityAnim.value,
    };
  });

  return (
    <View
      style={[styles.container]}
      onTouchStart={e => {
        e.stopPropagation();
      }}>
      <View
        style={[
          styles.chartContainer,
          hideType === 'HALF_HIDE' && styles.balanceOpacity,
        ]}>
        <LineChart.Provider data={chartsData}>
          <ChartHeader
            loading={loadingNewCurve}
            rawNetWorth={data.rawNetWorth}
            rawChange={data.rawChange}
            changePercent={data.changePercent}
            isLoss={data.isLoss}
            data={combineCurveData.list}
            hideType={hideType}
            accountsLength={accountsLength}
            toggleFoldMultiChart={toggleFoldMultiChart}
            isFoldMultiChart={isFoldMultiChart}
          />
          <Animated.View style={[animatedHeightStyle, animOpacityStyle]}>
            {!chartsData.length ? null : !isLoadingCurve ? (
              <LineChart
                height={CHART_HEIGHT}
                width={ScreenWidth - 72}
                shape={d3Shape.curveCatmullRom}
                style={[
                  styles.relative,
                  (hideType === 'HIDE' || hideType === 'HALF_HIDE') &&
                    styles.balanceOpacity,
                ]}>
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
          </Animated.View>
        </LineChart.Provider>
      </View>
    </View>
  );
});

interface IHeaderProps {
  rawNetWorth: number;
  rawChange: number;
  changePercent: string;
  isLoss: boolean;
  data: CurvePoint[];
  hideType: BALANCE_HIDE_TYPE;
  loading: boolean;
  accountsLength?: number;
  toggleFoldMultiChart: () => void;
  isFoldMultiChart: boolean;
}
const ChartHeader = ({
  rawNetWorth,
  rawChange,
  changePercent: _changePercent,
  isLoss,
  hideType,
  data: _data,
  loading,
  accountsLength,
  toggleFoldMultiChart,
  isFoldMultiChart,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();
  const { currency, formatCurrentCurrency } = useCurrency();
  const debouncedRawNetWorth = useDebouncedValue(rawNetWorth, 300);
  const debouncedRawChange = useDebouncedValue(rawChange, 300);

  const netWorth = useMemo(() => {
    return formatSmallCurrencyValue(debouncedRawNetWorth, { currency });
  }, [debouncedRawNetWorth, currency]);
  const change = useMemo(() => {
    return formatCurrentCurrency(Math.abs(debouncedRawChange));
  }, [formatCurrentCurrency, debouncedRawChange]);
  const changePercent = useDebouncedValue(_changePercent, 300);

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

  const percentChange = useDerivedValue(() => {
    if (hideType === 'HIDE') {
      return '***';
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
  }, [data, currentIndex.value, change, changePercent, isLoss, hideType]);

  const dateTime = useDerivedValue(() => {
    return (
      (data?.[currentIndex?.value]?.netWorth
        ? data?.[currentIndex?.value]?.clockTimeString
        : '24h') || '24h'
    );
  }, [data, currentIndex, netWorth]);

  const formatNetWorth = useDerivedValue(() => {
    return hideType === 'HIDE'
      ? '******'
      : isFoldMultiChart
      ? netWorth
      : data?.[currentIndex?.value]?.netWorth || netWorth;
  }, [data, currentIndex, netWorth, isFoldMultiChart, hideType]);

  const lossStyleProps = useAnimatedStyle(() => {
    if (hideType === 'HIDE') {
      return {
        ...styles.changePercent,
        display: 'flex',
        color: colors2024['neutral-body'],
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
  }, [isLoss, data, currentIndex, colors2024, styles, hideType]);

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
      text: hideType === 'HIDE' ? '' : dateTime.value,
    };
  }, [dateTime.value, hideType]);

  const arrowStrokeProps = useAnimatedProps(() => {
    return {
      stroke: colors2024['neutral-secondary'],
    };
  }, [isLoss, data, currentIndex, colors2024, hideType]);

  const isHidden = useMemo(() => {
    return hideType === 'HIDE';
  }, [hideType]);

  return (
    <View style={styles.charHeader}>
      <View style={styles.netWorthContainer}>
        <AnimateableText
          style={[
            styles.netWorth,
            loading && styles.hidden,
            // 用hide原因是：AnimateableText持续订阅netWorthAnimatedProps的变化，会出现订阅不到值或值不更新的问题
            hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
          ]}
          animatedProps={netWorthAnimatedProps}
        />

        <Skeleton
          width={181}
          height={44}
          style={[styles.skeletonNetWorth, !loading && styles.hidden]}
          LinearGradientComponent={LoadingLinear}
        />

        <View style={[styles.accountBg]}>
          <RcIconSmallWalletCC
            color={ThemeColors2024.dark['neutral-title-1']}
          />
          <Text style={styles.accountText}>
            {accountsLength && accountsLength >= 10 ? '10' : accountsLength}
          </Text>
          <RcIconSmallArrowCC color={ThemeColors2024.dark['neutral-title-1']} />
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
        <Pressable
          onPress={e => {
            e.stopPropagation();
            toggleFoldMultiChart();
          }}
          hitSlop={10}
          pressRetentionOffset={10}
          style={[
            styles.changeSection,
            hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
          ]}>
          {isHidden ? (
            <Text>***</Text>
          ) : (
            <>
              <AnimateableText
                style={lossStyleProps}
                animatedProps={percentChangeAnimatedProps}
              />
              <AnimateableText
                style={styles.changeTime}
                animatedProps={dateTimeAnimatedProps}
              />
              <View style={styles.percentChangeContainer}>
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
              </View>
            </>
          )}
        </Pressable>
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
    width: ScreenWidth - 72,
    height: 114,
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
  hidden: {
    display: 'none',
  },
  accountBg: {
    minWidth: 74,
    padding: 8,
    paddingLeft: 11,
    borderRadius: 10,
    backgroundColor: isLight ? '#000000' : colors2024['brand-default'],
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
    color: ThemeColors2024.dark['neutral-title-1'],
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
