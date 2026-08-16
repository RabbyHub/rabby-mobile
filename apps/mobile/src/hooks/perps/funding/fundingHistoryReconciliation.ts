import {
  HYPE_USDC_TOKEN_ID,
  HYPE_USDC_TOKEN_SERVER_CHAIN,
} from '@/constant/perps';

import type { AccountHistoryItem, PerpsFundingConfirmation } from './types';
import { getPerpsFundingSettlementIdentityKeys } from './fundingHistoryIdentity';

export type PerpsFundingHistoryObservation = 'baseline' | 'incremental';

export type PerpsFundingHistoryMatch = Readonly<{
  confirmations: PerpsFundingConfirmation[];
  confirmedLocalIndexes: ReadonlySet<number>;
  confirmedOperationIds: string[];
  exactLocalIndexByRemoteIndex: ReadonlyMap<number, number>;
  metadataLocalIndexByRemoteIndex: ReadonlyMap<number, number>;
}>;

const getDirection = (
  item: Pick<AccountHistoryItem, 'type'>,
): 'deposit' | 'withdraw' =>
  item.type === 'withdraw' ? 'withdraw' : 'deposit';

const getSettlementIdentityKeys = (item: AccountHistoryItem) =>
  getPerpsFundingSettlementIdentityKeys({
    direction: getDirection(item),
    hash: item.hash,
    settlementNonce: item.settlementNonce,
  });

const isMetadataCandidate = (item: AccountHistoryItem) =>
  item.status === 'pending' || item.status === 'success';

const isLegacyProviderOperation = (item: AccountHistoryItem) => {
  if (
    item.type !== 'receive' ||
    !item.sourceChainId?.trim() ||
    !item.sourceTokenId?.trim()
  ) {
    return false;
  }
  return !(
    item.sourceChainId.toLowerCase() ===
      HYPE_USDC_TOKEN_SERVER_CHAIN.toLowerCase() &&
    item.sourceTokenId.toLowerCase() === HYPE_USDC_TOKEN_ID.toLowerCase()
  );
};

const isProviderPending = (item: AccountHistoryItem) =>
  item.status === 'pending' &&
  item.type === 'receive' &&
  (item.fundingRoute === 'provider' ||
    (item.fundingRoute === undefined && isLegacyProviderOperation(item)));

const normalizeProviderLedgerHash = (hash: string) => {
  const normalized = hash.trim().toLowerCase();
  if (
    !normalized ||
    normalized.startsWith('hl-nonce:') ||
    /^0x0+$/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

/**
 * Matches local funding operations against official Hyperliquid ledger facts.
 *
 * Exact hash/nonce identity always wins. Provider deposits without a protocol
 * identity are linked only when one pending operation and one newer stable
 * ledger success remain after exact matching.
 */
export const matchPerpsFundingHistory = ({
  localHistory,
  remoteHistory,
}: {
  localHistory: readonly AccountHistoryItem[];
  observation: PerpsFundingHistoryObservation;
  remoteHistory: readonly AccountHistoryItem[];
}): PerpsFundingHistoryMatch => {
  const confirmationsByOperationId = new Map<
    string,
    PerpsFundingConfirmation
  >();
  const confirmedLocalIndexes = new Set<number>();
  const exactLocalIndexByRemoteIndex = new Map<number, number>();
  const metadataLocalIndexByRemoteIndex = new Map<number, number>();
  const successfulRemote = remoteHistory
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.status === 'success');
  const localIndexesByIdentity = new Map<string, number[]>();

  localHistory.forEach((local, localIndex) => {
    if (!isMetadataCandidate(local)) {
      return;
    }
    getSettlementIdentityKeys(local).forEach(key => {
      const indexes = localIndexesByIdentity.get(key);
      if (indexes) {
        indexes.push(localIndex);
      } else {
        localIndexesByIdentity.set(key, [localIndex]);
      }
    });
  });

  successfulRemote.forEach(({ index: remoteIndex, item: remote }) => {
    const exactLocalIndexes = new Set<number>();
    getSettlementIdentityKeys(remote).forEach(key => {
      localIndexesByIdentity.get(key)?.forEach(localIndex => {
        exactLocalIndexes.add(localIndex);
      });
    });
    const firstExactLocalIndex = exactLocalIndexes.values().next().value as
      | number
      | undefined;
    if (firstExactLocalIndex === undefined) {
      return;
    }
    exactLocalIndexByRemoteIndex.set(remoteIndex, firstExactLocalIndex);
    metadataLocalIndexByRemoteIndex.set(remoteIndex, firstExactLocalIndex);
    exactLocalIndexes.forEach(localIndex => {
      const local = localHistory[localIndex];
      if (local?.status !== 'pending') {
        return;
      }
      confirmedLocalIndexes.add(localIndex);
      if (local.operationId) {
        confirmationsByOperationId.set(local.operationId, {
          operationId: local.operationId,
        });
      }
    });
  });

  const providerPendingIndexesByOperationId = new Map<string, number[]>();
  localHistory.forEach((local, localIndex) => {
    if (
      !local.operationId ||
      confirmedLocalIndexes.has(localIndex) ||
      !isProviderPending(local)
    ) {
      return;
    }
    const indexes = providerPendingIndexesByOperationId.get(local.operationId);
    if (indexes) {
      indexes.push(localIndex);
    } else {
      providerPendingIndexesByOperationId.set(local.operationId, [localIndex]);
    }
  });

  if (providerPendingIndexesByOperationId.size === 1) {
    const [operationId, localIndexes] = [
      ...providerPendingIndexesByOperationId.entries(),
    ][0];
    const metadataLocalIndex = localIndexes[0];
    const local = localHistory[metadataLocalIndex];
    const eligibleRemote = successfulRemote.filter(({ index, item }) => {
      return (
        !exactLocalIndexByRemoteIndex.has(index) &&
        item.type === local.type &&
        item.time >= local.time &&
        normalizeProviderLedgerHash(item.hash) !== null
      );
    });

    if (eligibleRemote.length === 1) {
      const [{ index: remoteIndex, item: remote }] = eligibleRemote;
      const hash = normalizeProviderLedgerHash(remote.hash);
      if (hash) {
        localIndexes.forEach(localIndex => {
          confirmedLocalIndexes.add(localIndex);
        });
        metadataLocalIndexByRemoteIndex.set(remoteIndex, metadataLocalIndex);
        confirmationsByOperationId.set(operationId, {
          operationId,
          providerSettlementIdentity: {
            hash,
            kind: 'hyperliquidLedgerHash',
          },
        });
      }
    }
  }

  const confirmations = [...confirmationsByOperationId.values()];
  return {
    confirmations,
    confirmedLocalIndexes,
    confirmedOperationIds: confirmations.map(item => item.operationId),
    exactLocalIndexByRemoteIndex,
    metadataLocalIndexByRemoteIndex,
  };
};

export const reconcilePerpsFundingHistory = ({
  localHistory,
  observation,
  remoteHistory,
}: {
  localHistory: readonly AccountHistoryItem[];
  observation: PerpsFundingHistoryObservation;
  remoteHistory: readonly AccountHistoryItem[];
}): {
  confirmations: PerpsFundingConfirmation[];
  confirmedOperationIds: string[];
  history: AccountHistoryItem[];
  local: AccountHistoryItem[];
} => {
  const matches = matchPerpsFundingHistory({
    localHistory,
    observation,
    remoteHistory,
  });
  const history = remoteHistory.map((remote, remoteIndex) => {
    const localIndex = matches.metadataLocalIndexByRemoteIndex.get(remoteIndex);
    const local =
      localIndex === undefined ? undefined : localHistory[localIndex];
    if (!local) {
      return remote;
    }
    const canUseLocalAssetAmount = remote.assetAmountSource !== 'explicit';
    return {
      ...remote,
      accountAddress: local.accountAddress,
      accountType: local.accountType,
      amount: canUseLocalAssetAmount
        ? local.amount ?? remote.amount
        : remote.amount,
      asset: canUseLocalAssetAmount
        ? local.asset ?? remote.asset
        : remote.asset,
      assetAmountSource: canUseLocalAssetAmount
        ? local.assetAmountSource ?? 'local'
        : remote.assetAmountSource,
      fundingRoute: local.fundingRoute,
      operationId: local.operationId,
      settlementAmount: canUseLocalAssetAmount
        ? local.settlementAmount ?? remote.settlementAmount
        : remote.settlementAmount,
      settlementNonce: local.settlementNonce ?? remote.settlementNonce,
      sourceChainId: local.sourceChainId,
      sourceHash: local.sourceHash,
      sourceTokenId: local.sourceTokenId,
    };
  });

  return {
    confirmations: matches.confirmations,
    confirmedOperationIds: matches.confirmedOperationIds,
    history,
    local: localHistory.filter(
      (_item, index) => !matches.confirmedLocalIndexes.has(index),
    ),
  };
};
