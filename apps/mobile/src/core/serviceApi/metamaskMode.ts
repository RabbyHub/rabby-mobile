import type { MetamaskModeService } from '@/core/services/metamaskModeService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type MetamaskModeServiceApiContract = MetamaskModeService;
export const metamaskModeServiceApi = createDeferredServiceApi<
  'metamaskModeService',
  MetamaskModeServiceApiContract
>('metamaskModeService');
