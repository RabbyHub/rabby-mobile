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

export type SyncMainnetChainListOptions = {
  force?: boolean;
};

export class SyncChainService extends StoreServiceBase<
  SyncChainServiceStore,
  APP_STORE_NAMES.syncChain
> {
  timer: ReturnType<typeof setInterval> | null = null;
  private syncPromise: Promise<void> | null = null;

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

  syncMainnetChainList = (
    options: SyncMainnetChainListOptions = {},
  ): Promise<void> => {
    if (
      !options.force &&
      this.store.data.chains.length > 0 &&
      dayjs().isBefore(dayjs(this.store.data.updatedAt).add(55, 'minute'))
    ) {
      return Promise.resolve();
    }

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.fetchMainnetChainList().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  };

  private fetchMainnetChainList = async () => {
    try {
      const chains = await axios
        .get('https://static.debank.com/supported_chains.json')
        .then(res => res.data as SupportedChain[]);
      const list = chains
        .filter(item => !item.is_disabled)
        .map(item => supportedChainToChain(item));

      updateChainStore({
        mainnetList: list,
      });
      this.store.data = {
        chains: list,
        updatedAt: Date.now(),
      };
    } catch (error) {
      console.error('fetch chain list error: ', error);
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
