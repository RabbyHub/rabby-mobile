import { zCreate } from '@/core/utils/reexports';
import { toMemeHolding } from './market';
import { fetchMemeUserTokenList } from './memeApi';
import type { MemeHolding } from './types';

type MemeHoldingsEntry = { holdings: MemeHolding[]; totalUsd: number };

type MemeHoldingsState = {
  /** keyed by lowercase address */
  byAddress: Record<string, MemeHoldingsEntry>;
};

export const useMemeHoldingsStore = zCreate<MemeHoldingsState>(() => ({
  byAddress: {},
}));

const inflight = new Map<string, Promise<void>>();

export const refreshMemeHoldings = (address: string) => {
  const key = address.toLowerCase();
  let task = inflight.get(key);
  if (!task) {
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
      .catch(() => {})
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
  return {
    holdings: entry ? entry.holdings : EMPTY_HOLDINGS,
    totalUsd: entry ? entry.totalUsd : 0,
    loaded: !!entry,
  };
};
