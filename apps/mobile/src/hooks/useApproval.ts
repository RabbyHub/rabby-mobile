import { removeGlobalBottomSheetModal } from '@/components/GlobalBottomSheetModal';
import { notificationService } from '@/core/services';
import { Approval } from '@/core/services/notification';
import React, { useCallback } from 'react';
import { useApprovalPopup } from './useApprovalPopup';

export const useApproval = () => {
  const getApproval: () => Promise<Approval | null> = useCallback(async () => {
    const approval = notificationService.getApproval();
    return approval;
  }, []);
  const { showPopup, enablePopup, closePopup } = useApprovalPopup();

  const resolveApproval = async (
    data?: any,
    stay = false,
    forceReject = false,
    approvalId?: string,
  ) => {
    const approval = await getApproval();

    if (approval) {
      notificationService.resolveApproval(data, forceReject, approvalId);
    }
    if (stay) {
      return;
    }
    setTimeout(() => {
      if (data && enablePopup(data.type)) {
        return showPopup();
      } else {
        closePopup();
      }
      removeGlobalBottomSheetModal(notificationService.notifyWindowId);
    }, 0);
  };

  const rejectApproval = async (err?, stay = false, isInternal = false) => {
    const approval = await getApproval();
    if (approval?.data?.params?.data?.[0]?.isCoboSafe) {
      // wallet.coboSafeResetCurrentAccount();
    }

    if (approval) {
      await notificationService.rejectApproval(err, stay, isInternal);
    }
    if (!stay) {
      // history.push('/');
    }
  };

  React.useEffect(() => {
    // if (!getUiType().isNotification) {
    //   return;
    // }
    // window.addEventListener('beforeunload', rejectApproval);
    // return () => window.removeEventListener('beforeunload', rejectApproval);
  }, []);

  return [getApproval, resolveApproval, rejectApproval] as const;
};
