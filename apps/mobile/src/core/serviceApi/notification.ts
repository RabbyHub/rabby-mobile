import type { NotificationService } from '@/core/services/notification';
import {
  callCoreService,
  getRegisteredService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type NotificationServiceApiContract = NotificationService;

registerLegacyCoreServiceLoader('notificationService');

export const notificationServiceApi = createDeferredServiceApi<
  'notificationService',
  NotificationServiceApiContract
>('notificationService');

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
  return getRegisteredService('notificationService')?.currentMiniApproval || null;
}

export function setCurrentMiniApprovalSnapshot(
  value: NotificationService['currentMiniApproval'],
) {
  const service = getRegisteredService('notificationService');
  if (service) {
    service.currentMiniApproval = value;
  }
}

export function setCurrentRequestDeferFnSync(
  value: Parameters<NotificationService['setCurrentRequestDeferFn']>[0],
) {
  const service = getRegisteredService('notificationService');
  if (!service) {
    throw new Error('notificationService is not ready');
  }
  service.setCurrentRequestDeferFn(value);
}

export function getNotificationStatsDataSnapshot() {
  return getRegisteredService('notificationService')?.getStatsData();
}

export function setNotificationStatsDataSync(
  ...args: Parameters<NotificationService['setStatsData']>
) {
  const service = getRegisteredService('notificationService');
  if (!service) {
    throw new Error('notificationService is not ready');
  }
  service.setStatsData(...args);
}

export function unlockNotificationSync() {
  const service = getRegisteredService('notificationService');
  if (!service) {
    throw new Error('notificationService is not ready');
  }
  service.unLock();
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
