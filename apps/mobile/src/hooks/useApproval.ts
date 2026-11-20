import type { Approval } from '@/core/services/notification';
import {
  getNotificationWindowIdSnapshot,
  notificationServiceApi,
} from '@/core/serviceApi/notification';
import { eventBus, EVENT_ACTIVE_WINDOW } from '@/utils/events';
import React, { useCallback } from 'react';
import { useApprovalPopup } from './useApprovalPopup';
import { useDeviceConnect } from './useDeviceConnect';
import {
  ApprovalIdentityContext,
  matchesApprovalIdentity,
} from './approvalIdentity';

export const useApproval = (security?: { canResolve: () => boolean }) => {
  const identity = React.useContext(ApprovalIdentityContext);
  const bound = !!security || !!identity;
  const getApproval: () => Promise<Approval | null> = useCallback(async () => {
    const approval = await notificationServiceApi.getApproval();
    if (bound && !matchesApprovalIdentity(approval, identity)) return null;
    return approval;
  }, [bound, identity]);
  const { showPopup, enablePopup, closePopup } = useApprovalPopup();
  const deviceConnect = useDeviceConnect();

  const resolveApproval = async (
    data?: any,
    stay = false,
    forceReject = false,
    approvalId?: string,
  ) => {
    if (security && (!identity || !security.canResolve())) return;
    // handle connect
    if (!deviceConnect(data)) {
      return;
    }

    const approval = await getApproval();

    if (
      bound &&
      (!matchesApprovalIdentity(approval, identity) ||
        (security && !security.canResolve()))
    )
      return;

    if (approval) {
      await notificationServiceApi.resolveApproval(
        data,
        forceReject,
        identity?.id || approvalId,
      );
    }
    if (stay) {
      return;
    }

    let currentNotificationId = getNotificationWindowIdSnapshot();

    setTimeout(() => {
      if (data && enablePopup(data.type)) {
        return showPopup(data.uiRequestComponent);
      }

      closePopup();
      eventBus.emit(EVENT_ACTIVE_WINDOW, currentNotificationId);
    }, 0);
  };

  const rejectApproval = async (err?, stay = false, isInternal = false) => {
    let currentNotificationId = getNotificationWindowIdSnapshot();

    closePopup();
    const approval = await getApproval();
    if (approval?.data?.params?.data?.[0]?.isCoboSafe) {
      // wallet.coboSafeResetCurrentAccount();
    }

    if (approval) {
      await notificationServiceApi.rejectApproval(
        err,
        stay,
        isInternal,
        identity?.id,
      );
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
