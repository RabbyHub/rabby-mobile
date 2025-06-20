import { notificationService } from '@/core/services';
import { Approval } from '@/core/services/notification';
import { eventBus, EVENT_ACTIVE_WINDOW } from '@/utils/events';
import React, { useCallback } from 'react';
import { useApprovalPopup } from './useApprovalPopup';
import { useDeviceConnect } from './useDeviceConnect';
import { toast } from '@/components2024/Toast';

export const useApproval = () => {
  const getApproval: () => Promise<Approval | null> = useCallback(async () => {
    const approval = notificationService.getApproval();
    return approval;
  }, []);
  const { showPopup, enablePopup, closePopup } = useApprovalPopup();
  const deviceConnect = useDeviceConnect();

  const resolveApproval = async (
    data?: any,
    stay = false,
    forceReject = false,
    approvalId?: string,
  ) => {
    console.log('deviceConnect before', deviceConnect(data));
    // handle connect
    if (!deviceConnect(data)) {
      return;
    }

    console.log('in resolveApproval getApproval before');

    const approval = await getApproval();

    if (approval) {
      notificationService.resolveApproval(data, forceReject, approvalId);
    }

    console.log('in resolveApproval getApproval after');

    if (stay) {
      return;
    }

    let currentNotificationId = notificationService.notifyWindowId;

    setTimeout(() => {
      console.log('showPopup', !!data && !!enablePopup(data.type));

      if (data && enablePopup(data.type)) {
        return showPopup();
      }

      console.log('closePopup');

      closePopup();
      eventBus.emit(EVENT_ACTIVE_WINDOW, currentNotificationId);
    }, 0);
  };

  const rejectApproval = async (err?, stay = false, isInternal = false) => {
    let currentNotificationId = notificationService.notifyWindowId;
    toast.info('reject');
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
