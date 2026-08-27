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

const isLegacyProviderOperation = (
  item: Pick<AccountHistoryItem, 'sourceChainId' | 'sourceTokenId' | 'type'>,
) => {
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

const isProviderOperation = (
  item: Pick<
    AccountHistoryItem,
    'fundingRoute' | 'sourceChainId' | 'sourceTokenId' | 'type'
  >,
) =>
  item.type === 'receive' &&
  (item.fundingRoute === 'provider' ||
    (item.fundingRoute === undefined && isLegacyProviderOperation(item)));

/**
 * A `receive` operation is credited to the account by a third party — a bridge
 * provider, or the HyperEVM deposit contract. Its local identity is the source
 * chain's transaction hash while the ledger row carries Hyperliquid's own
 * action hash, so the two can never be equal and correlation is the only way
 * to bind them. Direct `deposit` operations keep exact-hash matching:
 * Hyperliquid echoes the very same source transaction hash on the deposit row.
 *
 * This is deliberately wider than `isProviderOperation`: HyperEVM deposits are
 * `receive` operations on the `direct` route, so keying off the provider route
 * left them with no matching path at all and they stayed pending forever.
 */
const isCorrelationOnlyOperation = (item: Pick<AccountHistoryItem, 'type'>) =>
  item.type === 'receive';

const isCorrelationPending = (item: AccountHistoryItem) =>
  item.status === 'pending' && isCorrelationOnlyOperation(item);

/**
 * How long an operation may stay unmatched before its local record is dropped.
 * Every funding route settles far inside this window (HyperEVM in seconds, the
 * Arbitrum bridge in about a minute, provider bridges in a few), so anything
 * still unmatched here will not match later — and keeping it spins the pending
 * indicator forever. The ledger row already carries the money, so history stays
 * correct without the local record; only its source-chain metadata is lost.
 */
const PENDING_FUNDING_TTL_MS = 30 * 60 * 1000;

const isExpiredPendingOperation = (item: AccountHistoryItem, now?: number) =>
  now !== undefined &&
  item.status === 'pending' &&
  now - item.time > PENDING_FUNDING_TTL_MS;

/**
 * A provider ledger row describes the settled asset (normally USDC), while
 * the linked local operation describes the asset the user deposited. Once the
 * association is proven, transaction history presents the source operation.
 * Direct or unassociated funding continues to trust explicit ledger fields.
 */
export const shouldUsePerpsFundingSourceAssetAmount = ({
  local,
  remote,
}: {
  local: Pick<
    AccountHistoryItem,
    'fundingRoute' | 'sourceChainId' | 'sourceTokenId' | 'type'
  >;
  remote: Pick<AccountHistoryItem, 'assetAmountSource'>;
}) => isProviderOperation(local) || remote.assetAmountSource !== 'explicit';

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

  const correlationPendingIndexesByOperationId = new Map<string, number[]>();
  localHistory.forEach((local, localIndex) => {
    if (
      !local.operationId ||
      confirmedLocalIndexes.has(localIndex) ||
      !isCorrelationPending(local)
    ) {
      return;
    }
    const indexes = correlationPendingIndexesByOperationId.get(
      local.operationId,
    );
    if (indexes) {
      indexes.push(localIndex);
    } else {
      correlationPendingIndexesByOperationId.set(local.operationId, [
        localIndex,
      ]);
    }
  });

  if (correlationPendingIndexesByOperationId.size === 1) {
    const [operationId, localIndexes] = [
      ...correlationPendingIndexesByOperationId.entries(),
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

    // Exactly one operation is outstanding, so the earliest ledger credit at
    // or after it started is its settlement. Demanding a single eligible row
    // instead — the previous rule — collapsed as soon as any unrelated
    // transfer landed in the same window, leaving the operation pending
    // forever with no way back.
    const [settlement] = [...eligibleRemote].sort(
      (left, right) =>
        left.item.time - right.item.time || left.index - right.index,
    );

    if (settlement) {
      const { index: remoteIndex, item: remote } = settlement;
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
  now,
  observation,
  remoteHistory,
}: {
  localHistory: readonly AccountHistoryItem[];
  /**
   * Clock for the pending TTL. Omit to keep every unmatched operation — read
   * paths that only render a snapshot should not expire anything.
   */
  now?: number;
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
    const canUseLocalAssetAmount = shouldUsePerpsFundingSourceAssetAmount({
      local,
      remote,
    });
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
      (item, index) =>
        !matches.confirmedLocalIndexes.has(index) &&
        !isExpiredPendingOperation(item, now),
    ),
  };
};
