import React from 'react';
import { CancelItem } from './CancelItem';
import { useTranslation } from 'react-i18next';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';

// TODO
export const CancelApproval = () => {
  const { data, setTitle, setHeight, closePopup } = useCommonPopupView();
  const { onCancel, displayBlockedRequestApproval, displayCancelAllApproval } =
    data;
  const [pendingApprovalCount, setPendingApprovalCount] = React.useState(0);
  const { t } = useTranslation();

  React.useEffect(() => {
    setTitle(t('page.signFooterBar.cancelTransaction'));
    if (displayBlockedRequestApproval && displayCancelAllApproval) {
      setHeight(288);
    } else {
      setHeight(244);
    }
    setPendingApprovalCount(notificationService.approvals.length);
  }, [displayBlockedRequestApproval, displayCancelAllApproval]);

  const handleCancelAll = () => {
    notificationService.rejectAllApprovals();
  };

  const handleBlockedRequestApproval = () => {
    notificationService.blockedDapp();
  };

  const handleCancel = () => {
    onCancel();
    closePopup();
  };

  return (
    <div>
      <div className="text-r-neutral-body text-13 font-normal text-center leading-[16px]">
        {t('page.signFooterBar.detectedMultipleRequestsFromThisDapp')}
      </div>
      <div className="space-y-10 mt-20">
        <CancelItem onClick={handleCancel}>
          {t('page.signFooterBar.cancelCurrentTransaction')}
        </CancelItem>
        {displayCancelAllApproval && (
          <CancelItem onClick={handleCancelAll}>
            {t('page.signFooterBar.cancelAll', {
              count: pendingApprovalCount,
            })}
          </CancelItem>
        )}
        {displayBlockedRequestApproval && (
          <CancelItem onClick={handleBlockedRequestApproval}>
            {t('page.signFooterBar.blockDappFromSendingRequests')}
          </CancelItem>
        )}
      </div>
    </div>
  );
};
