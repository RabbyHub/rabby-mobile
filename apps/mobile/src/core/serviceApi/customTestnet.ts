import type { CustomTestnetService } from '@/core/services/customTestnetService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type CustomTestnetServiceApiContract = CustomTestnetService;

registerLegacyCoreServiceLoader('customTestnetService');

export const customTestnetServiceApi = createDeferredServiceApi<
  'customTestnetService',
  CustomTestnetServiceApiContract
>('customTestnetService');
