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
import { CHAINS_ENUM, updateChainStore } from '@/constant/chains';
import cloneDeep from 'lodash.clonedeep';

type SyncChainServiceStore = {
  data: {
    chains: Chain[];
    updatedAt: number;
  };
};

export type SyncMainnetChainListOptions = {
  force?: boolean;
};

export type SyncChainServiceOptions =
  StorageAdapaterOptions<SyncChainServiceStore> & {
    /** Called after a fetched mainnet list has replaced the current one. */
    onMainnetChainListUpdated?: () => void;
  };

export class SyncChainService extends StoreServiceBase<
  SyncChainServiceStore,
  APP_STORE_NAMES.syncChain
> {
  timer: ReturnType<typeof setInterval> | null = null;
  private syncPromise: Promise<void> | null = null;
  private onMainnetChainListUpdated?: () => void;

  constructor(options?: SyncChainServiceOptions) {
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
    this.onMainnetChainListUpdated = options?.onMainnetChainListUpdated;

    if (!this.store.data.updatedAt) {
      this.mutateStore(draft => {
        draft.data.updatedAt = 0;
      });
    }
    if (this.store.data.chains.length) {
      updateChainStore({
        mainnetList: this.getStoreFieldSnapshot('data').chains,
      });
    }
    this.syncMainnetChainList();
    this.resetTimer();
  }

  /**
   * Whether the chain store holds a synced mainnet list, cached or fetched.
   * Until then it only has the bundled list, which misses newer chains.
   */
  hasSyncedMainnetList = () =>
    this.store.data.chains.some(chain => chain.enum === CHAINS_ENUM.ETH);

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
      // ETH is the fallback chain everywhere, a list without it is broken
      if (!list.some(item => item.enum === CHAINS_ENUM.ETH)) {
        throw new Error('invalid mainnet chain list');
      }

      updateChainStore({
        mainnetList: list,
      });
      this.mutateStore(draft => {
        draft.data.chains = list;
        draft.data.updatedAt = Date.now();
      });
    } catch (error) {
      console.error('fetch chain list error: ', error);
      return;
    }

    try {
      this.onMainnetChainListUpdated?.();
    } catch (error) {
      console.error('handle chain list update error: ', error);
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
