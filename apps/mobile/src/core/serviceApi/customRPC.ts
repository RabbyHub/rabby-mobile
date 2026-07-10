import type { customRPCService } from '@/core/services/customRPCService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type CustomRPCServiceApiContract = typeof customRPCService;

registerLegacyCoreServiceLoader('customRPCService');

export const customRPCServiceApi = createDeferredServiceApi<
  'customRPCService',
  CustomRPCServiceApiContract
>('customRPCService');
