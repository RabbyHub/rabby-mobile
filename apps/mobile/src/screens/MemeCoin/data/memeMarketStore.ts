import { zCreate } from '@/core/utils/reexports';
import { fetchMemeMarket } from './fetchMemeMarket';
import type { MemeMarketItem } from './types';

type MemeMarketState = {
  list: MemeMarketItem[];
  loading: boolean;
  error: boolean;
};

export const useMemeMarketStore = zCreate<MemeMarketState>(() => ({
  list: [],
  loading: true,
  error: false,
}));

let inflight: Promise<void> | null = null;

export const refreshMemeMarket = () => {
  if (!inflight) {
    useMemeMarketStore.setState({ loading: true, error: false });
    inflight = fetchMemeMarket()
      .then(list => useMemeMarketStore.setState({ list, loading: false }))
      .catch(() => useMemeMarketStore.setState({ loading: false, error: true }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};
