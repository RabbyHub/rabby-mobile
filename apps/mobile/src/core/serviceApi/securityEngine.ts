import type { SecurityEngineService } from '@/core/services/securityEngine';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type SecurityEngineServiceApiContract = SecurityEngineService;

registerLegacyCoreServiceLoader('securityEngineService');

export const securityEngineServiceApi = createDeferredServiceApi<
  'securityEngineService',
  SecurityEngineServiceApiContract
>('securityEngineService');
