import { RcIconInfoFillCC } from '@/assets/icons/common';
import { RcIconLong } from '@/assets2024/icons/perps';
import TradingViewCandleChart, {
  TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import { CANDLE_MENU_KEY, CANDLE_MENU_KEY_V2 } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatPercent, formatUsdValueKMB } from '@/screens/Home/utils/price';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Candle,
  CandleSnapshot,
  WsActiveAssetCtx,
} from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  AppStateStatus,
  Dimensions,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
  CandlestickSeries,
  ColorType,
  IPriceLine,
  CrosshairMode,
} from 'lightweight-charts';
import { CandlePeriod } from '@/components2024/TradingViewCandleChart/type';
import { splitNumberByStep } from '@/utils/number';
import { Skeleton } from '@rneui/base';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import { Text } from '@/components/Typography';

import TickerTexts, { TickItem } from '@/components/Animated/TickerText';
export interface ChartHoverData {
  time?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  isPositiveChange?: boolean;
  delta?: number;
  deltaPercent?: number;
  visible: boolean;
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '160px',
  position: 'relative',
};

const getInterval = (candleMenuKey: CANDLE_MENU_KEY_V2) => {
  switch (candleMenuKey) {
    case CANDLE_MENU_KEY_V2.FIVE_MINUTES:
      return CandlePeriod.FIVE_MINUTES;
    case CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES:
      return CandlePeriod.FIFTEEN_MINUTES;
    case CANDLE_MENU_KEY_V2.ONE_HOUR:
      return CandlePeriod.ONE_HOUR;
    case CANDLE_MENU_KEY_V2.FOUR_HOURS:
      return CandlePeriod.FOUR_HOURS;
    case CANDLE_MENU_KEY_V2.ONE_DAY:
      return CandlePeriod.ONE_DAY;
    case CANDLE_MENU_KEY_V2.ONE_WEEK:
      return CandlePeriod.ONE_WEEK;
    default:
      return CandlePeriod.FIVE_MINUTES;
  }
};

type CandleBar = CandlestickData<UTCTimestamp>;

const toUtc = (t: number): UTCTimestamp => Math.floor(t) as UTCTimestamp;

const getMondayUtc = (utcSeconds: number): UTCTimestamp => {
  const date = new Date(utcSeconds * 1000);
  const day = date.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const diffDays = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffDays);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000) as UTCTimestamp;
};

const aggregateDailyToWeekly = (dailyCandles: CandleBar[]): CandleBar[] => {
  if (dailyCandles.length === 0) {
    return [];
  }

  const weeks = new Map<number, CandleBar>();

  for (const candle of dailyCandles) {
    const mondayTs = getMondayUtc(candle.time as number);
    const existing = weeks.get(mondayTs);
    if (existing) {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    } else {
      weeks.set(mondayTs, {
        time: mondayTs,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      } as CandleBar);
    }
  }

  return Array.from(weeks.values()).sort(
    (a, b) => (a.time as number) - (b.time as number),
  );
};

const parseCandles = (data: CandleSnapshot): CandleBar[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const result = data.map((row: Candle) => {
    const candle = {
      time: toUtc(Number(row.t) / 1000),
      open: Number(row.o),
      high: Number(row.h),
      low: Number(row.l),
      close: Number(row.c),
      volume: Number(row.v),
    };
    return candle;
  });

  return result;
};

export const PerpsChart: React.FC<{
  marketName: string;
  coinNameRef: React.RefObject<string>;
  markPrice: number;
  currentAssetCtx?: MarketData;
  selectedInterval: CANDLE_MENU_KEY_V2;
  setSelectedInterval: (interval: CANDLE_MENU_KEY_V2) => void;
  activeAssetCtx?: WsActiveAssetCtx['ctx'] | null;
  lineTagInfo?: {
    tpPrice: number;
    slPrice: number;
    liquidationPrice: number;
    entryPrice: number;
  };
}> = ({
  marketName,
  coinNameRef,
  markPrice,
  currentAssetCtx,
  activeAssetCtx,
  lineTagInfo,
  selectedInterval,
  setSelectedInterval,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const chartWebViewRef = React.useRef<TradingViewChartRef>(null);
  const chartIsReadyRef = useRef(false);
  const [chartReadyCount, setChartReadyCount] = useState(0);
  const isReady = chartReadyCount > 0;
  // const [selectedInterval, setSelectedInterval] =
  //   React.useState<CANDLE_MENU_KEY_V2>(CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES);
  const unsubscribeRef = useRef<() => void>(() => {});
  const currentWeekCandleRef = useRef<CandleBar | null>(null);

  const CANDLE_MENU_ITEM = useMemo(
    () => [
      {
        label: '5M',
        key: CANDLE_MENU_KEY_V2.FIVE_MINUTES,
      },
      {
        label: '15M',
        key: CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES,
      },
      {
        label: '1H',
        key: CANDLE_MENU_KEY_V2.ONE_HOUR,
      },
      {
        label: '4H',
        key: CANDLE_MENU_KEY_V2.FOUR_HOURS,
      },
      {
        label: '1D',
        key: CANDLE_MENU_KEY_V2.ONE_DAY,
      },
      {
        label: '1W',
        key: CANDLE_MENU_KEY_V2.ONE_WEEK,
      },
    ],
    [],
  );

  const dayDelta = useMemo(() => {
    const prevDayPx = Number(
      activeAssetCtx?.prevDayPx || currentAssetCtx?.prevDayPx || 0,
    );
    return markPrice - prevDayPx;
  }, [activeAssetCtx, markPrice, currentAssetCtx]);

  const isPositiveChange = useMemo(() => {
    return dayDelta >= 0;
  }, [dayDelta]);

  const dayDeltaPercent = useMemo(() => {
    const prevDayPx = Number(
      activeAssetCtx?.prevDayPx || currentAssetCtx?.prevDayPx || 0,
    );
    return dayDelta / prevDayPx;
  }, [activeAssetCtx, currentAssetCtx, dayDelta]);

  const decimals = useMemo(() => {
    return currentAssetCtx?.pxDecimals || 2;
  }, [currentAssetCtx]);

  const { data: chartData, refresh: refreshChartData } = useRequest(
    async () => {
      const sdk = apisPerps.getPerpsSDK();

      const isWeekly = selectedInterval === CANDLE_MENU_KEY_V2.ONE_WEEK;
      // Weekly mode: fetch daily candles and aggregate client-side for Monday alignment
      const interval = isWeekly
        ? CandlePeriod.ONE_DAY
        : getInterval(selectedInterval);

      let start = 0;
      let end = Date.now();

      switch (selectedInterval) {
        case CANDLE_MENU_KEY_V2.FIVE_MINUTES:
          start = end - 1 * 24 * 60 * 60 * 1000; // 1 day
          break;
        case CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES:
          start = end - 7 * 24 * 60 * 60 * 1000; // 1 week
          break;
        case CANDLE_MENU_KEY_V2.ONE_HOUR:
          start = end - 1 * 30 * 24 * 60 * 60 * 1000; // 1 month
          break;
        case CANDLE_MENU_KEY_V2.FOUR_HOURS:
          start = end - 4 * 30 * 24 * 60 * 60 * 1000; // 4 months
          break;
        case CANDLE_MENU_KEY_V2.ONE_DAY:
          start = end - 12 * 30 * 24 * 60 * 60 * 1000; // 1 year
          break;
        case CANDLE_MENU_KEY_V2.ONE_WEEK:
          start = 0;
          break;
      }

      const snapshot = await sdk.info.candleSnapshot(
        marketName,
        interval,
        start,
        end,
      );

      const dailyCandles = parseCandles(snapshot);
      const candles = isWeekly
        ? aggregateDailyToWeekly(dailyCandles)
        : dailyCandles;

      // Track current week candle for real-time updates
      if (isWeekly && candles.length > 0) {
        currentWeekCandleRef.current = { ...candles[candles.length - 1]! };
      }

      const noTime =
        selectedInterval === CANDLE_MENU_KEY_V2.ONE_DAY ||
        selectedInterval === CANDLE_MENU_KEY_V2.ONE_WEEK;

      return {
        coin: marketName,
        interval: interval,
        fitContent: false,
        noTime,
        candles: candles as any,
      };
    },
    {
      refreshDeps: [marketName, selectedInterval],
      onSuccess(data) {
        if (chartIsReadyRef.current) {
          setChartReadyCount(c => c || 1);
          chartWebViewRef.current?.setData(data);
        }
      },
    },
  );

  const handleChartReady = useMemoizedFn(() => {
    chartIsReadyRef.current = true;
    // Increment counter to ensure useEffect re-triggers after WebView reload
    setChartReadyCount(c => c + 1);
  });

  const subscribeCandle = useMemoizedFn(() => {
    const sdk = apisPerps.getPerpsSDK();

    const isWeekly = selectedInterval === CANDLE_MENU_KEY_V2.ONE_WEEK;
    // Weekly mode: subscribe to daily candles, aggregate client-side
    const interval = isWeekly
      ? CandlePeriod.ONE_DAY
      : getInterval(selectedInterval);

    const { unsubscribe } = sdk.ws.subscribeToCandles(
      marketName,
      interval,
      snapshot => {
        if (coinNameRef.current !== snapshot.s) {
          return;
        }

        const candles = parseCandles([snapshot]);
        if (candles.length === 0) {
          return;
        }

        if (isWeekly) {
          const daily = candles[0]!;
          const mondayTs = getMondayUtc(daily.time as number);
          const current = currentWeekCandleRef.current;

          if (current && current.time === mondayTs) {
            // Same week: merge high/low, update close
            current.high = Math.max(current.high, daily.high);
            current.low = Math.min(current.low, daily.low);
            current.close = daily.close;
          } else {
            // New week starts
            currentWeekCandleRef.current = {
              time: mondayTs,
              open: daily.open,
              high: daily.high,
              low: daily.low,
              close: daily.close,
            } as CandleBar;
          }
          chartWebViewRef.current?.updateCandleData(
            currentWeekCandleRef.current! as any,
          );
        } else {
          chartWebViewRef.current?.updateCandleData(candles[0] as any);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  });

  // Subscribe to real-time candle updates
  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    const unsubscribe = subscribeCandle();
    unsubscribeRef.current = unsubscribe;
    return () => {
      unsubscribe?.();
    };
  }, [subscribeCandle, marketName, selectedInterval]);

  // Sync chart data when both chart is ready and data is available
  // Use chartReadyCount (not boolean isReady) so WebView reloads also trigger re-send
  useEffect(() => {
    if (chartReadyCount > 0 && chartData) {
      chartWebViewRef.current?.setData(chartData);
    }
  }, [chartReadyCount, chartData]);

  useEffect(() => {
    if (chartReadyCount > 0 && chartData && lineTagInfo) {
      chartWebViewRef.current?.updateTPSLPriceLines(lineTagInfo);
    }
  }, [chartReadyCount, lineTagInfo, chartData]);

  // Re-subscribe and refresh data when app returns to foreground
  useEffect(() => {
    let appStateRef = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // Re-subscribe candle WebSocket
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
          }
          const unsubscribe = subscribeCandle();
          unsubscribeRef.current = unsubscribe;

          // Refresh historical chart data
          refreshChartData();
        }
        appStateRef = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [subscribeCandle, refreshChartData]);

  // // Reset chart when market changes
  // useEffect(() => {
  //   // Reset chart state
  //   setIsReady(false);
  //   chartIsReadyRef.current = false;

  //   // Unsubscribe from previous market
  //   if (unsubscribeRef.current) {
  //     unsubscribeRef.current();
  //     unsubscribeRef.current = () => {};
  //   }
  // }, [market.name]);

  return (
    <View style={styles.chart}>
      <View style={styles.header}>
        <TickerTexts textStyle={styles.priceText} duration={750}>
          <TickItem rotateItems={['$']}>{'$'}</TickItem>
          {splitNumberByStep(markPrice || 0)}
        </TickerTexts>
        <Text
          style={[
            styles.changeText,
            isPositiveChange ? styles.positive : styles.negative,
          ]}>
          {isPositiveChange ? '+' : '-'}$
          {splitNumberByStep(Math.abs(dayDelta).toFixed(decimals))} (
          {isPositiveChange ? '+' : ''}
          {formatPercent(dayDeltaPercent, 2)})
        </Text>
      </View>
      <View style={styles.content}>
        {!isReady ? (
          <View style={styles.skeletonContainer}>
            <Skeleton
              width={'100%'}
              height={150}
              style={styles.skeleton}
              LinearGradientComponent={LoadingLinear}
            />
          </View>
        ) : null}
        <TradingViewCandleChart
          style={isReady ? null : styles.opacity0}
          ref={chartWebViewRef}
          height={Dimensions.get('screen').width - 128}
          // backGroundColor={
          //   isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2']
          // }
          onChartReady={handleChartReady}
        />
      </View>
      <View style={styles.menu}>
        {CANDLE_MENU_ITEM.map(item => {
          const isActive = item.key === selectedInterval;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                setSelectedInterval(item.key);
              }}
              style={[
                styles.menuItem,
                isActive ? styles.menuItemActive : null,
              ]}>
              <Text
                style={[
                  styles.menuLabel,
                  isActive ? styles.menuLabelActive : null,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  chart: {
    // backgroundColor: isLight
    //   ? colors2024['neutral-bg-1']
    //   : colors2024['neutral-bg-2'],
    // paddingVertical: 24,
    borderRadius: 20,
    // paddingHorizontal: 16,
  },
  content: {
    // paddingHorizontal: 16,
    // paddingRight: 4,
    position: 'relative',
  },
  menu: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    paddingHorizontal: 16,
  },
  menuItem: {
    flex: 1,
    paddingVertical: 4,
  },
  menuItemActive: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 6,
  },
  menuLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  menuLabelActive: {
    fontWeight: '700',
    color: colors2024['neutral-body'],
  },
  header: {
    marginBottom: 9,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  priceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  changeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  positive: {
    color: colors2024['green-default'],
  },
  negative: {
    color: colors2024['red-default'],
  },
  skeletonContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  skeleton: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  opacity0: {
    opacity: 0,
  },
}));
