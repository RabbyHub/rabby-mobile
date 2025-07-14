import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import dayjs from 'dayjs';
import axios from 'axios';

type MetamaskModeServiceStore = {
  data: {
    sites: string[];
    updatedAt: number;
  };
};

export class MetamaskModeService extends StoreServiceBase<
  MetamaskModeServiceStore,
  'metamaskMode'
> {
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: StorageAdapaterOptions<MetamaskModeServiceStore>) {
    super(
      APP_STORE_NAMES.metamaskMode,
      {
        data: {
          sites: [],
          updatedAt: 0,
        },
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );

    this.store.data.updatedAt = this.store.data.updatedAt || 0;
    this.syncMetamaskModeList();
    this.resetTimer();
  }

  syncMetamaskModeList = async () => {
    if (
      dayjs().isBefore(dayjs(this.store.data.updatedAt || 0).add(25, 'minute'))
    ) {
      return [];
    }
    try {
      const sites = await axios
        .get('https://static.debank.com/fake_mm_dapps.json')
        .then(res => {
          return res.data as string[];
        });
      this.store.data = {
        sites,
        updatedAt: Date.now(),
      };
    } catch (e) {
      console.error('fetch metamask list error: ', e);
    }
  };

  resetTimer = () => {
    const periodInMinutes = 30;
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.syncMetamaskModeList();
    }, periodInMinutes * 60 * 1000);
  };

  checkIsMetamaskMode(origin: string) {
    return !!this.store.data.sites.find(
      item => item === origin.replace(/^https?:\/\//, ''),
    );
  }
}
