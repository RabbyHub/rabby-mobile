import type { PerpsQuoteAsset } from '@/constant/perps';
import { usePerpsFundingActions } from '@/hooks/perps/funding/usePerpsFundingActions';
import { PerpsDepositPopup } from '@/screens/Perps/components/PerpsDepositPopup';
import { PerpsSpotSwapPopup } from '@/screens/Perps/components/PerpsSpotSwapPopup';
import { PerpsWithdrawPopup } from '@/screens/Perps/components/PerpsWithdrawPopup';
import { useMemoizedFn } from 'ahooks';
import React from 'react';

export type PerpsProFundingMode = 'deposit' | 'withdraw' | 'swap';

export const PerpsProFundingOverlay: React.FC<{
  depositFromSwapVisible: boolean;
  mode: PerpsProFundingMode;
  onClose: () => void;
  onCloseDeposit: () => void;
  onOpenDeposit: () => void;
  sourceAsset?: PerpsQuoteAsset;
  targetAsset: PerpsQuoteAsset;
}> = ({
  depositFromSwapVisible,
  mode,
  onClose,
  onCloseDeposit,
  onOpenDeposit,
  sourceAsset,
  targetAsset,
}) => {
  const {
    currentPerpsAccount,
    handleDeposit,
    handleStableCoinOrder,
    handleWithdraw,
  } = usePerpsFundingActions();
  const handleWithdrawAndClose = useMemoizedFn(
    async (...args: Parameters<typeof handleWithdraw>) => {
      await handleWithdraw(...args);
      onClose();
    },
  );

  if (mode === 'deposit') {
    return (
      <PerpsDepositPopup
        account={currentPerpsAccount}
        onClose={onClose}
        onDeposit={handleDeposit}
        visible
      />
    );
  }

  if (mode === 'withdraw') {
    return (
      <PerpsWithdrawPopup
        onClose={onClose}
        onWithdraw={handleWithdrawAndClose}
        visible
      />
    );
  }

  return (
    <>
      <PerpsSpotSwapPopup
        disableSwitch={!sourceAsset}
        onClose={onClose}
        onDepositPress={onOpenDeposit}
        onSpotOrder={handleStableCoinOrder}
        sourceAsset={sourceAsset}
        targetAsset={sourceAsset ? undefined : targetAsset}
        visible
      />
      {depositFromSwapVisible ? (
        <PerpsDepositPopup
          account={currentPerpsAccount}
          onClose={onCloseDeposit}
          onDeposit={handleDeposit}
          visible
        />
      ) : null}
    </>
  );
};
