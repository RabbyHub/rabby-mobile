import { createDeferred, type Deferred } from '@rabby-wallet/base-utils';
import { recordApprovalProbe } from '@/debug/approvalProbe';

export const SERVICE_READY_KEYS = {
  contactService: 'contactService',
  keyringService: 'keyringService',
  dappService: 'dappService',
  customTestnetService: 'customTestnetService',
  customRPCService: 'customRPCService',
  browserHistoryService: 'browserHistoryService',
  sessionService: 'sessionService',
  preferenceService: 'preferenceService',
  whitelistService: 'whitelistService',
  transactionHistoryService: 'transactionHistoryService',
  notificationService: 'notificationService',
  transactionWatcherService: 'transactionWatcherService',
  transactionBroadcastWatcherService: 'transactionBroadcastWatcherService',
  securityEngineService: 'securityEngineService',
  autoConnectService: 'autoConnectService',
  rabbyPointsService: 'rabbyPointsService',
  swapService: 'swapService',
  hdKeyringService: 'hdKeyringService',
  bridgeService: 'bridgeService',
  gasAccountService: 'gasAccountService',
  offlineChainService: 'offlineChainService',
  browserService: 'browserService',
  metamaskModeService: 'metamaskModeService',
  syncChainService: 'syncChainService',
  perpsService: 'perpsService',
  currencyService: 'currencyService',
  lendingService: 'lendingService',
} as const;

export type ServiceReadyKey =
  (typeof SERVICE_READY_KEYS)[keyof typeof SERVICE_READY_KEYS];

const serviceRefs = new Map<string, unknown>();
const serviceDeferreds = new Map<string, Deferred<any>>();
const loggedServiceRegisters = new Set<string>();
const loggedServiceWaits = new Set<string>();
const loggedServiceWaitResolves = new Set<string>();

function getServiceDeferred<T>(serviceName: string) {
  const deferred = serviceDeferreds.get(serviceName);
  if (deferred) {
    return deferred as Deferred<T>;
  }

  const nextDeferred = createDeferred<T>();
  serviceDeferreds.set(serviceName, nextDeferred);
  return nextDeferred;
}

export function registerServiceReady<T>(
  serviceName: ServiceReadyKey | string,
  service: T,
) {
  if (serviceRefs.get(serviceName) === service) {
    return;
  }

  serviceRefs.set(serviceName, service);
  if (!loggedServiceRegisters.has(serviceName)) {
    loggedServiceRegisters.add(serviceName);
    recordApprovalProbe('SERVICE_READY_REGISTER', {
      serviceName,
    });
  }
  getServiceDeferred<T>(serviceName).resolve(service);
}

export function getServiceReady<T>(serviceName: ServiceReadyKey | string) {
  const registeredService = serviceRefs.get(serviceName) as T | undefined;
  if (registeredService) {
    return Promise.resolve(registeredService);
  }

  if (!loggedServiceWaits.has(serviceName)) {
    loggedServiceWaits.add(serviceName);
    recordApprovalProbe('SERVICE_READY_WAIT', {
      serviceName,
    });
  }

  return getServiceDeferred<T>(serviceName).promise.then(service => {
    if (!loggedServiceWaitResolves.has(serviceName)) {
      loggedServiceWaitResolves.add(serviceName);
      recordApprovalProbe('SERVICE_READY_WAIT_RESOLVED', {
        serviceName,
      });
    }

    return service;
  });
}
