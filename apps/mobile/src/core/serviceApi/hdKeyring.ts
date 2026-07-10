import type { HDKeyringService } from '@/core/services/hdKeyringService';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type HDKeyringServiceApiContract = HDKeyringService;

registerLegacyCoreServiceLoader('hdKeyringService');

export const hdKeyringServiceApi = createDeferredServiceApi<
  'hdKeyringService',
  HDKeyringServiceApiContract
>('hdKeyringService');

export function addHdKeyringUnixRecordSync(
  ...args: Parameters<HDKeyringService['addUnixRecord']>
) {
  const service = getRegisteredService('hdKeyringService');
  if (!service) {
    throw new Error('hdKeyringService is not ready');
  }
  service.addUnixRecord(...args);
}
