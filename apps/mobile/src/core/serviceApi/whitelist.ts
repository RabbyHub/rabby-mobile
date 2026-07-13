import type { WhitelistService } from '@/core/services/whitelist';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type WhitelistServiceApiContract = WhitelistService;
export const whitelistServiceApi = createDeferredServiceApi<
  'whitelistService',
  WhitelistServiceApiContract
>('whitelistService');
