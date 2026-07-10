import type { PerpsService } from '@/core/services/perpsService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type PerpsServiceApiContract = PerpsService;

registerLegacyCoreServiceLoader('perpsService');

export const perpsServiceApi = createDeferredServiceApi<
  'perpsService',
  PerpsServiceApiContract
>('perpsService');
