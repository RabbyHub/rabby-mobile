import type { CustomTestnetService } from '@/core/services/customTestnetService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type CustomTestnetServiceApiContract = CustomTestnetService;
export const customTestnetServiceApi = createDeferredServiceApi<
  'customTestnetService',
  CustomTestnetServiceApiContract
>('customTestnetService');
