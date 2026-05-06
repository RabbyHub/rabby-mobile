import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTheme2024 } from '@/hooks/theme';
import { CurvePoint } from '@/hooks/useCurve';
import {
  formatSmallCurrencyValueParts,
  isCurrencyPrefix,
} from '@/utils/currency';
import React, { memo, useMemo } from 'react';
import { Dimensions, Pressable, useWindowDimensions, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import Animated, {
  Easing,
  makeMutable,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { CurveLoader } from '@/screens/TokenDetail/components/TokenPriceChart/CurveLoader';
import { useCurrency } from '@/hooks/useCurrency';
import { BALANCE_HIDE_TYPE } from '@/screens/Home/hooks/useHideBalance';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import RcIconSmallWalletCC from '@/assets2024/icons/home/IconSmallWalletCC.svg';
import RcIconSmallArrowCC from '@/assets2024/icons/home/IconSmallArrowCC.svg';
import { E2E_ID } from '@/constant/e2e';
import Svg, { Path } from 'react-native-svg';
import { refreshDayCurve } from '@/store/curve24h';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { Text, AnimateableText } from '@/components/Typography';
import { useHomePortfolioStore } from '@/screens/Home/hooks/useHomePortfolioSummary';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { useShallow } from 'zustand/react/shallow';
import { formatUsdValue } from '@/utils/number';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSVG = Animated.createAnimatedComponent(Svg);
const ScreenWidth = Dimensions.get('screen').width;
const CHART_HORIZONTAL_INSET = 66;

const MAX_NETWORTH_FS = 38;
const MIN_NETWORTH_FS = 34;
const NETWORTH_FIT_LEN = 8;
type DisplayCurvePoint = CurvePoint & {
  netWorthAmount: string;
};

const svIsFoldMultiChart = makeMutable(true);

export function setIsFoldMultiChart(valOrFunc: UpdaterOrPartials<boolean>) {
  'worklet';
  const { newVal } = resolveValFromUpdater(
    svIsFoldMultiChart.value,
    valOrFunc,
    {
      strict: false,
    },
  );
  svIsFoldMultiChart.value = newVal;
}

export function getIsFoldMultiChart() {
  return !!svIsFoldMultiChart.value;
}

const ChartContent = memo(function ChartContent({
  data: chartsData,
  isLoss,
  isAnyAddrLoading,
  hideType,
}: {
  isLoss: boolean;
  isAnyAddrLoading: boolean;
  hideType: BALANCE_HIDE_TYPE;
  data: CurvePoint[];
}) {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const { width: winWidth } = useWindowDimensions();

  const pathColor = useMemo(
    () => (!isLoss ? colors2024['green-default'] : colors2024['red-default']),
    [colors2024, isLoss],
  );

  const CHART_HEIGHT = 114;

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(svIsFoldMultiChart.value ? 0 : CHART_HEIGHT, {
        easing: svIsFoldMultiChart.value
          ? Easing.inOut(Easing.ease)
          : Easing.inOut(Easing.cubic),
        duration: svIsFoldMultiChart.value ? 200 : 300,
      }),
      opacity: withTiming(svIsFoldMultiChart.value ? 0 : 1, {
        easing: Easing.inOut(Easing.ease),
        duration: 200,
      }),
    };
  });

  return (
    <Animated.View style={[animatedContainerStyle]}>
      {!chartsData.length ? null : !isAnyAddrLoading ? (
        <LineChart
          height={CHART_HEIGHT}
          width={winWidth - CHART_HORIZONTAL_INSET}
          shape={d3Shape.curveCatmullRom}
          style={[
            styles.relative,
            (hideType === 'HIDE' || hideType === 'HALF_HIDE') &&
              styles.balanceOpacity,
          ]}>
          <LineChart.Path showInactivePath={false} color={pathColor} width={2}>
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
        <CurveLoader
          {...makeTestIDProps(E2E_ID.home.portfolioCurveLoading)}
          style={styles.loading}
        />
      )}
    </Animated.View>
  );
});

export const MultiChart = memo(function MultiChart({
  hideType,
  style,
}: {
  hideType: BALANCE_HIDE_TYPE;
} & RNViewProps) {
  const { styles } = useTheme2024({ getStyle });
  const {
    curveList,
    changeData,
    totalBalance,
    matteredAccountLength,
    showBalanceLoadingWithoutLocal,
    showChangeLoadingWithoutLocal,
    isCurveAnyAddrLoading,
  } = useHomePortfolioStore(
    useShallow(state => ({
      curveList: state.curveList,
      changeData: state.changeData,
      totalBalance: state.totalBalance,
      matteredAccountLength: state.matteredAccountLength,
      showBalanceLoadingWithoutLocal: state.showBalanceLoadingWithoutLocal,
      showChangeLoadingWithoutLocal: state.showChangeLoadingWithoutLocal,
      isCurveAnyAddrLoading: state.isCurveAnyAddrLoading,
    })),
  );

  useRendererDetect({ name: 'MultiAssets-MultiChart' });

  const chartsData = curveList;

  return (
    <View
      style={[styles.container, style]}
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
            rawNetWorth={totalBalance}
            rawChange={changeData.rawChange}
            changePercent={changeData.changePercent}
            isLoss={changeData.isLoss}
            data={chartsData}
            hideType={hideType}
            matteredAccountCount={matteredAccountLength}
            showBalanceLoadingWithoutLocal={showBalanceLoadingWithoutLocal}
            showChangeLoadingWithoutLocal={showChangeLoadingWithoutLocal}
          />
          <ChartContent
            data={chartsData}
            hideType={hideType}
            isLoss={changeData.isLoss}
            isAnyAddrLoading={isCurveAnyAddrLoading}
          />
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
  matteredAccountCount?: number;
  showBalanceLoadingWithoutLocal: boolean;
  showChangeLoadingWithoutLocal: boolean;
}
const ChartHeader = React.memo(
  ({
    rawNetWorth,
    rawChange,
    changePercent: _changePercent,
    isLoss,
    hideType,
    data: _data,
    matteredAccountCount,
    showBalanceLoadingWithoutLocal,
    showChangeLoadingWithoutLocal,
  }: IHeaderProps) => {
    const { reanimatedStyles, styles, colors2024 } = useTheme2024({ getStyle });
    const rStyles = {
      charHeader: useAnimatedStyle(reanimatedStyles.charHeader),
    };
    const { currentIndex } = LineChart.useChart();
    const { currency } = useCurrency();
    const isPostfixCurrency = !isCurrencyPrefix(currency);
    const debouncedRawChange = useDebouncedValue(rawChange, 300);
    const showNetWorthLoading = useMemo(() => {
      return showBalanceLoadingWithoutLocal;
    }, [showBalanceLoadingWithoutLocal]);
    const changePercent = useDebouncedValue(_changePercent, 300);
    const showChangeLoading =
      showNetWorthLoading || showChangeLoadingWithoutLocal;

    const netWorthParts = useMemo(() => {
      return formatSmallCurrencyValueParts(rawNetWorth, { currency });
    }, [currency, rawNetWorth]);
    const netWorth = netWorthParts.text;
    const change = useMemo(() => {
      return formatUsdValue(Math.abs(debouncedRawChange));
    }, [debouncedRawChange]);

    const data = useMemo<DisplayCurvePoint[]>(() => {
      return (
        _data?.map(item => {
          const itemNetWorthParts = formatSmallCurrencyValueParts(item.value, {
            currency,
          });
          return {
            ...item,
            netWorth: itemNetWorthParts.text,
            netWorthAmount: itemNetWorthParts.amountText,
            change: formatUsdValue(Math.abs(item.rawChange)),
          };
        }) || []
      );
    }, [_data, currency]);

    const percentChange = useDerivedValue(() => {
      if (hideType === 'HIDE') {
        return '***';
      }
      const isActiveIndexData =
        data?.[currentIndex?.value]?.changePercent !== undefined;
      const formatChangeValue = isActiveIndexData
        ? data?.[currentIndex.value]?.change ?? change
        : change;
      const formatChangePercent = isActiveIndexData
        ? data?.[currentIndex.value]?.changePercent ?? changePercent
        : changePercent;
      const formatLoss = isActiveIndexData
        ? data?.[currentIndex.value]?.isLoss ?? isLoss
        : isLoss;
      if (!formatChangePercent) {
        return '';
      }
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
      if (hideType === 'HIDE') {
        return '******';
      }
      if (svIsFoldMultiChart.value) {
        return isPostfixCurrency ? netWorthParts.amountText : netWorth;
      }
      const activeData = data?.[currentIndex?.value];
      if (isPostfixCurrency) {
        return activeData?.netWorthAmount || netWorthParts.amountText;
      }
      return activeData?.netWorth || netWorth;
    }, [
      data,
      currentIndex,
      netWorth,
      netWorthParts.amountText,
      hideType,
      isPostfixCurrency,
    ]);

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

    const netWorthFontStyle = useAnimatedStyle(() => {
      // TODO: should be using adjustFontSizeToFit, fix it upstream first
      const len = formatNetWorth.value?.length ?? 0;
      const fs = len <= NETWORTH_FIT_LEN ? MAX_NETWORTH_FS : MIN_NETWORTH_FS;
      return { fontSize: fs };
    });

    const netWorthAnimatedProps = useAnimatedProps(() => {
      return {
        text: formatNetWorth.value,
      };
    }, [netWorth, netWorthParts.amountText, hideType, isPostfixCurrency]);

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

    const arrowRotation = useDerivedValue(() => {
      return withTiming(svIsFoldMultiChart.value ? 90 : -90, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    });
    const animatedSvgStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${arrowRotation.value}deg` }],
      };
    });

    const isHidden = useMemo(() => {
      return hideType === 'HIDE';
    }, [hideType]);

    return (
      <Animated.View style={rStyles.charHeader}>
        <View style={styles.netWorthContainer}>
          <View
            style={[
              styles.netWorthTextContainer,
              showNetWorthLoading ? styles.hidden : undefined,
            ]}
            {...makeTestIDProps(E2E_ID.home.portfolioBalanceValue)}>
            <View style={styles.netWorthInline}>
              <AnimateableText
                style={[
                  styles.netWorth,
                  netWorthFontStyle,
                  hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
                ]}
                animatedProps={netWorthAnimatedProps}
              />
              {isPostfixCurrency && !isHidden ? (
                <Text
                  style={[
                    styles.netWorthSuffix,
                    hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
                  ]}>
                  {currency.symbol}
                </Text>
              ) : null}
            </View>
          </View>

          <Skeleton
            {...makeTestIDProps(E2E_ID.home.portfolioBalanceLoading)}
            width={181}
            height={44}
            style={[
              styles.skeletonNetWorth,
              !showNetWorthLoading && styles.hidden,
            ]}
            LinearGradientComponent={LoadingLinear}
          />

          <View style={[styles.accountBg]}>
            <RcIconSmallWalletCC color={colors2024['neutral-title-1']} />
            <Text style={styles.accountText}>
              {matteredAccountCount && matteredAccountCount >= 10
                ? '10'
                : matteredAccountCount}
            </Text>
            <RcIconSmallArrowCC color={colors2024['neutral-title-1']} />
          </View>
        </View>
        {showChangeLoading ? (
          <Skeleton
            {...makeTestIDProps(E2E_ID.home.portfolioChangeLoading)}
            width={100}
            height={22}
            style={styles.skeletonNetWorth}
            LinearGradientComponent={LoadingLinear}
          />
        ) : (
          <Pressable
            {...makeTestIDProps(E2E_ID.home.portfolioCurveToggle)}
            onPress={e => {
              e.stopPropagation();
              const nextValue = !svIsFoldMultiChart.value;
              svIsFoldMultiChart.value = nextValue;
              if (!nextValue) {
                refreshDayCurve({
                  force: false,
                  reason: 'manual_refresh',
                });
              }
            }}
            hitSlop={10}
            pressRetentionOffset={10}
            style={[
              styles.changeSection,
              hideType === 'HALF_HIDE' ? styles.balanceOpacity : null,
            ]}>
            {isHidden ? (
              <Text style={{ color: colors2024['neutral-title-1'] }}>***</Text>
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
                  <AnimatedSVG
                    style={animatedSvgStyle}
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
                  </AnimatedSVG>
                </View>
              </>
            )}
          </Pressable>
        )}
      </Animated.View>
    );
  },
);
const winWidth = Dimensions.get('window').width;
const getStyle = createGetStyles2024(
  {
    reanimatedStyles: {
      charHeader: ({ colors2024: _colors2024, winLayout }) => {
        'worklet';
        return {
          alignContent: 'flex-start',
          justifyContent: 'flex-start',
          flexDirection: 'column',
          maxWidth:
            Math.max(winWidth, winLayout.value.width) - CHART_HORIZONTAL_INSET,
          gap: 4,
          // ...makeDebugBorder('blue'),
        };
      },
    },
  },
  ({ colors2024, isLight }) => ({
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
    netWorth: {
      lineHeight: 46,
      fontWeight: '800',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    netWorthInline: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    netWorthSuffix: {
      marginLeft: 4,
      marginTop: 15,
      fontSize: 16,
      lineHeight: 31,
      fontWeight: '700',
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
      maxWidth: '100%',
      // height: HEADER_CHART_HEIGHT,
      paddingHorizontal: 0,
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
      overflow: 'hidden',
      // ...makeDebugBorder('red'),
    },
    chartContainer: {},
    globalWarning: {
      marginHorizontal: 16,
      marginBottom: 13,
    },
    loading: {
      width: ScreenWidth - CHART_HORIZONTAL_INSET,
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
      // ...makeDebugBorder('orange'),
      lineHeight: 46,
    },
    netWorthTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    hidden: {
      display: 'none',
    },
    accountBg: {
      minWidth: 74,
      padding: 8,
      paddingLeft: 11,
      borderRadius: 10,
      backgroundColor: isLight
        ? colors2024['neutral-line']
        : colors2024['brand-default'],
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
  }),
);
