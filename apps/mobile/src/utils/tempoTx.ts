import type { TempoTxLike } from './tempo';

export const getTxMatchData = (
  tx?: Partial<
    TempoTxLike & {
      calls?: Array<{
        data?: unknown;
      }>;
    }
  > | null,
) => {
  if (typeof tx?.data === 'string' && tx.data) {
    return tx.data;
  }

  if (Array.isArray(tx?.calls) && tx.calls.length) {
    const lastCall = tx.calls[tx.calls.length - 1];
    if (typeof lastCall?.data === 'string' && lastCall.data) {
      return lastCall.data;
    }
  }

  return '0x';
};
