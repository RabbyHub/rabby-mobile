import type { PerpsQuoteAsset } from '@/constant/perps';
import { createStoreActivityScope } from '@/core/state/storeActivity';
import { usePerpsFundingActions } from '@/hooks/perps/funding/usePerpsFundingActions';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { PerpsDepositPopup } from '@/screens/Perps/components/PerpsDepositPopup';
import { PerpsSpotSwapPopup } from '@/screens/Perps/components/PerpsSpotSwapPopup';
import { PerpsWithdrawPopup } from '@/screens/Perps/components/PerpsWithdrawPopup';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { Platform } from 'react-native';

import {
  getPerpsProFontStyle,
  PERPS_PRO_REGULAR_TEXT_STYLE,
} from '../common/perpsProVisual';

const PERPS_PRO_FUNDING_INPUT_TEXT_STYLE = getPerpsProFontStyle(
  Platform.OS,
  '700',
);

export type PerpsProFundingMode = 'deposit' | 'withdraw' | 'swap';

const PerpsProScopedWithdrawPopup: React.FC<
  React.ComponentProps<typeof PerpsWithdrawPopup>
> = props => {
  const [activityScope] = React.useState(() =>
    createStoreActivityScope({
      active: true,
      label: 'perps-pro-withdraw-popup',
    }),
  );

  React.useEffect(
    () => () => {
      activityScope.dispose();
    },
    [activityScope],
  );

  return (
    <StoreActivityProvider scope={activityScope}>
      <PerpsWithdrawPopup
        {...props}
        inputTextStyle={PERPS_PRO_FUNDING_INPUT_TEXT_STYLE}
        tooltipTextStyle={PERPS_PRO_REGULAR_TEXT_STYLE}
      />
    </StoreActivityProvider>
  );
};

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
  } = usePerpsFundingActions({ withdrawModeValidation: 'live' });
  const handleWithdrawAndClose = useMemoizedFn(
    async (...args: Parameters<typeof handleWithdraw>) => {
      const succeeded = await handleWithdraw(...args);
      if (succeeded) {
        onClose();
      }
    },
  );

  if (mode === 'deposit') {
    return (
      <PerpsDepositPopup
        account={currentPerpsAccount}
        onClose={onClose}
        onDeposit={handleDeposit}
        inputTextStyle={PERPS_PRO_FUNDING_INPUT_TEXT_STYLE}
        tooltipTextStyle={PERPS_PRO_REGULAR_TEXT_STYLE}
        visible
      />
    );
  }

  if (mode === 'withdraw') {
    return (
      <PerpsProScopedWithdrawPopup
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
        inputTextStyle={PERPS_PRO_FUNDING_INPUT_TEXT_STYLE}
        tooltipTextStyle={PERPS_PRO_REGULAR_TEXT_STYLE}
        visible
      />
      {depositFromSwapVisible ? (
        <PerpsDepositPopup
          account={currentPerpsAccount}
          onClose={onCloseDeposit}
          onDeposit={handleDeposit}
          inputTextStyle={PERPS_PRO_FUNDING_INPUT_TEXT_STYLE}
          tooltipTextStyle={PERPS_PRO_REGULAR_TEXT_STYLE}
          visible
        />
      ) : null}
    </>
  );
};
