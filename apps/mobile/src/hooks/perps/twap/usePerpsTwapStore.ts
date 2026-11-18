import { createStore } from 'zustand/vanilla';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import type { PerpsTwapFill, PerpsTwapRecord } from './types';
import { mergePerpsTwapFills } from './twapReconciliation';

export type PerpsTwapAccountData = {
  records: Readonly<Record<string, PerpsTwapRecord>>;
  fills: Readonly<Record<string, readonly PerpsTwapFill[]>>;
  activeReady: boolean;
  historyReady: boolean;
  error: string | null;
};

export const EMPTY_TWAP_ACCOUNT: PerpsTwapAccountData = {
  records: {},
  fills: {},
  activeReady: false,
  historyReady: false,
  error: null,
};
const EMPTY_FILLS: readonly PerpsTwapFill[] = [];
export type PerpsTwapReceipt = Readonly<{
  id: string;
  coin: string;
  kind: 'running' | 'cancelled' | 'unknownOutcome' | 'rejected';
  error?: string;
}>;
const EMPTY_RECEIPTS: readonly PerpsTwapReceipt[] = [];

export const perpsTwapStore = createStore<{
  accounts: Readonly<Record<string, PerpsTwapAccountData>>;
  receipts: Readonly<Record<string, readonly PerpsTwapReceipt[]>>;
}>(() => ({ accounts: {}, receipts: {} }));

export const getPerpsTwapAccount = (user: string) =>
  perpsTwapStore.getState().accounts[user.toLowerCase()] ?? EMPTY_TWAP_ACCOUNT;

export const updatePerpsTwapAccount = (
  user: string,
  update: (current: PerpsTwapAccountData) => PerpsTwapAccountData,
) => {
  const key = user.toLowerCase();
  perpsTwapStore.setState(current => {
    const previous = current.accounts[key] ?? EMPTY_TWAP_ACCOUNT;
    const next = update(previous);
    return next === previous
      ? current
      : {
          accounts: { ...current.accounts, [key]: next },
        };
  });
};

export const addPerpsTwapFills = (
  user: string,
  incoming: readonly PerpsTwapFill[],
) => {
  if (!incoming.length) return;
  const grouped = new Map<string, PerpsTwapFill[]>();
  for (const fill of incoming) {
    const key = `${fill.coin}:${fill.twapId}`;
    const values = grouped.get(key) ?? [];
    values.push(fill);
    grouped.set(key, values);
  }
  updatePerpsTwapAccount(user, current => {
    let fills: Record<string, readonly PerpsTwapFill[]> | null = null;
    for (const [key, values] of grouped) {
      const previous = current.fills[key] ?? EMPTY_FILLS;
      const next = mergePerpsTwapFills(previous, values);
      if (next !== previous) {
        if (!fills) fills = { ...current.fills };
        fills[key] = next;
      }
    }
    return fills ? { ...current, fills } : current;
  });
};

export const usePerpsTwapRecords = (user: string | undefined) =>
  useActivityStore(
    perpsTwapStore,
    state =>
      (user ? state.accounts[user.toLowerCase()] : undefined)?.records ??
      EMPTY_TWAP_ACCOUNT.records,
  );

export const usePerpsTwapRecord = (
  user: string | undefined,
  key: string | undefined,
) =>
  useActivityStore(perpsTwapStore, state =>
    user && key
      ? state.accounts[user.toLowerCase()]?.records[key] ?? null
      : null,
  );

export const usePerpsTwapFills = (
  user: string | undefined,
  key: string | undefined,
) =>
  useActivityStore(
    perpsTwapStore,
    state =>
      (user && key
        ? state.accounts[user.toLowerCase()]?.fills[key]
        : undefined) ?? EMPTY_FILLS,
  );

export const usePerpsTwapReadiness = (user: string | undefined) =>
  useActivityStore(perpsTwapStore, state => {
    const account = user ? state.accounts[user.toLowerCase()] : undefined;
    return !account
      ? 'loading'
      : account.error
      ? 'error'
      : account.activeReady && account.historyReady
      ? 'ready'
      : 'loading';
  });

export const queuePerpsTwapReceipt = (
  identity: string,
  receipt: PerpsTwapReceipt,
) => {
  perpsTwapStore.setState(current => {
    const existing = current.receipts[identity] ?? EMPTY_RECEIPTS;
    return existing.some(item => item.id === receipt.id)
      ? current
      : {
          receipts: { ...current.receipts, [identity]: [...existing, receipt] },
        };
  });
};
export const consumePerpsTwapReceipt = (identity: string, id: string) => {
  perpsTwapStore.setState(current => ({
    receipts: {
      ...current.receipts,
      [identity]: (current.receipts[identity] ?? EMPTY_RECEIPTS).filter(
        item => item.id !== id,
      ),
    },
  }));
};
export const usePerpsTwapReceipts = (identity: string | null) =>
  useActivityStore(
    perpsTwapStore,
    state =>
      (identity ? state.receipts[identity] : undefined) ?? EMPTY_RECEIPTS,
  );
