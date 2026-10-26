import type { PerpsFundingJournalEntry } from '@/core/services/perpsService';
import { mapPerpsFundingJournalEntryToHistory } from '@/hooks/perps/funding/fundingHistory';
import {
  isPerpsFundingPendingPresentationExpired,
  matchPerpsFundingHistory,
  shouldUsePerpsFundingSourceAssetAmount,
} from '@/hooks/perps/funding/fundingHistoryReconciliation';
import type { AccountHistoryItem } from '@/hooks/perps/funding/types';

import type { PerpsProTransactionHistoryRow } from '../types';
import { sortPerpsProHistoryRows } from './historyModel';

const getDirection = (
  type: AccountHistoryItem['type'] | PerpsFundingJournalEntry['localType'],
): 'deposit' | 'withdraw' => (type === 'withdraw' ? 'withdraw' : 'deposit');

const mapLocalHistoryItem = (
  item: AccountHistoryItem,
  now?: number,
): PerpsProTransactionHistoryRow | null => {
  if (
    item.status === 'success' ||
    item.type === 'transfer' ||
    (item.status !== 'pending' && item.status !== 'failed') ||
    (now !== undefined && isPerpsFundingPendingPresentationExpired(item, now))
  ) {
    return null;
  }
  const direction = getDirection(item.type);
  return {
    amount: item.amount ?? item.usdValue,
    asset: item.asset ?? 'USDC',
    assetAmountSource: 'local',
    direction,
    hash: item.hash,
    key: `local:${
      item.operationId ?? `${item.time}:${item.hash}:${item.type}`
    }`,
    kind: 'transaction',
    rawType: item.type,
    settlementNonce: item.settlementNonce,
    status: item.status,
    time: item.time,
  };
};

export const mapPerpsProRemoteTransactionToFundingHistory = (
  row: PerpsProTransactionHistoryRow,
): AccountHistoryItem => ({
  amount: row.amount,
  asset: row.asset,
  assetAmountSource: row.assetAmountSource,
  hash: row.hash,
  settlementNonce: row.settlementNonce,
  status: row.status,
  time: row.time,
  type:
    row.direction === 'withdraw'
      ? 'withdraw'
      : row.rawType === 'send' || row.rawType === 'internalTransfer'
      ? 'receive'
      : 'deposit',
  usdValue: row.amount,
});

export const mergePerpsProLocalTransactionHistory = ({
  journalEntries,
  localHistory,
  now,
  remoteRows,
}: {
  journalEntries: readonly PerpsFundingJournalEntry[];
  localHistory: readonly AccountHistoryItem[];
  now?: number;
  remoteRows: readonly PerpsProTransactionHistoryRow[];
}): {
  confirmations: ReturnType<typeof matchPerpsFundingHistory>['confirmations'];
  confirmedOperationIds: string[];
  rows: PerpsProTransactionHistoryRow[];
} => {
  const combinedLocalHistory = [
    ...journalEntries.map(mapPerpsFundingJournalEntryToHistory),
    ...localHistory,
  ];
  const remoteHistory = remoteRows.map(
    mapPerpsProRemoteTransactionToFundingHistory,
  );
  const matches = matchPerpsFundingHistory({
    localHistory: combinedLocalHistory,
    observation: 'baseline',
    remoteHistory,
  });

  const enrichedRemote = remoteRows.map((row, remoteIndex) => {
    const localIndex = matches.metadataLocalIndexByRemoteIndex.get(remoteIndex);
    const metadata =
      localIndex === undefined ? undefined : combinedLocalHistory[localIndex];
    if (!metadata) {
      return row;
    }
    if (
      !shouldUsePerpsFundingSourceAssetAmount({
        local: metadata,
        remote: row,
      })
    ) {
      return row;
    }
    return {
      ...row,
      amount: metadata.amount ?? metadata.usdValue,
      asset: metadata.asset ?? 'USDC',
      assetAmountSource: 'local' as const,
      status: 'success' as const,
    };
  });

  const localByKey = new Map<string, PerpsProTransactionHistoryRow>();
  combinedLocalHistory.forEach((item, localIndex) => {
    if (matches.confirmedLocalIndexes.has(localIndex)) {
      return;
    }
    const row = mapLocalHistoryItem(item, now);
    if (row) {
      localByKey.set(row.key, row);
    }
  });

  return {
    confirmations: matches.confirmations,
    confirmedOperationIds: matches.confirmedOperationIds,
    rows: sortPerpsProHistoryRows([...enrichedRemote, ...localByKey.values()]),
  };
};
