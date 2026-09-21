import type { FundingHistoryItem } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;
const FUNDING_INTERVAL_HOURS = 1;
const FUNDING_HISTORY_LOOKBACK_INTERVALS = 6;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const FUNDING_INTERVAL_MS =
  FUNDING_INTERVAL_HOURS *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

export const PERPS_PRO_FUNDING_SCHEDULE = Object.freeze({
  countdownRefreshMs: MILLISECONDS_PER_SECOND,
  historyLookbackIntervals: FUNDING_HISTORY_LOOKBACK_INTERVALS,
  historyLookbackMs: FUNDING_HISTORY_LOOKBACK_INTERVALS * FUNDING_INTERVAL_MS,
  intervalHours: FUNDING_INTERVAL_HOURS,
  intervalLabel: `${FUNDING_INTERVAL_HOURS}h`,
  intervalMs: FUNDING_INTERVAL_MS,
  intervalsPerYear: (HOURS_PER_DAY * DAYS_PER_YEAR) / FUNDING_INTERVAL_HOURS,
});

export type PerpsServerClockSample = {
  receivedAt: number;
  serverTime: number;
};

export type PerpsFundingDirection =
  | 'long-pays-short'
  | 'short-pays-long'
  | 'none';

export type PerpsEstimatedFundingState =
  | {
      status: 'loading-account' | 'no-position' | 'missing-market-data';
      value: null;
    }
  | {
      status: 'ready';
      value: number;
    };

const toBigNumber = (value: string | number | null | undefined) => {
  const result = new BigNumber(value ?? Number.NaN);
  return result.isFinite() ? result : null;
};

export const annualizePerpsFundingRate = (
  rate: string | number | null | undefined,
) => {
  const value = toBigNumber(rate);
  return value
    ? value.multipliedBy(PERPS_PRO_FUNDING_SCHEDULE.intervalsPerYear).toNumber()
    : null;
};

export const getPerpsFundingDirection = (
  rate: string | number | null | undefined,
): PerpsFundingDirection => {
  const value = toBigNumber(rate);
  if (!value || value.isZero()) {
    return 'none';
  }
  return value.isGreaterThan(0) ? 'long-pays-short' : 'short-pays-long';
};

export const getEstimatedPerpsServerTime = (
  sample: PerpsServerClockSample | null,
  now: number,
) => {
  if (
    !sample ||
    !Number.isFinite(sample.serverTime) ||
    !Number.isFinite(sample.receivedAt) ||
    !Number.isFinite(now)
  ) {
    return null;
  }
  return sample.serverTime + Math.max(0, now - sample.receivedAt);
};

export const getNextPerpsFundingTime = (serverTime: number) => {
  if (!Number.isFinite(serverTime)) {
    return null;
  }
  return (
    (Math.floor(serverTime / PERPS_PRO_FUNDING_SCHEDULE.intervalMs) + 1) *
    PERPS_PRO_FUNDING_SCHEDULE.intervalMs
  );
};

export const getPerpsFundingCountdownMs = (
  sample: PerpsServerClockSample | null,
  now: number,
) => {
  const serverNow = getEstimatedPerpsServerTime(sample, now);
  if (serverNow == null) {
    return null;
  }
  const nextFundingTime = getNextPerpsFundingTime(serverNow);
  return nextFundingTime == null
    ? null
    : Math.max(0, nextFundingTime - serverNow);
};

export const formatPerpsFundingCountdown = (remainingMs: number | null) => {
  if (remainingMs == null || !Number.isFinite(remainingMs)) {
    return '--:--';
  }
  const totalSeconds = Math.max(
    0,
    Math.floor(remainingMs / MILLISECONDS_PER_SECOND),
  );
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return [hours, minutes, seconds]
    .map(value => value.toString().padStart(2, '0'))
    .join(':');
};

export const selectPreviousPerpsFunding = (
  history: FundingHistoryItem[],
  beforeTime: number,
) =>
  history.reduce<FundingHistoryItem | null>((latest, item) => {
    if (
      item.time >= beforeTime ||
      !Number.isFinite(item.time) ||
      !toBigNumber(item.fundingRate)
    ) {
      return latest;
    }
    if (!latest || item.time > latest.time) {
      return item;
    }
    return latest;
  }, null);

export const selectPerpsSignedPositionSize = (
  assetPositions:
    | readonly {
        position: {
          coin: string;
          szi: string;
        };
      }[]
    | null
    | undefined,
  canonicalCoin: string,
) =>
  assetPositions?.find(item => item.position.coin === canonicalCoin)?.position
    .szi ?? null;

export const getPerpsEstimatedFundingState = ({
  accountReady,
  fundingRate,
  oraclePrice,
  signedPositionSize,
}: {
  accountReady: boolean;
  fundingRate: string | number | null | undefined;
  oraclePrice: string | number | null | undefined;
  signedPositionSize: string | number | null | undefined;
}): PerpsEstimatedFundingState => {
  if (!accountReady) {
    return { status: 'loading-account', value: null };
  }
  if (signedPositionSize == null || signedPositionSize === '') {
    return { status: 'no-position', value: null };
  }
  const size = toBigNumber(signedPositionSize);
  if (!size) {
    return { status: 'missing-market-data', value: null };
  }
  if (size.isZero()) {
    return { status: 'no-position', value: null };
  }
  const rate = toBigNumber(fundingRate);
  const price = toBigNumber(oraclePrice);
  if (!rate || !price || !price.isGreaterThan(0)) {
    return { status: 'missing-market-data', value: null };
  }
  const value = size.multipliedBy(price).multipliedBy(rate).negated();
  const numericValue = value.toNumber();
  return Number.isFinite(numericValue)
    ? { status: 'ready', value: numericValue }
    : { status: 'missing-market-data', value: null };
};

export const calculateEstimatedPerpsFunding = ({
  fundingRate,
  oraclePrice,
  signedPositionSize,
}: {
  fundingRate: string | number | null | undefined;
  oraclePrice: string | number | null | undefined;
  signedPositionSize: string | number | null | undefined;
}) => {
  const state = getPerpsEstimatedFundingState({
    accountReady: true,
    fundingRate,
    oraclePrice,
    signedPositionSize,
  });
  return state.status === 'ready' ? state.value : null;
};
