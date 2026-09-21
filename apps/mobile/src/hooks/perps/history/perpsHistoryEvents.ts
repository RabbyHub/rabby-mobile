import type {
  UserNonFundingLedgerUpdates,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';

export type PerpsProHistoryRawEvent =
  | {
      accountAddress: string;
      isSnapshot: boolean;
      items: WsFill[];
      kind: 'fills';
    }
  | {
      accountAddress: string;
      isSnapshot: boolean;
      items: UserNonFundingLedgerUpdates[];
      kind: 'ledger';
    };

type PerpsProHistoryEventListener = (event: PerpsProHistoryRawEvent) => void;

const listeners = new Set<PerpsProHistoryEventListener>();

export const publishPerpsProHistoryEvent = (event: PerpsProHistoryRawEvent) => {
  listeners.forEach(listener => listener(event));
};

export const subscribePerpsProHistoryEvents = (
  listener: PerpsProHistoryEventListener,
) => {
  listeners.add(listener);
  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    listeners.delete(listener);
  };
};
