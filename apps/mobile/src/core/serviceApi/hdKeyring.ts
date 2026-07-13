import type { HDKeyringService } from '@/core/services/hdKeyringService';
import {
  createDeferredServiceApi,
  runServiceSideEffectWhenReady,
} from './createDeferredServiceApi';

export type HDKeyringServiceApiContract = HDKeyringService;
export const hdKeyringServiceApi = createDeferredServiceApi<
  'hdKeyringService',
  HDKeyringServiceApiContract
>('hdKeyringService');

export function addHdKeyringUnixRecordSync(
  ...args: Parameters<HDKeyringService['addUnixRecord']>
) {
  runServiceSideEffectWhenReady(
    'hdKeyringService',
    service => service.addUnixRecord(...args),
    'hdKeyringService.addUnixRecord',
  );
}
