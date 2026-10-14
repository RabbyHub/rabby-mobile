import type { PerpsCandleInterval } from '@/constant/perps';

export interface CandleStick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  trades?: number | null;
  quoteTurnover?: number | null;
}

export enum CandlePeriod {
  ONE_MINUTE = '1m',
  THREE_MINUTES = '3m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  TWO_HOURS = '2h',
  FOUR_HOURS = '4h',
  EIGHT_HOURS = '8h',
  TWELVE_HOURS = '12h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1M',
}

export interface CandleData {
  coin: string;
  interval: CandlePeriod | PerpsCandleInterval;
  identity?: string;
  revision?: number;
  showVolume?: boolean;
  fitContent?: boolean;
  noTime?: boolean;
  proConfig?: PerpsProCandleChartConfig;
  preserveVisibleRange?: boolean;
  candles: CandleStick[];
}

export interface PerpsProCandleChartConfig {
  baseAsset: string;
  initialVisibleBars: number;
  interval: PerpsCandleInterval;
  maPeriods: readonly [7, 25, 99];
  priceDecimals: number;
  quoteAsset: string;
  variant: 'perps-pro';
}

/** Simple is an opt-in protocol; legacy and Pro messages keep their contracts. */
export type SimpleChartConfig = {
  style: 'candle' | 'area';
  range: '1D' | '1W' | '1M' | '3M' | '1Y' | null;
  interval: string;
  priceDecimals: number;
  showTradeMarkers?: boolean;
  colors: {
    background: string;
    text: string;
    grid: string;
    secondary: string;
    entry: string;
    entryBackground: string;
    entryText: string;
    up: string;
    down: string;
    accent: string;
    areaTop: string;
    areaBottom: string;
    contrast: string;
    liquidation: string;
  };
  labels: {
    entry: string;
    tp: string;
    sl: string;
    liq: string;
    buy: string;
    sell: string;
    empty: string;
  };
};
export type SimpleChartFill = { time: number; side: string };
export type SimpleChartMessage = {
  type: 'PERPS_SIMPLE_CHART';
  identity: string;
  sequence: number;
} & (
  | { action: 'configure'; config: SimpleChartConfig }
  | { action: 'replace'; config: SimpleChartConfig; candles: CandleStick[] }
  | {
      action: 'data';
      candles: CandleStick[];
      preserve: boolean;
      state: 'idle' | 'loading' | 'ready' | 'empty' | 'stale' | 'error';
    }
  | { action: 'activity'; active: boolean }
  | { action: 'update'; candle: CandleStick }
  | {
      action: 'overlays';
      accountKey: string;
      fills: SimpleChartFill[];
      prices: {
        entryPrice?: number;
        liquidationPrice?: number;
        tpPrice?: number;
        slPrice?: number;
      };
    }
  | { action: 'historyComplete'; outcome: 'loaded' | 'exhausted' | 'retry' }
  | { action: 'reset' | 'latest' | 'clearSelection' }
);
export type SimpleChartEvent = {
  type: 'PERPS_SIMPLE_EVENT';
  identity: string;
} & (
  | { event: 'applied'; sequence: number; referencePrice: number | null }
  | { event: 'rangeReference'; referencePrice: number | null }
  | { event: 'selection'; candle: CandleStick | null }
  | {
      event: 'viewport';
      resetVisible: boolean;
      latestVisible: boolean;
      paneWidth: number;
      paneHeight: number;
    }
  | { event: 'history' }
);
