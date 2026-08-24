import type {
  CustomTestnetService,
  CutsomTestnetServiceStore,
} from '@/core/services/customTestnetService';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { getLoadedCoreService } from '@/core/services/serviceRegistry';
import {
  markCustomTestnetStoreHydrating,
  markCustomTestnetStoreHydrationFailed,
  syncCustomTestnetStore,
  useCustomTestnetStore,
} from '@/store/customTestnet';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type CustomTestnetServiceApiContract = CustomTestnetService;
export const customTestnetServiceApi = createDeferredServiceApi<
  'customTestnetService',
  CustomTestnetServiceApiContract
>('customTestnetService');

/**
 * Publishes the persisted custom-network snapshot without activating the full
 * viem-backed service. Callers that need a final empty-state decision must
 * cross this boundary instead of treating the store's initial empty values as
 * data.
 */
export function ensureCustomTestnetStoreHydrated() {
  if (useCustomTestnetStore.getState().hydrationState === 'ready') {
    return;
  }

  markCustomTestnetStoreHydrating();
  try {
    syncCustomTestnetStore(getCustomTestnetStoreSnapshot());
  } catch (error) {
    markCustomTestnetStoreHydrationFailed();
    throw error;
  }
}

export function getCustomTestnetStoreSnapshot(): CutsomTestnetServiceStore {
  const loadedSnapshot = getLoadedCoreService(
    'customTestnetService',
  )?.getStoreSnapshot();
  if (loadedSnapshot) {
    return loadedSnapshot;
  }

  const persisted = appStorage.getItem(
    APP_STORE_NAMES.customTestnet,
  ) as Partial<CutsomTestnetServiceStore> | null;

  return {
    customTestnet:
      persisted?.customTestnet && typeof persisted.customTestnet === 'object'
        ? persisted.customTestnet
        : {},
    customTokenList: Array.isArray(persisted?.customTokenList)
      ? persisted.customTokenList
      : [],
  };
}
