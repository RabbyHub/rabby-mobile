import type { SecurityEngineService } from '@/core/services/securityEngine';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type SecurityEngineServiceApiContract = SecurityEngineService;
export const securityEngineServiceApi = createDeferredServiceApi<
  'securityEngineService',
  SecurityEngineServiceApiContract
>('securityEngineService');
