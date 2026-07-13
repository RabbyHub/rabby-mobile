import { findChainByID } from '@/utils/chain';
import type { SyncChainService } from '@/core/services/syncChainService';
import {
  createDeferredServiceApi,
  ensureServiceApiReady,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type SyncChainServiceApiContract = Pick<
  SyncChainService,
  'syncMainnetChainList'
>;

registerLegacyCoreServiceLoader('syncChainService');

export const syncChainServiceApi = createDeferredServiceApi<
  'syncChainService',
  SyncChainServiceApiContract
>('syncChainService');

export function ensureSyncChainServiceReady() {
  return ensureServiceApiReady('syncChainService');
}

export async function ensureMainnetChainAvailable(chainId: number) {
  const cachedChain = findChainByID(chainId);
  if (cachedChain) {
    return cachedChain;
  }

  await syncChainServiceApi.syncMainnetChainList({ force: true });
  return findChainByID(chainId);
}
