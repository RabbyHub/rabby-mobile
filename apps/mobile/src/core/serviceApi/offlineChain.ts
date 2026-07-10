import type { OfflineChainService } from '@/core/services/offlineChain';
import {
  callCoreService,
  getRegisteredService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type OfflineChainServiceApiContract = OfflineChainService;

registerLegacyCoreServiceLoader('offlineChainService');

export const offlineChainServiceApi = createDeferredServiceApi<
  'offlineChainService',
  OfflineChainServiceApiContract
>('offlineChainService');

export function getCloseTipsChainsSnapshot() {
  return getRegisteredService('offlineChainService')?.getCloseTipsChains() || [];
}

export async function setCloseTipsChains(chains: string[]) {
  await callCoreService('offlineChainService', service => {
    service.setCloseTipsChains(chains);
  });
}

export async function mockClearCloseTipsChains() {
  await callCoreService('offlineChainService', service => {
    service.mockClearCloseTipsChains();
  });
}
