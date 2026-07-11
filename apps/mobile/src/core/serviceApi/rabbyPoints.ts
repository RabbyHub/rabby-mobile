import type { RabbyPointsService } from '@/core/services/rabbyPoints';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type RabbyPointsServiceApiContract = RabbyPointsService;

registerLegacyCoreServiceLoader('rabbyPointsService');

export const rabbyPointsServiceApi = createDeferredServiceApi<
  'rabbyPointsService',
  RabbyPointsServiceApiContract
>('rabbyPointsService');
