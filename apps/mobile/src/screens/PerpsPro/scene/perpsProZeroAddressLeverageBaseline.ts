import type { ActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';

import { DELETE_AGENT_EMPTY_ADDRESS } from '@/constant/perps';
import {
  fetchActiveAssetDataWithCache,
  readActiveAssetDataFromCache,
} from '@/hooks/perps/useActiveAssetDataCache';

import type { PerpsProLeverageConfiguration } from '../model/leverage';

const PREPARE_TIMEOUT_MS = 1500;
const PREPARE_MAX_ATTEMPTS = 2;
const PREFETCH_CONCURRENCY = 4;

const prefetchQueue: string[] = [];
const queuedPrefetchCoins = new Set<string>();
const activePrefetchCoins = new Set<string>();
let activePrefetchCount = 0;

const getMatchingLeverage = (
  coin: string,
  data: ActiveAssetData | null,
): PerpsProLeverageConfiguration | null =>
  data?.coin === coin ? data.leverage : null;

export const readPerpsProZeroAddressLeverageBaseline = (
  coin: string,
): PerpsProLeverageConfiguration | null =>
  coin
    ? getMatchingLeverage(
        coin,
        readActiveAssetDataFromCache(coin, DELETE_AGENT_EMPTY_ADDRESS),
      )
    : null;

const drainPrefetchQueue = () => {
  while (
    activePrefetchCount < PREFETCH_CONCURRENCY &&
    prefetchQueue.length > 0
  ) {
    const coin = prefetchQueue.shift();
    if (!coin) {
      continue;
    }
    queuedPrefetchCoins.delete(coin);
    if (readPerpsProZeroAddressLeverageBaseline(coin)) {
      continue;
    }

    activePrefetchCount += 1;
    activePrefetchCoins.add(coin);
    void fetchActiveAssetDataWithCache(
      coin,
      DELETE_AGENT_EMPTY_ADDRESS,
    ).finally(() => {
      activePrefetchCount -= 1;
      activePrefetchCoins.delete(coin);
      drainPrefetchQueue();
    });
  }
};

export const prefetchPerpsProZeroAddressLeverageBaseline = (coin: string) => {
  if (
    !coin ||
    readPerpsProZeroAddressLeverageBaseline(coin) ||
    activePrefetchCoins.has(coin) ||
    queuedPrefetchCoins.has(coin)
  ) {
    return;
  }
  queuedPrefetchCoins.add(coin);
  prefetchQueue.push(coin);
  drainPrefetchQueue();
};

type TimedFetchResult =
  | { kind: 'settled'; data: ActiveAssetData | null }
  | { kind: 'timeout' };

const fetchWithinDeadline = (
  coin: string,
  timeoutMs: number,
): Promise<TimedFetchResult> =>
  new Promise(resolve => {
    let settled = false;
    const finish = (result: TimedFetchResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);

    void fetchActiveAssetDataWithCache(coin, DELETE_AGENT_EMPTY_ADDRESS).then(
      data => finish({ data, kind: 'settled' }),
      () => finish({ data: null, kind: 'settled' }),
    );
  });

/**
 * Resolves one immutable initial configuration before a market becomes
 * visible. A timed-out request may still seed the shared cache for a future
 * visit, but its late result must not mutate the selection that used fallback.
 */
export const preparePerpsProZeroAddressLeverageBaseline = async (
  coin: string,
): Promise<PerpsProLeverageConfiguration | null> => {
  if (!coin) {
    return null;
  }
  const cached = readPerpsProZeroAddressLeverageBaseline(coin);
  if (cached) {
    return cached;
  }

  const deadline = Date.now() + PREPARE_TIMEOUT_MS;
  for (let attempt = 0; attempt < PREPARE_MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }
    const result = await fetchWithinDeadline(coin, remainingMs);
    if (result.kind === 'timeout') {
      break;
    }
    // The shared fetcher may return an expired entry when its network request
    // fails. Only a fresh cache write proves that this attempt produced a
    // usable baseline for a newly visible market.
    const leverage = readPerpsProZeroAddressLeverageBaseline(coin);
    if (leverage) {
      return leverage;
    }
  }

  return readPerpsProZeroAddressLeverageBaseline(coin);
};
