import type { NotificationService } from '@/core/services/notification';
import {
  callCoreService,
  getRegisteredService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  runServiceSideEffectWhenReady,
} from './createDeferredServiceApi';

export type NotificationServiceApiContract = NotificationService;
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
  return (
    getRegisteredService('notificationService')?.currentMiniApproval || null
  );
}

export function setCurrentMiniApprovalSync(
  value: NotificationService['currentMiniApproval'],
) {
  runServiceSideEffectWhenReady(
    'notificationService',
    service => {
      service.currentMiniApproval = value;
    },
    'notificationService.setCurrentMiniApproval',
  );
}

export function setCurrentRequestDeferFnSync(
  value: Parameters<NotificationService['setCurrentRequestDeferFn']>[0],
) {
  runServiceSideEffectWhenReady(
    'notificationService',
    service => service.setCurrentRequestDeferFn(value),
    'notificationService.setCurrentRequestDeferFn',
  );
}

export function getNotificationStatsDataSnapshot() {
  return getRegisteredService('notificationService')?.getStatsData();
}

export function setNotificationStatsDataSync(
  ...args: Parameters<NotificationService['setStatsData']>
) {
  runServiceSideEffectWhenReady(
    'notificationService',
    service => service.setStatsData(...args),
    'notificationService.setStatsData',
  );
}

export function unlockNotificationSync() {
  runServiceSideEffectWhenReady(
    'notificationService',
    service => service.unLock(),
    'notificationService.unLock',
  );
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
