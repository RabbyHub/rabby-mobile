import type { MetamaskModeService } from '@/core/services/metamaskModeService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type MetamaskModeServiceApiContract = MetamaskModeService;

registerLegacyCoreServiceLoader('metamaskModeService');

export const metamaskModeServiceApi = createDeferredServiceApi<
  'metamaskModeService',
  MetamaskModeServiceApiContract
>('metamaskModeService');
