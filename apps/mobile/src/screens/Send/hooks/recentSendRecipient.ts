import type { SendTxHistoryItem } from '@/core/services/transactionHistory';

const RECENT_SEND_WINDOW_MS = 60 * 60 * 1000;

type HasRecentSuccessfulSendToOptions = {
  history: readonly SendTxHistoryItem[];
  fromAddresses: readonly string[];
  toAddress: string;
  now?: number;
};

export function hasRecentSuccessfulSendTo({
  history,
  fromAddresses,
  toAddress,
  now = Date.now(),
}: HasRecentSuccessfulSendToOptions) {
  if (!toAddress || !fromAddresses.length) {
    return false;
  }

  const normalizedToAddress = toAddress.toLowerCase();
  const normalizedFromAddresses = new Set(
    fromAddresses.map(address => address.toLowerCase()),
  );
  const cutoff = now - RECENT_SEND_WINDOW_MS;

  return history.some(item => {
    const completedAt = item.completedAt || item.createdAt;
    return (
      item.status === 'success' &&
      completedAt > cutoff &&
      normalizedFromAddresses.has(item.address.toLowerCase()) &&
      item.to.toLowerCase() === normalizedToAddress
    );
  });
}
