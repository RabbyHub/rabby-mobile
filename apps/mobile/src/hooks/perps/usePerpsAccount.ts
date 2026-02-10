import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useMemo } from 'react';
import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';

export const usePerpsAccount = () => {
  const {
    userAbstraction,
    perpsAccountValue,
    perpsWithdrawable,
    crossMaintenanceMarginUsed,
    spotAccountValue,
    spotAvailableToTrade,
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
    })),
  );

  const isUnifiedAccount = useMemo(() => {
    return userAbstraction === UserAbstractionResp.unifiedAccount;
  }, [userAbstraction]);

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

  return {
    accountValue,
    availableBalance,
    crossMaintenanceMarginUsed,
  };
};
