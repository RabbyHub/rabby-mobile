import { apiContact } from '@/core/apis';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import React, { useCallback, useMemo } from 'react';

import { usePerpsPopupState } from '../../../Perps/hooks/usePerpsPopupState';
import { PerpsHeader } from '../../../PerpsShared/components/PerpsHeader';
import { resolvePerpsHeaderAccountLabel } from '../../../PerpsShared/utils/resolvePerpsHeaderAccountLabel';

export { PERPS_PRO_HEADER_HEIGHT } from './constants';

export const PerpsProHeader: React.FC<{
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
  showBottomDivider: boolean;
}> = React.memo(({ isModeSwitching, onSwitchToSimple, showBottomDivider }) => {
  const account = perpsStore(state => state.currentPerpsAccount);
  const [popupState, setPopupState] = usePerpsPopupState();

  const contactAlias = useMemo(() => {
    if (!account?.address) {
      return null;
    }
    return apiContact.getAliasName(account.address);
  }, [account?.address]);

  const accountLabel = useMemo(
    () => resolvePerpsHeaderAccountLabel(account, contactAlias),
    [account, contactAlias],
  );

  const handleSelectMode = useCallback(
    (viewMode: PerpsViewMode) => {
      if (viewMode === 'simple') {
        onSwitchToSimple();
      }
    },
    [onSwitchToSimple],
  );

  const handlePressAccount = useCallback(() => {
    setPopupState(current => ({
      ...current,
      isShowLoginPopup: !current.isShowLoginPopup,
    }));
  }, [setPopupState]);

  return (
    <PerpsHeader
      accountAddress={account?.address}
      accountBrandName={account?.brandName}
      accountExpanded={popupState.isShowLoginPopup}
      accountLabel={accountLabel}
      accountTriggerVariant="wallet"
      activeMode="pro"
      isModeSwitching={isModeSwitching}
      onPressAccount={account ? handlePressAccount : undefined}
      onSelectMode={handleSelectMode}
      showBottomDivider={showBottomDivider}
    />
  );
});

PerpsProHeader.displayName = 'PerpsProHeader';
