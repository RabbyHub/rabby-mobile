import type { SwapService } from '@/core/services/swap';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type SwapServiceApiContract = SwapService;
export const swapServiceApi = createDeferredServiceApi<
  'swapService',
  SwapServiceApiContract
>('swapService');
