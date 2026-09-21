import type { HDKeyringService } from '@/core/services/hdKeyringService';
import { createDeferredServiceApi } from './createDeferredServiceApi';

export type HDKeyringServiceApiContract = HDKeyringService;
export const hdKeyringServiceApi = createDeferredServiceApi<
  'hdKeyringService',
  HDKeyringServiceApiContract
>('hdKeyringService');
