import { apiContact } from '@/core/apis';
import type { Account } from '@/core/startupServices/preference';
import type { PerpsViewMode } from '@/core/services/perpsService';
import React, { useCallback, useMemo } from 'react';

import { PerpsHeader } from '../../PerpsShared/components/PerpsHeader';
import { resolvePerpsHeaderAccountLabel } from '../../PerpsShared/utils/resolvePerpsHeaderAccountLabel';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';

export const PerpsSimpleHeader: React.FC<{
  account?: Account | null;
  isModeSwitching: boolean;
  onSwitchToPro: () => void;
}> = React.memo(({ account, isModeSwitching, onSwitchToPro }) => {
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
      if (viewMode === 'pro') {
        onSwitchToPro();
      }
    },
    [onSwitchToPro],
  );

  const handlePressAccount = useCallback(() => {
    setPopupState(current => ({
      ...current,
      isShowLoginPopup: !current.isShowLoginPopup,
    }));
  }, [setPopupState]);

  return (
    <PerpsHeader
      accountExpanded={popupState.isShowLoginPopup}
      accountLabel={accountLabel}
      activeMode="simple"
      extendProHitAreaRight
      isModeSwitching={isModeSwitching}
      onPressAccount={account ? handlePressAccount : undefined}
      onSelectMode={handleSelectMode}
    />
  );
});

PerpsSimpleHeader.displayName = 'PerpsSimpleHeader';
