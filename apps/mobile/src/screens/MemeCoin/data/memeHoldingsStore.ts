import { zCreate } from '@/core/utils/reexports';
import { toMemeHolding } from './market';
import { fetchMemeUserTokenList } from './memeApi';
import type { MemeHolding } from './types';

type MemeHoldingsEntry = { holdings: MemeHolding[]; totalUsd: number };

type MemeHoldingsState = {
  /** keyed by lowercase address */
  byAddress: Record<string, MemeHoldingsEntry>;
  /** keyed by lowercase address; whether the last request failed */
  failedByAddress: Record<string, boolean>;
};

export const useMemeHoldingsStore = zCreate<MemeHoldingsState>(() => ({
  byAddress: {},
  failedByAddress: {},
}));

const inflight = new Map<string, Promise<void>>();

const setFailed = (key: string, failed: boolean) =>
  useMemeHoldingsStore.setState(state =>
    !!state.failedByAddress[key] === failed
      ? state
      : { failedByAddress: { ...state.failedByAddress, [key]: failed } },
  );

export const refreshMemeHoldings = (address: string) => {
  const key = address.toLowerCase();
  let task = inflight.get(key);
  if (!task) {
    setFailed(key, false);
    task = fetchMemeUserTokenList(key)
      .then(res =>
        useMemeHoldingsStore.setState(state => ({
          byAddress: {
            ...state.byAddress,
            [key]: {
              holdings: res.positions.map(toMemeHolding),
              totalUsd: res.total_usd_value,
            },
          },
        })),
      )
      .catch(() => setFailed(key, true))
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, task);
  }
  return task;
};

const EMPTY_HOLDINGS: MemeHolding[] = [];

export const useMemeHoldings = (address?: string) => {
  const key = address ? address.toLowerCase() : '';
  const entry = useMemeHoldingsStore(state =>
    key ? state.byAddress[key] : undefined,
  );
  const failed = useMemeHoldingsStore(
    state => !!key && !!state.failedByAddress[key],
  );
  return {
    holdings: entry ? entry.holdings : EMPTY_HOLDINGS,
    totalUsd: entry ? entry.totalUsd : 0,
    loaded: !!entry,
    /** the first load failed; a later failure keeps the previous holdings */
    loadFailed: !entry && failed,
  };
};
