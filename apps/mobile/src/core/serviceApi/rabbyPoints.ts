import type { RabbyPointsService } from '@/core/services/rabbyPoints';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type RabbyPointsServiceApiContract = RabbyPointsService;
export const rabbyPointsServiceApi = createDeferredServiceApi<
  'rabbyPointsService',
  RabbyPointsServiceApiContract
>('rabbyPointsService');
