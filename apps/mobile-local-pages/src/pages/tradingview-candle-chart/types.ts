export interface CandleStick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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
  tooltip: {
    bg: string;
    title: string;
    value: string;
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
  candles: CandleStick[];
}
