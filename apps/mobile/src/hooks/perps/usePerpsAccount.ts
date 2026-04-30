import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useMemo } from 'react';
import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { getSpotBalanceKey } from '@/utils/perps';

export const usePerpsAccount = () => {
  const {
    userAbstraction,
    perpsAccountValue,
    perpsWithdrawable,
    crossMaintenanceMarginUsed,
    spotAccountValue,
    spotAvailableToTrade,
    spotBalances,
    spotBalancesMap,
  } = perpsStore(
    useShallow(s => ({
      userAbstraction: s.userAbstraction,
      perpsAccountValue:
        s.currentClearinghouseState?.marginSummary?.accountValue,
      perpsWithdrawable: s.currentClearinghouseState?.withdrawable,
      crossMaintenanceMarginUsed:
        s.currentClearinghouseState?.crossMaintenanceMarginUsed,

      spotAccountValue: s.spotState.accountValue,
      spotAvailableToTrade: s.spotState.availableToTrade,
      spotBalances: s.spotState.balances,
      spotBalancesMap: s.spotState.balancesMap,
    })),
  );

  const isUnifiedAccount = useMemo(() => {
    return userAbstraction === UserAbstractionResp.unifiedAccount;
  }, [userAbstraction]);

  // when isUnifiedAccount, accountValue is only the spotAccountValue
  const accountValue = useMemo(() => {
    return isUnifiedAccount
      ? Number(spotAccountValue) || 0
      : Number(perpsAccountValue) || 0;
  }, [isUnifiedAccount, spotAccountValue, perpsAccountValue]);

  const availableBalance = useMemo(() => {
    return (
      Number(isUnifiedAccount ? spotAvailableToTrade : perpsWithdrawable) || 0
    );
  }, [isUnifiedAccount, spotAvailableToTrade, perpsWithdrawable]);

  const getSpotBalance = useCallback(
    (coin: string) => {
      const balance = spotBalancesMap[getSpotBalanceKey(coin)];
      return balance ? Number(balance.available) || 0 : 0;
    },
    [spotBalancesMap],
  );

  const getAvailableByAsset = useCallback(
    (coin: string) => {
      if (isUnifiedAccount) {
        return getSpotBalance(coin);
      }
      return coin === 'USDC' ? Number(perpsWithdrawable) || 0 : 0;
    },
    [isUnifiedAccount, getSpotBalance, perpsWithdrawable],
  );

  return {
    accountValue,
    availableBalance,
    crossMaintenanceMarginUsed,
    isUnifiedAccount,
    spotBalances: isUnifiedAccount ? spotBalances || [] : [],
    spotBalancesMap: isUnifiedAccount ? spotBalancesMap || {} : {},
    getSpotBalance,
    getAvailableByAsset,
  };
};
