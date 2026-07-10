import type { SwapService } from '@/core/services/swap';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type SwapServiceApiContract = SwapService;

registerLegacyCoreServiceLoader('swapService');

export const swapServiceApi = createDeferredServiceApi<
  'swapService',
  SwapServiceApiContract
>('swapService');
