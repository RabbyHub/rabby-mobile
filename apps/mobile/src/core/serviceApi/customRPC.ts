import type { CustomRPCService } from '@/core/services/customRPCService';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type CustomRPCServiceApiContract = CustomRPCService;

registerLegacyCoreServiceLoader('customRPCService');

export const customRPCServiceApi = createDeferredServiceApi<
  'customRPCService',
  CustomRPCServiceApiContract
>('customRPCService');
