import type { CustomRPCService } from '@/core/services/customRPCService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type CustomRPCServiceApiContract = CustomRPCService;
export const customRPCServiceApi = createDeferredServiceApi<
  'customRPCService',
  CustomRPCServiceApiContract
>('customRPCService');
