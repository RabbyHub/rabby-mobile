import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import dayjs from 'dayjs';
import axios from 'axios';
import { Chain } from '@debank/common';
import { SupportedChain } from '@rabby-wallet/rabby-api/dist/types';
import { supportedChainToChain } from '@/isomorphic/chain';
import { updateChainStore } from '@/constant/chains';

type CurrencyServiceStore = {
  data: {
    currencyList: {
      currency_name: string;
      currency_code: string;
      usd_exchange_rate: number;
      country_logo_url: string;
    }[];
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

  syncCurrencyList = async () => {
    // if (dayjs().isBefore(dayjs(this.store.data.updatedAt).add(55, 'minute'))) {
    //   return;
    // }
    try {
      const list = [
        {
          currency_code: '$',
          currency_name: 'USD',
          country_logo_url: 'https://xxx',
          usd_exchange_rate: 1,
        },
        {
          currency_code: '¥',
          currency_name: 'CNY',
          country_logo_url: 'https://xxx',
          usd_exchange_rate: 7,
        },
      ];

      this.store.data = {
        ...this.store.data,
        currencyList: list,
        updatedAt: Date.now(),
      };
    } catch (e) {
      console.error('fetch chain list error: ', e);
    }
  };

  resetTimer = () => {
    const periodInMinutes = 60;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.syncCurrencyList();

    this.timer = setInterval(() => {
      this.syncCurrencyList();
    }, periodInMinutes * 60 * 1000);
  };
}
