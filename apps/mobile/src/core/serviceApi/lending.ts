import type { LendingService } from '@/core/services/lendingService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type LendingServiceApiContract = LendingService;
export const lendingServiceApi = createDeferredServiceApi<
  'lendingService',
  LendingServiceApiContract
>('lendingService');
