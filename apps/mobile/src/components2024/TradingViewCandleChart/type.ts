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
  /** Opt in only on iOS Simple, where a native gesture owns the price axis. */
  nativePriceAxis?: boolean;
  colors: {
    background: string;
    titleOutline?: string;
    selectionBackground?: string;
    selectionText?: string;
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
export type SimpleRangeCoverage = {
  kind: 'complete' | 'short' | 'gap' | 'unavailable' | 'daily';
  start: number | null;
};
export type SimpleChartFill = { time: number; side: string };
export type SimpleChartMessage = {
  type: 'PERPS_SIMPLE_CHART';
  identity: string;
  sequence: number;
} & (
  | { action: 'configure'; config: SimpleChartConfig }
  | {
      action: 'replace';
      config: SimpleChartConfig;
      candles: CandleStick[];
      sourceStartTime?: number;
    }
  | {
      action: 'data';
      sourceStartTime?: number;
      candles: CandleStick[];
      preserve: boolean;
      state: 'idle' | 'loading' | 'ready' | 'empty' | 'stale' | 'error';
    }
  | { action: 'activity'; active: boolean }
  | {
      action: 'priceAxis';
      phase: 'start' | 'move' | 'end' | 'cancel';
      session: number;
      gestureId: number;
      deltaY: number;
    }
  | { action: 'update'; candle: CandleStick }
  | {
      action: 'overlays';
      accountKey: string;
      fills: SimpleChartFill[];
      prices: {
        entryPrice?: number;
        liquidationPrice?: number;
        /** Display-only text shared with the Simple position card. */
        liquidationPriceText?: string;
        /** Display-only text shared with the Simple position card. */
        entryPriceText?: string;
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
  | {
      event: 'applied';
      sequence: number;
      referencePrice: number | null;
      coverage?: SimpleRangeCoverage;
    }
  | {
      event: 'rangeReference';
      referencePrice: number | null;
      coverage?: SimpleRangeCoverage;
    }
  | { event: 'selection'; candle: CandleStick | null; timeText?: string }
  | {
      event: 'viewport';
      presentationSequence: number;
      priceAxisSession: number;
      style: SimpleChartConfig['style'];
      resetVisible: boolean;
      latestVisible: boolean;
      paneWidth: number;
      paneHeight: number;
    }
  | { event: 'history' }
);
