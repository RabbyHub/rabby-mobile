import {
  presentGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { notificationService } from '@/core/services';
import { Approval } from '@/core/services/notification';
import { eventBus, EVENT_ACTIVE_WINDOW } from '@/utils/events';
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
    let currentNotificationId = notificationService.notifyWindowId;
    // this is a main approval, no child approval
    if (!data || !enablePopup(data.type)) {
      notificationService.notifyWindowId = null;
    }

    setTimeout(() => {
      console.log('resolve', data);
      if (data && enablePopup(data.type)) {
        console.log('showPopup');
        return showPopup();
      }
      if (data?.uiRequestComponent) {
        closePopup();
        removeGlobalBottomSheetModal(currentNotificationId);
        return showPopup();
      }

      closePopup();
      eventBus.emit(EVENT_ACTIVE_WINDOW, currentNotificationId);
    }, 0);
  };

  const rejectApproval = async (err?, stay = false, isInternal = false) => {
    let currentNotificationId = notificationService.notifyWindowId;

    closePopup();
    const approval = await getApproval();
    if (approval?.data?.params?.data?.[0]?.isCoboSafe) {
      // wallet.coboSafeResetCurrentAccount();
    }

    if (approval) {
      await notificationService.rejectApproval(err, stay, isInternal);
    }
    if (!stay) {
      eventBus.emit(EVENT_ACTIVE_WINDOW, currentNotificationId);
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
