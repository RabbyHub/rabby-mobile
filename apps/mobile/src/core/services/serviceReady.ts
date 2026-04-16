import { createDeferred, type Deferred } from '@rabby-wallet/base-utils';

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
  getServiceDeferred<T>(serviceName).resolve(service);
}

export function getServiceReady<T>(serviceName: ServiceReadyKey | string) {
  return Promise.resolve(
    (serviceRefs.get(serviceName) as T | undefined) ??
      getServiceDeferred<T>(serviceName).promise,
  );
}
