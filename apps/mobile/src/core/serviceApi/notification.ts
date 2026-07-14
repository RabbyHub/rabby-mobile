import type { NotificationService } from '@/core/services/notification';
import {
  callCoreService,
  getRegisteredService,
  requireCoreService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  ensureServiceApiReady,
} from './createDeferredServiceApi';

export type NotificationServiceApiContract = NotificationService;
export const notificationServiceApi = createDeferredServiceApi<
  'notificationService',
  NotificationServiceApiContract
>('notificationService');

export function ensureNotificationServiceReady() {
  return ensureServiceApiReady('notificationService');
}

function requireNotificationService() {
  return requireCoreService('notificationService');
}

export function getNotificationApprovalCountSnapshot() {
  return getRegisteredService('notificationService')?.approvals.length || 0;
}

export function getNotificationWindowIdSnapshot() {
  return getRegisteredService('notificationService')?.notifyWindowId || null;
}

export function getShouldDisplayBlockedRequestApprovalSnapshot() {
  return (
    getRegisteredService(
      'notificationService',
    )?.checkNeedDisplayBlockedRequestApproval() || false
  );
}

export function getShouldDisplayCancelAllApprovalSnapshot() {
  return (
    getRegisteredService(
      'notificationService',
    )?.checkNeedDisplayCancelAllApproval() || false
  );
}

export function getCurrentMiniApprovalSnapshot() {
  return (
    getRegisteredService('notificationService')?.currentMiniApproval || null
  );
}

export function setCurrentMiniApprovalSync(
  value: NotificationService['currentMiniApproval'],
) {
  requireNotificationService().currentMiniApproval = value;
}

export function setCurrentRequestDeferFnSync(
  value: Parameters<NotificationService['setCurrentRequestDeferFn']>[0],
) {
  requireNotificationService().setCurrentRequestDeferFn(value);
}

export function getNotificationStatsDataSnapshot() {
  return getRegisteredService('notificationService')?.getStatsData();
}

export function setNotificationStatsDataSync(
  ...args: Parameters<NotificationService['setStatsData']>
) {
  requireNotificationService().setStatsData(...args);
}

export function unlockNotificationSync() {
  requireNotificationService().unLock();
}

export async function bindNotificationEvent(
  event: string,
  listener: (...args: any[]) => void,
) {
  await callCoreService('notificationService', service => {
    service.on(event, listener);
  });

  return () => {
    void callCoreService('notificationService', service => {
      service.off(event, listener);
    }).catch(console.error);
  };
}
