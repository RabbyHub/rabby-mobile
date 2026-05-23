import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';

import { zCreate, zMutative } from '@/core/utils/reexports';
import {
  GasAccountBridgeSupportTokenList,
  storeApiGasAccountDeposit,
  useGasAccountBridgeSupportUpdatedAt,
  useGasAccountBridgeSupportTokenList,
} from './atom';
import { useSelectTokens } from '@/screens/Swap/hooks/useSelectTokens';
import {
  ITokenItem,
  TokenEntityId,
  tokenEntityResourceStore,
} from '@/store/tokens';
import { tokenAmountBn } from '@/screens/Swap/utils';

export type GasAccountDepositTokenType = 'direct' | 'bridge';

export type GasAccountAvailableToken = ITokenItem & {
  gasAccountDepositType: GasAccountDepositTokenType;
};

export type GasAccountAvailableTokenRow = {
  tokenId: TokenEntityId;
  gasAccountDepositType: GasAccountDepositTokenType;
};

export const getGasAccountAvailableTokenFromRow = (
  row?: GasAccountAvailableTokenRow,
): GasAccountAvailableToken | null => {
  if (!row) {
    return null;
  }

  const token = tokenEntityResourceStore.getValue(row.tokenId);
  if (!token) {
    return null;
  }

  return {
    ...token,
    gasAccountDepositType: row.gasAccountDepositType,
  };
};

const EMPTY_AVAILABLE_TOKEN_ROWS: GasAccountAvailableTokenRow[] = [];

const getGasAccountDepositAvailabilityKey = (
  minDepositPrice: number,
  disableL2Deposit: boolean,
) =>
  `${Math.max(1, Number(minDepositPrice || 0))}::${disableL2Deposit ? 1 : 0}`;

const isGasAccountAvailableTokenRowSame = (
  previousRow: GasAccountAvailableTokenRow | undefined,
  nextRow: GasAccountAvailableTokenRow,
) =>
  previousRow?.tokenId === nextRow.tokenId &&
  previousRow.gasAccountDepositType === nextRow.gasAccountDepositType;

const buildStableGasAccountAvailableTokenRows = (
  rows: GasAccountAvailableTokenRow[],
  previousRows?: GasAccountAvailableTokenRow[],
) => {
  if (!rows.length) {
    return previousRows?.length
      ? EMPTY_AVAILABLE_TOKEN_ROWS
      : previousRows || EMPTY_AVAILABLE_TOKEN_ROWS;
  }

  const canReusePrevious = previousRows?.length === rows.length;
  let nextRows: GasAccountAvailableTokenRow[] | undefined = canReusePrevious
    ? undefined
    : [];

  rows.forEach((row, index) => {
    if (canReusePrevious && !nextRows) {
      if (isGasAccountAvailableTokenRowSame(previousRows![index], row)) {
        return;
      }
      nextRows = previousRows!.slice(0, index);
    }
    nextRows!.push(row);
  });

  return nextRows || previousRows!;
};

const buildAvailableGasAccountDepositTokenRows = (
  tokenIds: TokenEntityId[],
  bridgeSupportTokens: GasAccountBridgeSupportTokenList,
  minDepositPrice = 1,
  options?: {
    disableL2Deposit?: boolean;
  },
  previousRows?: GasAccountAvailableTokenRow[],
) => {
  const disableL2Deposit = options?.disableL2Deposit ?? false;
  const minDepositUsd = Math.max(1, Number(minDepositPrice || 0));
  const walletTokenSet = new Set<string>();
  bridgeSupportTokens.wallet_tokens.forEach(item => {
    if (item.chain_id && item.token_id) {
      walletTokenSet.add(`${item.chain_id}:${item.token_id.toLowerCase()}`);
    }
  });

  const bridgeTokenSet = new Set<string>();
  bridgeSupportTokens.hyperliquid_tokens.forEach(item => {
    if (item.chain_id && item.token_id) {
      bridgeTokenSet.add(`${item.chain_id}:${item.token_id.toLowerCase()}`);
    }
  });

  if (!walletTokenSet.size && !bridgeTokenSet.size) {
    return buildStableGasAccountAvailableTokenRows([], previousRows);
  }

  const rows = tokenIds
    .map(entityTokenId => {
      const token = tokenEntityResourceStore.getValue(entityTokenId);
      if (
        !token ||
        !tokenAmountBn(token).times(token.price).gte(minDepositUsd)
      ) {
        return null;
      }

      const rawTokenId = token.id?.toLowerCase();
      if (!rawTokenId) {
        return null;
      }

      const supportKey = `${token.chain}:${rawTokenId}`;
      if (!disableL2Deposit && walletTokenSet.has(supportKey)) {
        return {
          tokenId: entityTokenId,
          gasAccountDepositType: 'direct',
        };
      }
      if (bridgeTokenSet.has(supportKey)) {
        return {
          tokenId: entityTokenId,
          gasAccountDepositType: 'bridge',
        };
      }

      return null;
    })
    .filter((row): row is GasAccountAvailableTokenRow => !!row)
    .sort((a, b) => {
      const aToken = tokenEntityResourceStore.getValue(a.tokenId);
      const bToken = tokenEntityResourceStore.getValue(b.tokenId);
      return (bToken?.usd_value || 0) - (aToken?.usd_value || 0);
    });

  return buildStableGasAccountAvailableTokenRows(rows, previousRows);
};

type GasAccountDepositTokenIndexState = {
  availableTokenRowsByKey: Record<string, GasAccountAvailableTokenRow[]>;
  syncAvailableTokenRows(params: {
    key: string;
    tokenIds: TokenEntityId[];
    bridgeSupportTokens: GasAccountBridgeSupportTokenList;
    minDepositPrice: number;
    disableL2Deposit: boolean;
  }): void;
};

const useGasAccountDepositTokenIndexStore = zCreate(
  zMutative<GasAccountDepositTokenIndexState>((set, get) => ({
    availableTokenRowsByKey: {},
    syncAvailableTokenRows({
      key,
      tokenIds,
      bridgeSupportTokens,
      minDepositPrice,
      disableL2Deposit,
    }) {
      const previousRows = get().availableTokenRowsByKey[key];
      const nextRows = buildAvailableGasAccountDepositTokenRows(
        tokenIds,
        bridgeSupportTokens,
        minDepositPrice,
        { disableL2Deposit },
        previousRows,
      );

      if (previousRows === nextRows) {
        return;
      }

      set(draft => {
        draft.availableTokenRowsByKey[key] = nextRows;
      });
    },
  })),
);

export const useGasAccountDepositAvailableTokens = (
  minDepositPrice = 1,
  options?: {
    disableL2Deposit?: boolean;
  },
) => {
  const disableL2Deposit = options?.disableL2Deposit ?? false;
  const { tokenRows, isLoading, checkIsExpireAndUpdate } = useSelectTokens({
    currentAccount: undefined,
  });
  const bridgeSupportTokens = useGasAccountBridgeSupportTokenList();
  const bridgeSupportUpdatedAt = useGasAccountBridgeSupportUpdatedAt();
  const availabilityKey = useMemo(
    () =>
      getGasAccountDepositAvailabilityKey(minDepositPrice, disableL2Deposit),
    [disableL2Deposit, minDepositPrice],
  );
  const tokenIds = useMemo(
    () => tokenRows.map(row => row.tokenId),
    [tokenRows],
  );
  const tokenVersions = tokenEntityResourceStore.useStore(
    useShallow(state =>
      tokenIds.map(tokenId => state.metaMap[tokenId]?.version || 0),
    ),
  );

  useEffect(() => {
    useGasAccountDepositTokenIndexStore.getState().syncAvailableTokenRows({
      key: availabilityKey,
      tokenIds,
      bridgeSupportTokens,
      minDepositPrice,
      disableL2Deposit,
    });
  }, [
    availabilityKey,
    bridgeSupportTokens,
    disableL2Deposit,
    minDepositPrice,
    tokenIds,
    tokenVersions,
  ]);

  const availableTokenRows = useGasAccountDepositTokenIndexStore(
    useShallow(
      state =>
        state.availableTokenRowsByKey[availabilityKey] ||
        EMPTY_AVAILABLE_TOKEN_ROWS,
    ),
  );
  const hasAvailableTokens = availableTokenRows.length > 0;
  const hasTokenSnapshot = tokenRows.length > 0;
  const isCheckingAvailability = isLoading && !hasAvailableTokens;
  const tokenDisabled =
    bridgeSupportUpdatedAt > 0 &&
    hasTokenSnapshot &&
    !isLoading &&
    !hasAvailableTokens;

  return {
    availableTokenRows,
    hasAvailableTokens,
    isCheckingAvailability,
    tokenDisabled,
    checkIsExpireAndUpdate,
    refreshBridgeSupportTokenList:
      storeApiGasAccountDeposit.fetchBridgeSupportTokenList,
  };
};
