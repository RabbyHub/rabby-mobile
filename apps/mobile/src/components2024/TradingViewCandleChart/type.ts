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
