import { USD_CURRENCY } from '@/constant/currency';
import type {
  CurrencyService,
  CurrencyServiceStore,
} from '@/core/services/currencyService';
import type { FieldNilable } from '@rabby-wallet/base-utils';
import {
  getRegisteredService,
  waitForCoreService,
} from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type CurrencyServiceApiContract = CurrencyService;

registerLegacyCoreServiceLoader('currencyService');

export const currencyServiceApi = createDeferredServiceApi<
  'currencyService',
  CurrencyServiceApiContract
>('currencyService');

const EMPTY_CURRENCY_STORE: CurrencyServiceStore = {
  data: {
    currencyList: [USD_CURRENCY],
    updatedAt: 0,
    currency: USD_CURRENCY.code,
  },
};

export function getCurrencyStoreSnapshot() {
  return getRegisteredService('currencyService')?.store || EMPTY_CURRENCY_STORE;
}

export async function bindCurrencyStoreListener(
  listener: <K extends keyof CurrencyServiceStore>(
    key: K,
    value: FieldNilable<CurrencyServiceStore>[K],
  ) => void,
) {
  const service = await waitForCoreService('currencyService');
  listener('data', service.store.data);
  return service.setBeforeSetKV(listener);
}
