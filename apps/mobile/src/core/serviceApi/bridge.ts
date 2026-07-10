import type { BridgeService } from '@/core/services/bridge';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type BridgeServiceApiContract = BridgeService;

registerLegacyCoreServiceLoader('bridgeService');

export const bridgeServiceApi = createDeferredServiceApi<
  'bridgeService',
  BridgeServiceApiContract
>('bridgeService');
