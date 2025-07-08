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

type SyncChainServiceStore = {
  data: {
    chains: Chain[];
    updatedAt: number;
  };
};

export class SyncChainService extends StoreServiceBase<
  SyncChainServiceStore,
  APP_STORE_NAMES.syncChain
> {
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: StorageAdapaterOptions<SyncChainServiceStore>) {
    super(
      APP_STORE_NAMES.syncChain,
      {
        data: {
          chains: [],
          updatedAt: 0,
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.store.data.updatedAt = this.store.data.updatedAt || 0;
    if (this.store.data.chains.length) {
      updateChainStore({
        mainnetList: this.store.data.chains,
      });
    }
    this.syncMainnetChainList();
    this.resetTimer();
  }

  syncMainnetChainList = async () => {
    if (dayjs().isBefore(dayjs(this.store.data.updatedAt).add(55, 'minute'))) {
      return;
    }
    try {
      const chains = await axios
        .get('https://static.debank.com/supported_chains.json')
        .then(res => {
          return res.data as SupportedChain[];
        });
      const list: Chain[] = chains
        .filter(item => !item.is_disabled)
        .map(item => {
          const chain: Chain = supportedChainToChain(item);
          return chain;
        });
      updateChainStore({
        mainnetList: list,
      });

      this.store.data = {
        chains: list,
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

    this.timer = setInterval(() => {
      this.syncMainnetChainList();
    }, periodInMinutes * 60 * 1000);
  };
}
