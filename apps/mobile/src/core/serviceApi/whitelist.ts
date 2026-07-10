import type { WhitelistService } from '@/core/services/whitelist';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type WhitelistServiceApiContract = WhitelistService;

registerLegacyCoreServiceLoader('whitelistService');

export const whitelistServiceApi = createDeferredServiceApi<
  'whitelistService',
  WhitelistServiceApiContract
>('whitelistService');
