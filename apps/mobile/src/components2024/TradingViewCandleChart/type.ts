export interface CandleStick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  interval: CandlePeriod;
  showVolume?: boolean;
  fitContent?: boolean;
  candles: CandleStick[];
}
