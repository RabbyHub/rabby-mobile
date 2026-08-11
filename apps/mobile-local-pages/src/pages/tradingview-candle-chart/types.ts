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
  candles: CandleStick[];
}
