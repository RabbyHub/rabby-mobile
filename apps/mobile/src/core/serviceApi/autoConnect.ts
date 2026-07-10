import type { AutoConnectService } from '@/core/services/autoConnect';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type AutoConnectServiceApiContract = AutoConnectService;

registerLegacyCoreServiceLoader('autoConnectService');

export const autoConnectServiceApi = createDeferredServiceApi<
  'autoConnectService',
  AutoConnectServiceApiContract
>('autoConnectService');
