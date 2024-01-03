import { notificationService } from '@/core/services';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CancelItem } from './CancelApproval/CancelItem';

// TODO
export const CancelConnect = () => {
  const { data, setTitle, setHeight } = useCommonPopupView();
  const { onCancel, displayBlockedRequestApproval } = data;
  const { t } = useTranslation();

  React.useEffect(() => {
    setTitle(t('page.signFooterBar.cancelConnection'));

    setHeight(244);
  }, [displayBlockedRequestApproval]);

  const handleBlockedRequestApproval = () => {
    notificationService.blockedDapp();
  };

  return (
    <div>
      <div className="text-r-neutral-body text-13 font-normal text-center leading-[16px]">
        {t('page.signFooterBar.detectedMultipleRequestsFromThisDapp')}
      </div>
      <div className="space-y-10 mt-20">
        <CancelItem onClick={onCancel}>
          {t('page.signFooterBar.cancelCurrentConnection')}
        </CancelItem>
        {displayBlockedRequestApproval && (
          <CancelItem onClick={handleBlockedRequestApproval}>
            {t('page.signFooterBar.blockDappFromSendingRequests')}
          </CancelItem>
        )}
      </div>
    </div>
  );
};
