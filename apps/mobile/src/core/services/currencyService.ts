import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '../request';
import dayjs from 'dayjs';

export type CurrencyServiceStore = {
  data: {
    currencyList: CurrencyItem[];
    updatedAt: number;
    currency: string;
  };
};

export class CurrencyService extends StoreServiceBase<
  CurrencyServiceStore,
  APP_STORE_NAMES.currency
> {
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: StorageAdapaterOptions<CurrencyServiceStore>) {
    super(
      APP_STORE_NAMES.currency,
      {
        data: {
          currencyList: [],
          updatedAt: 0,
          currency: 'USD',
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.resetTimer();
  }

  setStore(payload: Partial<CurrencyServiceStore['data']>) {
    this.store.data = {
      ...this.store.data,
      ...payload,
    };
  }

  syncCurrencyList = async (isForce?: boolean) => {
    if (
      dayjs().isBefore(dayjs(this.store.data.updatedAt).add(9, 'minute')) &&
      !isForce
    ) {
      return;
    }
    try {
      const list = await openapi.getCurrencyList();

      this.store.data = {
        ...this.store.data,
        currencyList: list,
        updatedAt: Date.now(),
      };
    } catch (e) {
      console.error('fetch currency list error: ', e);
    }
  };

  resetTimer = () => {
    const periodInMinutes = 10;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.syncCurrencyList(true);

    this.timer = setInterval(() => {
      this.syncCurrencyList();
    }, periodInMinutes * 60 * 1000);
  };
}
