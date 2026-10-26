import type { Account } from '@/core/startupServices/preference';
import type { PerpsFundingJournalEntry } from '@/core/services/perpsService';

import { getPerpsFundingAccountIdentity } from './fundingJournal';
import type { AccountHistoryItem, PerpsFundingHistoryMetadata } from './types';
import type { PerpsFundingRoute } from './types';

export {
  getPerpsFundingAccountIdentity,
  isPerpsFundingJournalEntryForAccount,
  persistPerpsFundingJournalEntry,
  readPerpsFundingJournal,
  updatePerpsFundingJournalStatus,
} from './fundingJournal';

export const getPerpsFundingOperationId = ({
  account,
  identity,
  localType,
}: {
  account: Pick<Account, 'address' | 'type'>;
  identity: {
    settlementNonce?: number;
    sourceHash?: string;
  };
  localType: PerpsFundingJournalEntry['localType'];
}) => {
  const sourceHash = identity.sourceHash?.trim();
  const identityKey = sourceHash
    ? `evm-hash:${sourceHash.toLowerCase()}`
    : `hl-nonce:${identity.settlementNonce}`;
  return `${getPerpsFundingAccountIdentity(
    account,
  )}::${localType}::${identityKey}`;
};

export const createPerpsFundingOperation = ({
  account,
  fundingRoute,
  history,
  identity,
  localType,
  time,
}: {
  account: Pick<Account, 'address' | 'type'>;
  fundingRoute?: PerpsFundingRoute;
  history: PerpsFundingHistoryMetadata;
  identity: {
    settlementNonce?: number;
    sourceHash?: string;
  };
  localType: PerpsFundingJournalEntry['localType'];
  time: number;
}): {
  historyItem: AccountHistoryItem;
  journalEntry: PerpsFundingJournalEntry;
} | null => {
  const sourceHash = identity.sourceHash?.trim();
  const settlementNonce = identity.settlementNonce;
  const hasSettlementNonce =
    typeof settlementNonce === 'number' &&
    Number.isSafeInteger(settlementNonce) &&
    settlementNonce > 0;
  const asset = history.asset.trim();
  if ((!sourceHash && !hasSettlementNonce) || !asset) {
    return null;
  }
  const operationId = getPerpsFundingOperationId({
    account,
    identity: { settlementNonce, sourceHash },
    localType,
  });
  const historyIdentity = sourceHash || `hl-nonce:${settlementNonce}`;
  const direction = localType === 'withdraw' ? 'withdraw' : 'deposit';
  const common = {
    accountAddress: account.address.toLowerCase(),
    accountType: account.type,
    amount: history.amount,
    asset,
    assetAmountSource: 'local' as const,
    fundingRoute,
    operationId,
    settlementAmount: history.settlementAmount,
    sourceChainId: history.sourceChainId,
    sourceTokenId: history.sourceTokenId,
  };
  return {
    historyItem: {
      ...common,
      hash: historyIdentity,
      settlementNonce: hasSettlementNonce ? settlementNonce : undefined,
      sourceHash,
      status: 'pending',
      time,
      type: localType,
      usdValue: history.settlementAmount,
    },
    journalEntry: {
      accountAddress: common.accountAddress,
      accountType: common.accountType,
      amount: common.amount,
      asset: common.asset,
      createdAt: time,
      direction,
      fundingRoute,
      localType,
      operationId: common.operationId,
      settlementAmount: common.settlementAmount,
      settlementIdentity: hasSettlementNonce
        ? { kind: 'hyperliquidNonce' as const, nonce: settlementNonce }
        : undefined,
      sourceIdentity: sourceHash
        ? { hash: sourceHash, kind: 'evmTransactionHash' as const }
        : undefined,
      sourceChainId: common.sourceChainId,
      sourceTokenId: common.sourceTokenId,
      status: 'pending',
      updatedAt: time,
      version: 2,
    },
  };
};

export const mapPerpsFundingJournalEntryToHistory = (
  entry: PerpsFundingJournalEntry,
): AccountHistoryItem => {
  const sourceHash = entry.sourceIdentity?.hash;
  const providerSettlementHash = entry.providerSettlementIdentity?.hash;
  const settlementNonce = entry.settlementIdentity?.nonce;
  return {
    accountAddress: entry.accountAddress,
    accountType: entry.accountType,
    amount: entry.amount,
    asset: entry.asset,
    assetAmountSource: 'local',
    fundingRoute: entry.fundingRoute,
    hash: providerSettlementHash || sourceHash || `hl-nonce:${settlementNonce}`,
    operationId: entry.operationId,
    settlementAmount: entry.settlementAmount,
    settlementNonce,
    sourceChainId: entry.sourceChainId,
    sourceHash,
    sourceTokenId: entry.sourceTokenId,
    status: entry.status === 'confirmed' ? 'success' : entry.status,
    time: entry.createdAt,
    type: entry.localType,
    usdValue: entry.settlementAmount,
  };
};
