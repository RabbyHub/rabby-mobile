import type { BridgeService } from '@/core/services/bridge';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type BridgeServiceApiContract = BridgeService;
export const bridgeServiceApi = createDeferredServiceApi<
  'bridgeService',
  BridgeServiceApiContract
>('bridgeService');
