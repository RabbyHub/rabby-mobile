import { RcIconInfoFillCC } from '@/assets/icons/common';
import { RcIconLong } from '@/assets2024/icons/perps';
import TradingViewCandleChart, {
  TradingViewChartRef,
} from '@/components2024/TradingViewCandleChart';
import { CANDLE_MENU_KEY } from '@/constant/perps';
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
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
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

const getInterval = (candleMenuKey: CANDLE_MENU_KEY) => {
  switch (candleMenuKey) {
    case CANDLE_MENU_KEY.ONE_HOUR:
      return CandlePeriod.ONE_MINUTE;
    case CANDLE_MENU_KEY.ONE_DAY:
      return CandlePeriod.ONE_HOUR;
    case CANDLE_MENU_KEY.ONE_WEEK:
      return CandlePeriod.FOUR_HOURS;
    case CANDLE_MENU_KEY.ONE_MONTH:
      return CandlePeriod.TWELVE_HOURS;
    case CANDLE_MENU_KEY.YTD:
      return CandlePeriod.ONE_DAY;
    case CANDLE_MENU_KEY.ALL:
      return CandlePeriod.ONE_DAY;
    default:
      return CandlePeriod.ONE_DAY;
  }
};

type CandleBar = CandlestickData<UTCTimestamp>;

const toUtc = (t: number): UTCTimestamp => Math.floor(t) as UTCTimestamp;

// todo fix any
const parseCandles = (data: CandleSnapshot): any[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  const result = data.map((row: Candle) => {
    const candle = {
      time: toUtc(Number(row.t) / 1000),
      // time: Number(row.t),
      open: Number(row.o),
      high: Number(row.h),
      low: Number(row.l),
      close: Number(row.c),
      // todo check this line
      volume: Number(row.v),
    };
    return candle;
  });

  return result;
};

export const PerpsChart: React.FC<{
  market: MarketData;
  markPrice: number;
  currentAssetCtx?: MarketData;
  activeAssetCtx?: WsActiveAssetCtx['ctx'] | null;
  lineTagInfo?: {
    tpPrice: number;
    slPrice: number;
    liquidationPrice: number;
    entryPrice: number;
  };
}> = ({ market, markPrice, currentAssetCtx, activeAssetCtx, lineTagInfo }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const chartWebViewRef = React.useRef<TradingViewChartRef>(null);
  const chartIsReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [selectedInterval, setSelectedInterval] =
    React.useState<CANDLE_MENU_KEY>(CANDLE_MENU_KEY.ONE_DAY);

  const CANDLE_MENU_ITEM = useMemo(
    () => [
      {
        label: '1H',
        key: CANDLE_MENU_KEY.ONE_HOUR,
      },
      {
        label: '1D',
        key: CANDLE_MENU_KEY.ONE_DAY,
      },
      {
        label: '1W',
        key: CANDLE_MENU_KEY.ONE_WEEK,
      },
      {
        label: '1M',
        key: CANDLE_MENU_KEY.ONE_MONTH,
      },
      {
        label: 'YTD',
        key: CANDLE_MENU_KEY.YTD,
      },
      {
        label: 'ALL',
        key: CANDLE_MENU_KEY.ALL,
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

  const { data: chartData } = useRequest(
    async () => {
      const sdk = apisPerps.getPerpsSDK();
      // if (!seriesRef.current) return;

      let start = 0;
      let end = Date.now();

      const interval = getInterval(selectedInterval);

      switch (selectedInterval) {
        case CANDLE_MENU_KEY.ONE_HOUR:
          start = end - 1 * 60 * 60 * 1000;
          break;
        case CANDLE_MENU_KEY.ONE_DAY:
          start = end - 1 * 24 * 60 * 60 * 1000;
          break;
        case CANDLE_MENU_KEY.ONE_WEEK:
          start = end - 1 * 7 * 24 * 60 * 60 * 1000;
          break;
        case CANDLE_MENU_KEY.ONE_MONTH:
          start = end - 1 * 30 * 24 * 60 * 60 * 1000;
          break;
        case CANDLE_MENU_KEY.YTD:
          start = new Date(new Date().getFullYear(), 0, 1).getTime();
          end = Date.now();
          break;
        case CANDLE_MENU_KEY.ALL:
          start = 0;
          end = Date.now();
          break;
      }

      const snapshot = await sdk.info.candleSnapshot(
        market.name,
        interval,
        start,
        end,
      );

      const candles = parseCandles(snapshot);
      // if (candles.length > 0 && seriesRef.current) {
      //   seriesRef.current.setData(candles);
      //   chartRef.current?.timeScale().fitContent();
      //   // Update price lines after data is loaded
      //   // updatePriceLines();
      // }
      return {
        coin: market.name,
        interval: interval,
        fitContent: true,
        candles: candles as any,
      };
    },
    {
      refreshDeps: [market.name, selectedInterval],
      onSuccess(data) {
        if (chartIsReadyRef.current) {
          setIsReady(true);
          chartWebViewRef.current?.setData(data);
        }
      },
    },
  );

  const handleChartReady = useMemoizedFn(() => {
    setTimeout(() => {
      chartIsReadyRef.current = true;
      if (chartData) {
        chartWebViewRef.current?.setData(chartData);
      }
    }, 0);
  });

  const subscribeCandle = useMemoizedFn(() => {
    const sdk = apisPerps.getPerpsSDK();
    // if (!seriesRef.current) return;

    const interval = getInterval(selectedInterval);
    console.log('subscribeCandle', market, interval);
    const { unsubscribe } = sdk.ws.subscribeToCandles(
      market.name,
      interval,
      snapshot => {
        // Check if component is still mounted before updating
        // if (!isMountedRef.current || !seriesRef.current) return;

        const candles = parseCandles([snapshot]);
        if (candles.length > 0) {
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
    const unsubscribe = subscribeCandle();

    return () => {
      // Cleanup WebSocket subscription
      unsubscribe?.();
    };
  }, [subscribeCandle, selectedInterval, market.name]);

  useEffect(() => {
    if (isReady && lineTagInfo) {
      chartWebViewRef.current?.updateTPSLPriceLines(lineTagInfo);
    }
  }, [isReady, lineTagInfo]);

  return (
    <View style={styles.chart}>
      <View style={styles.header}>
        <Text style={styles.priceText}>
          ${splitNumberByStep(markPrice || 0)}
        </Text>
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
        <TradingViewCandleChart
          ref={chartWebViewRef}
          height={Dimensions.get('screen').width - 128}
          backGroundColor={
            isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2']
          }
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingVertical: 24,
    borderRadius: 20,
    // paddingHorizontal: 16,
  },
  content: {
    paddingHorizontal: 16,
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
    alignItems: 'center',
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
}));
