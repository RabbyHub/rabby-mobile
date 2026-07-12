import { USD_CURRENCY } from '@/constant/currency';
import type {
  CurrencyService,
  CurrencyServiceStore,
} from '@/core/services/currencyService';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
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

function normalizeCurrencyStoreSnapshot(
  store: CurrencyServiceStore | null,
): CurrencyServiceStore {
  const data = store?.data;
  if (!data) {
    return EMPTY_CURRENCY_STORE;
  }

  const currencyList = data.currencyList?.length
    ? data.currencyList
    : EMPTY_CURRENCY_STORE.data.currencyList;
  const currency = data.currency || EMPTY_CURRENCY_STORE.data.currency;

  return {
    data: {
      currencyList,
      currency,
      updatedAt:
        typeof data.updatedAt === 'number'
          ? data.updatedAt
          : EMPTY_CURRENCY_STORE.data.updatedAt,
    },
  };
}

export function getCurrencyStoreSnapshot() {
  const registeredStore = getRegisteredService('currencyService')?.store;
  if (registeredStore) {
    return registeredStore;
  }

  return normalizeCurrencyStoreSnapshot(
    appStorage.getItem(APP_STORE_NAMES.currency) as CurrencyServiceStore | null,
  );
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
