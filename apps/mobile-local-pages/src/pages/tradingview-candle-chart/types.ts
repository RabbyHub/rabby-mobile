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

export interface PerpsProChartConfig {
  baseAsset: string;
  initialVisibleBars: number;
  interval:
    | '1m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '4h'
    | '8h'
    | '12h'
    | '1d'
    | '1w'
    | '1M';
  maPeriods: readonly [7, 25, 99];
  priceDecimals: number;
  quoteAsset: string;
  variant: 'perps-pro';
}

export interface ChartColors {
  background: string;
  text: string;
  border: string;
  secondaryText: string;
  greenLineColor: string;
  redLineColor: string;
  highPriceLineColor: string;
  lowPriceLineColor: string;
  emptyPrimary: string;
  emptySecondary: string;
  emptyStroke: string;
  ma: {
    7: string;
    25: string;
    99: string;
  };
  tooltip: {
    bg: string;
    border: string;
    title: string;
    value: string;
  };
  crosshairLabel: {
    background: string;
    text: string;
  };
}

export interface ChartDescription {
  tp: string;
  entry: string;
  sl: string;
  liq: string;
  high: string;
  low: string;
  time: string;
  open: string;
  close: string;
  chg: string;
  chgPercent: string;
  volume: string;
  vol: string;
  range: string;
  txn: string;
  empty: string;
}

export interface TPSLPriceLines {
  tpPrice?: number;
  slPrice?: number;
  liquidationPrice?: number;
  entryPrice?: number;
}

export interface CandleData {
  coin?: string;
  interval?: string;
  showVolume?: boolean;
  fitContent?: boolean;
  noTime?: boolean;
  proConfig?: PerpsProChartConfig;
  preserveVisibleRange?: boolean;
  candles: CandleStick[];
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
