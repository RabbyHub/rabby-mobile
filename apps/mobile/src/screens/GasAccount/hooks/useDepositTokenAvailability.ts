import { useMemo } from 'react';
import {
  GasAccountBridgeSupportTokenList,
  storeApiGasAccountDeposit,
  useGasAccountBridgeSupportUpdatedAt,
  useGasAccountBridgeSupportTokenList,
} from './atom';
import { useSelectTokens } from '@/screens/Swap/hooks/useSelectTokens';
import { ITokenItem } from '@/store/tokens';
import { tokenAmountBn } from '@/screens/Swap/utils';

export type GasAccountDepositTokenType = 'direct' | 'bridge';

export type GasAccountAvailableToken = ITokenItem & {
  gasAccountDepositType: GasAccountDepositTokenType;
};

const isAvailableGasAccountToken = (
  token: GasAccountAvailableToken | null,
): token is GasAccountAvailableToken => !!token;

export const getAvailableGasAccountDepositTokens = (
  tokens: ITokenItem[],
  bridgeSupportTokens: GasAccountBridgeSupportTokenList,
  minDepositPrice = 1,
  options?: {
    disableL2Deposit?: boolean;
  },
) => {
  const disableL2Deposit = options?.disableL2Deposit ?? false;
  const minDepositUsd = Math.max(1, Number(minDepositPrice || 0));
  const withBalance = tokens.filter(token =>
    tokenAmountBn(token).times(token.price).gte(minDepositUsd),
  );
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
    return [];
  }

  return withBalance
    .map<GasAccountAvailableToken | null>(token => {
      const tokenId = token.id?.toLowerCase();
      if (!tokenId) {
        return null;
      }

      const supportKey = `${token.chain}:${tokenId}`;
      if (!disableL2Deposit && walletTokenSet.has(supportKey)) {
        return {
          ...token,
          gasAccountDepositType: 'direct',
        };
      }
      if (bridgeTokenSet.has(supportKey)) {
        return {
          ...token,
          gasAccountDepositType: 'bridge',
        };
      }

      return null;
    })
    .filter(isAvailableGasAccountToken)
    .sort((a, b) => (b.usd_value || 0) - (a.usd_value || 0));
};

export const useGasAccountDepositAvailableTokens = (
  minDepositPrice = 1,
  options?: {
    disableL2Deposit?: boolean;
  },
) => {
  const disableL2Deposit = options?.disableL2Deposit ?? false;
  const { tokens, isLoading, checkIsExpireAndUpdate } = useSelectTokens({
    currentAccount: undefined,
  });
  const bridgeSupportTokens = useGasAccountBridgeSupportTokenList();
  const bridgeSupportUpdatedAt = useGasAccountBridgeSupportUpdatedAt();

  const availableTokens = useMemo(
    () =>
      getAvailableGasAccountDepositTokens(
        tokens,
        bridgeSupportTokens,
        minDepositPrice,
        { disableL2Deposit },
      ),
    [bridgeSupportTokens, disableL2Deposit, minDepositPrice, tokens],
  );
  const hasAvailableTokens = availableTokens.length > 0;
  const hasTokenSnapshot = tokens.length > 0;
  const isCheckingAvailability = isLoading && !hasAvailableTokens;
  const tokenDisabled =
    bridgeSupportUpdatedAt > 0 &&
    hasTokenSnapshot &&
    !isLoading &&
    !hasAvailableTokens;

  return {
    availableTokens,
    hasAvailableTokens,
    isCheckingAvailability,
    tokenDisabled,
    checkIsExpireAndUpdate,
    refreshBridgeSupportTokenList:
      storeApiGasAccountDeposit.fetchBridgeSupportTokenList,
  };
};
