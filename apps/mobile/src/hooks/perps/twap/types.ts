export type PerpsTwapState = {
  coin: string;
  user: string;
  side: 'A' | 'B';
  sz: string;
  executedSz: string;
  executedNtl: string;
  minutes: number;
  reduceOnly: boolean;
  randomize: boolean;
  timestamp: number;
  trigger?: { px: string } | null;
  stopPx?: string | null;
};

export type PerpsTwapRecord = {
  key: string;
  twapId: number;
  state: PerpsTwapState;
  status: string;
  description?: string;
  endedAt: number | null;
  eventTime: number;
  active: boolean;
};

export type PerpsTwapFill = {
  key: string;
  twapId: number;
  coin: string;
  tid: number;
  oid: number;
  time: number;
  side: 'A' | 'B';
  px: string;
  sz: string;
  fee: string;
  feeToken: string;
};

export type PerpsTwapStatus =
  | 'working'
  | 'waiting'
  | 'filled'
  | 'cancelled'
  | 'expired'
  | 'unknown';

export const getPerpsTwapKey = (coin: string, twapId: number) =>
  `${coin}:${twapId}`;
