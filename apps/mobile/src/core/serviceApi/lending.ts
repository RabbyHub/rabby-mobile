import type { LendingService } from '@/core/services/lendingService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type LendingServiceApiContract = LendingService;

registerLegacyCoreServiceLoader('lendingService');

export const lendingServiceApi = createDeferredServiceApi<
  'lendingService',
  LendingServiceApiContract
>('lendingService');
