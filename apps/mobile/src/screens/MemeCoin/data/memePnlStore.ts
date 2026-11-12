import { chaintable } from '@/core/chaintable';
import { zCreate } from '@/core/utils/reexports';
import { toMemePnl } from './market';
import type { MemePnl } from './types';

type MemePnlState = {
  /** keyed by lowercase address */
  byAddress: Record<string, MemePnl>;
};

export const useMemePnlStore = zCreate<MemePnlState>(() => ({
  byAddress: {},
}));

const inflight = new Map<string, Promise<void>>();

/**
 * Apart from the holdings on purpose: the wallet Home entry only needs the
 * balance, and the holdings must not wait for this larger response.
 */
export const refreshMemePnl = (address: string) => {
  const key = address.toLowerCase();
  let task = inflight.get(key);
  if (!task) {
    task = chaintable
      .getMemeUserPnl(key)
      .then(res =>
        useMemePnlStore.setState(state => ({
          byAddress: { ...state.byAddress, [key]: toMemePnl(res) },
        })),
      )
      // without data the card and the rows show "--"; a later failure keeps the last P&L
      .catch(() => undefined)
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, task);
  }
  return task;
};

export const useMemePnl = (address?: string) => {
  const key = address ? address.toLowerCase() : '';
  return useMemePnlStore(state => (key ? state.byAddress[key] : undefined));
};
