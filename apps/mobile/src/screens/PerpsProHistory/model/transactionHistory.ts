import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';

import { HYPE_EVM_BRIDGE_ADDRESS_MAP } from '@/constant/perps';
import { getPerpsFundingLedgerSettlementNonce } from '@/hooks/perps/funding/fundingHistoryIdentity';

import type {
  PerpsProLedgerFact,
  PerpsProTransactionHistoryRow,
} from '../types';

export type PerpsProTransactionExclusionReason =
  | 'ambiguousDirection'
  | 'excludedType'
  | 'invalidAmount'
  | 'spotOnly';

export type PerpsProTransactionMappingResult =
  | { row: PerpsProTransactionHistoryRow; exclusionReason?: never }
  | { exclusionReason: PerpsProTransactionExclusionReason; row: null };

export type PerpsProTransactionDiagnostics = {
  excludedByReason: Record<PerpsProTransactionExclusionReason, number>;
  visible: number;
};

const safeSameAddress = (left?: string, right?: string) =>
  !!left && !!right && isSameAddress(left, right);

export const normalizePerpsProTransactionAssetForDisplay = (asset: string) =>
  asset.trim().toUpperCase() === 'USDT0' ? 'USDT' : asset;

const resolveAmount = (delta: PerpsProLedgerFact['delta']) => {
  const rawAmount = delta.amount ?? delta.usdc ?? delta.usdcValue;
  const value = new BigNumber(rawAmount ?? Number.NaN);
  if (!value.isFinite()) {
    return null;
  }
  return {
    amount: value.absoluteValue().toString(),
    asset:
      delta.amount != null && delta.token
        ? normalizePerpsProTransactionAssetForDisplay(delta.token)
        : 'USDC',
    assetAmountSource:
      delta.amount != null && delta.token
        ? ('explicit' as const)
        : ('legacyUsdc' as const),
  };
};

const isExplicitSpotDex = (dex?: string) =>
  dex?.trim().toLowerCase() === 'spot';

const isDefaultPerpsDex = (dex?: string) => !dex?.trim();

const isHyperEvmBridgeDestination = (destination?: string) =>
  Object.values(HYPE_EVM_BRIDGE_ADDRESS_MAP).some(address =>
    safeSameAddress(destination, address),
  );

const resolveSameAccountSendDirection = ({
  currentAddress,
  destination,
  destinationDex,
  source,
  sourceDex,
}: {
  currentAddress: string;
  destination?: string;
  destinationDex?: string;
  source?: string;
  sourceDex?: string;
}): 'deposit' | 'withdraw' | null => {
  if (
    !safeSameAddress(source, currentAddress) ||
    !safeSameAddress(destination, currentAddress)
  ) {
    return null;
  }
  if (isExplicitSpotDex(sourceDex) && isDefaultPerpsDex(destinationDex)) {
    return 'deposit';
  }
  if (isDefaultPerpsDex(sourceDex) && isExplicitSpotDex(destinationDex)) {
    return 'withdraw';
  }
  return null;
};

const resolveEndpointDirection = ({
  currentAddress,
  destination,
  source,
}: {
  currentAddress: string;
  destination?: string;
  source?: string;
}): 'deposit' | 'withdraw' | null => {
  const isSource = safeSameAddress(source, currentAddress);
  const isDestination = safeSameAddress(destination, currentAddress);
  if (isSource === isDestination) {
    return null;
  }
  return isDestination ? 'deposit' : 'withdraw';
};

export const getPerpsProTransactionHistoryKey = (fact: PerpsProLedgerFact) => {
  const { delta } = fact;
  return [
    fact.time,
    fact.hash,
    delta.type,
    delta.source ?? delta.user ?? '',
    delta.destination ?? '',
    delta.token ?? 'USDC',
    delta.amount ?? delta.usdc ?? delta.usdcValue ?? '',
    delta.nonce == null ? '' : String(delta.nonce),
    delta.toPerp == null ? '' : String(delta.toPerp),
  ].join(':');
};

export const mapPerpsProTransactionHistoryFact = (
  fact: PerpsProLedgerFact,
  currentAddress: string,
): PerpsProTransactionMappingResult => {
  const { delta } = fact;
  let direction: 'deposit' | 'withdraw' | null = null;

  switch (delta.type) {
    case 'deposit':
      direction = 'deposit';
      break;
    case 'withdraw':
      direction = 'withdraw';
      break;
    case 'accountClassTransfer':
      if (typeof delta.toPerp !== 'boolean') {
        return { exclusionReason: 'ambiguousDirection', row: null };
      }
      direction = delta.toPerp ? 'deposit' : 'withdraw';
      break;
    case 'internalTransfer':
    case 'subAccountTransfer':
      direction = resolveEndpointDirection({
        currentAddress,
        destination: delta.destination,
        source: delta.source ?? delta.user,
      });
      break;
    case 'send': {
      const source = delta.source ?? delta.user;
      const isHyperEvmWithdraw =
        safeSameAddress(source, currentAddress) &&
        isHyperEvmBridgeDestination(delta.destination);
      direction = isHyperEvmWithdraw
        ? 'withdraw'
        : resolveSameAccountSendDirection({
            currentAddress,
            destination: delta.destination,
            destinationDex: delta.destinationDex,
            source,
            sourceDex: delta.sourceDex,
          }) ||
          resolveEndpointDirection({
            currentAddress,
            destination: delta.destination,
            source,
          });
      if (
        !isHyperEvmWithdraw &&
        ((direction === 'deposit' && isExplicitSpotDex(delta.destinationDex)) ||
          (direction === 'withdraw' && isExplicitSpotDex(delta.sourceDex)))
      ) {
        return { exclusionReason: 'spotOnly', row: null };
      }
      break;
    }
    case 'spotTransfer':
    case 'spotGenesis':
      return { exclusionReason: 'spotOnly', row: null };
    default:
      return { exclusionReason: 'excludedType', row: null };
  }

  if (!direction) {
    return { exclusionReason: 'ambiguousDirection', row: null };
  }

  const value = resolveAmount(delta);
  if (!value) {
    return { exclusionReason: 'invalidAmount', row: null };
  }

  return {
    row: {
      ...value,
      direction,
      hash: fact.hash,
      key: getPerpsProTransactionHistoryKey(fact),
      kind: 'transaction',
      rawType: delta.type,
      settlementNonce: getPerpsFundingLedgerSettlementNonce(delta),
      status: 'success',
      time: fact.time,
    },
  };
};

export const summarizePerpsProTransactionHistoryFacts = (
  facts: readonly PerpsProLedgerFact[],
  currentAddress: string,
): PerpsProTransactionDiagnostics => {
  const diagnostics: PerpsProTransactionDiagnostics = {
    excludedByReason: {
      ambiguousDirection: 0,
      excludedType: 0,
      invalidAmount: 0,
      spotOnly: 0,
    },
    visible: 0,
  };
  facts.forEach(fact => {
    const result = mapPerpsProTransactionHistoryFact(fact, currentAddress);
    if (result.row) {
      diagnostics.visible += 1;
      return;
    }
    diagnostics.excludedByReason[result.exclusionReason] += 1;
  });
  return diagnostics;
};
