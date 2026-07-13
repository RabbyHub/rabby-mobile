import type { PerpsService } from '@/core/services/perpsService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type PerpsServiceApiContract = PerpsService;
export const perpsServiceApi = createDeferredServiceApi<
  'perpsService',
  PerpsServiceApiContract
>('perpsService');
