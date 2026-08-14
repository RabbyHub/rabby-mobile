import type { Account } from '@/core/startupServices/preference';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { PerpsAccountSelectorPopup } from '@/screens/Perps/components/PerpsAccountSelectorPopup';
import { PerpsAgentsLimitModal } from '@/screens/Perps/components/PerpsAgentsLimitModal';
import { usePerpsPopupState } from '@/screens/Perps/hooks/usePerpsPopupState';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

/**
 * Keeps the existing account-login workflow intact while isolating its broad
 * legacy adapter subscriptions from the high-frequency Pro scene.
 */
const PerpsProAccountSelectorController: React.FC = () => {
  const { t } = useTranslation();
  const [popupState, setPopupState] = usePerpsPopupState();
  const { currentPerpsAccount, handleDeleteAgent, login } = usePerpsState({
    legacyRuntimeContinuationEnabled: false,
  });

  const closeLogin = useMemoizedFn(() =>
    setPopupState(current => ({ ...current, isShowLoginPopup: false })),
  );
  const selectAccount = useMemoizedFn(async (account: Account) => {
    if (await login(account)) closeLogin();
  });
  const closeDeleteAgent = useMemoizedFn(() =>
    setPopupState(current => ({
      ...current,
      isShowDeleteAgentPopup: false,
    })),
  );
  const confirmDeleteAgent = useMemoizedFn(() => {
    void handleDeleteAgent();
    closeDeleteAgent();
  });
  usePerpsProSheetNavigationRegistration({
    active: popupState.isShowLoginPopup,
    dismiss: closeLogin,
  });

  return (
    <>
      <PerpsAccountSelectorPopup
        onChange={selectAccount}
        onClose={closeLogin}
        title={t('page.perps.selectAccountTitle')}
        value={currentPerpsAccount}
        visible={popupState.isShowLoginPopup}
      />
      <PerpsAgentsLimitModal
        onCancel={closeDeleteAgent}
        onConfirm={confirmDeleteAgent}
        visible={popupState.isShowDeleteAgentPopup}
      />
    </>
  );
};

export const PerpsProAccountSelectorLayer: React.FC = React.memo(() => {
  const [popupState] = usePerpsPopupState();
  return popupState.isShowLoginPopup || popupState.isShowDeleteAgentPopup ? (
    <PerpsProAccountSelectorController />
  ) : null;
});

PerpsProAccountSelectorLayer.displayName = 'PerpsProAccountSelectorLayer';
