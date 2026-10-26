import type { AutoConnectService } from '@/core/services/autoConnect';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type AutoConnectServiceApiContract = AutoConnectService;
export const autoConnectServiceApi = createDeferredServiceApi<
  'autoConnectService',
  AutoConnectServiceApiContract
>('autoConnectService');
