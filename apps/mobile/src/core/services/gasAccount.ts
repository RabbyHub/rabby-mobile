import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { Account } from './preference';
import { openapi } from '../request';

const CACHE_VALIDITY_PERIOD = 60 * 60 * 1000;

export type GasAccountRecord = {
  chain_id: string;
  token_id: string;
  amount: number;
};

export type ClaimedGiftAddress = {
  address: string;
  isEligible: boolean;
  isChecked: boolean;
  isClaimed: boolean;
  giftUsdValue: number;
};

export type GasAccountEligibilityCache = {
  [address: string]: {
    isEligible: boolean;
    timestamp: number;
    isChecked: boolean;
    isClaimed: boolean;
    giftUsdValue: number;
  };
};

export type GasAccountServiceStore = {
  accountId?: string;
  sig?: string;
  account?: {
    address: string;
    type: string;
    brandName: string;
  };
  lastDepositAccount?: Account;
  hasClaimedGift: boolean;
  // 资格检查缓存 - 使用对象存储，key为地址（小写）
  eligibilityCache: GasAccountEligibilityCache;
  lastEligibilityCheckTimestamp?: number;
  currentEligibleAddress?: ClaimedGiftAddress;
};

export class GasAccountService {
  store: GasAccountServiceStore = {
    sig: undefined,
    accountId: undefined,
    hasClaimedGift: false,
    eligibilityCache: {},
    lastEligibilityCheckTimestamp: undefined,
    currentEligibleAddress: undefined,
  };

  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<GasAccountServiceStore>(
      {
        name: APP_STORE_NAMES.gasAccount,
        template: {
          hasClaimedGift: false,
          eligibilityCache: {},
          lastEligibilityCheckTimestamp: undefined,
          currentEligibleAddress: undefined,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    this.store = storage || this.store;
  }

  getGasAccountData = (key?: keyof GasAccountServiceStore) => {
    return key ? this.store[key] : { ...this.store };
  };

  getGasAccountSig = () => {
    return { sig: this.store.sig, accountId: this.store.accountId };
  };

  setGasAccountSig = (
    sig?: string,
    account?: GasAccountServiceStore['account'],
  ) => {
    if (!sig || !account) {
      this.store.sig = undefined;
      this.store.accountId = undefined;
      this.store.account = undefined;
    } else {
      this.store.sig = sig;
      this.store.accountId = account?.address;
      this.store.account = {
        ...account!,
      };
    }
  };

  getLastDepositAccount = () => {
    return this.store.lastDepositAccount;
  };

  setLastDepositAccount = (account?: Account) => {
    this.store.lastDepositAccount = account;
  };

  getHasClaimedGift = (): boolean => {
    return this.store.hasClaimedGift;
  };

  setHasClaimedGift = (hasClaimed: boolean) => {
    this.store.hasClaimedGift = hasClaimed;
  };

  getCurrentEligibleAddress = (): ClaimedGiftAddress | undefined => {
    return this.store.currentEligibleAddress;
  };

  setCurrentEligibleAddress = (address: string) => {
    this.store.currentEligibleAddress = {
      address,
      isChecked: true,
      isEligible: true,
      isClaimed: false,
      giftUsdValue: 0,
    };
  };

  clearCurrentEligibleAddress = () => {
    this.store.currentEligibleAddress = undefined;
  };

  // 检查缓存是否有效
  private isCacheValid = (): boolean => {
    if (
      !this.store.eligibilityCache ||
      !this.store.lastEligibilityCheckTimestamp
    ) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.store.lastEligibilityCheckTimestamp;
    return cacheAge <= CACHE_VALIDITY_PERIOD;
  };

  // 清理过期缓存
  private clearExpiredCache = () => {
    if (!this.isCacheValid()) {
      this.store.eligibilityCache = {};
      this.store.lastEligibilityCheckTimestamp = undefined;
    }
  };

  // 批量检查地址资格（带缓存）
  checkAddressEligibilityBatch = async (addresses: string[], force = false) => {
    console.debug('checkAddressEligibilityBatch', addresses, force);
    // 检查缓存
    if (!force && this.isCacheValid() && this.store.eligibilityCache) {
      const result = this.getDataFromCache(addresses);
      if (result) {
        return result;
      }
    }

    // 缓存无效或强制刷新，调用API
    return await this.checkEligibilityFromAPI(addresses);
  };

  // 从缓存获取数据
  private getDataFromCache = (addresses: string[]) => {
    let allAddressesCached = true;
    addresses.forEach(addr => {
      if (!this.store.eligibilityCache![addr.toLowerCase()]) {
        allAddressesCached = false;
      }
    });

    if (allAddressesCached) {
      // 全部命中缓存
      return this.getFullyCachedData(addresses);
    } else {
      // 部分命中缓存，需要检查未缓存的地址
      return this.getPartiallyCachedData(addresses);
    }
  };

  // 获取完全缓存的数据
  private getFullyCachedData = (addresses: string[]) => {
    const filteredData: ClaimedGiftAddress[] = [];
    addresses.forEach(addr => {
      const item = this.store.eligibilityCache![addr.toLowerCase()];
      if (item) {
        filteredData.push({
          address: addr,
          isEligible: item.isEligible,
          isChecked: item.isChecked,
          isClaimed: item.isClaimed,
          giftUsdValue: item.giftUsdValue,
        });
      }
    });

    this.updateCurrentEligibleAddress(filteredData);
    return filteredData;
  };

  // 获取部分缓存的数据
  private getPartiallyCachedData = async (addresses: string[]) => {
    const cachedData: ClaimedGiftAddress[] = [];
    const uncachedAddresses: string[] = [];
    addresses.forEach(addr => {
      if (this.store.eligibilityCache![addr.toLowerCase()]) {
        cachedData.push({
          address: addr,
          isEligible:
            this.store.eligibilityCache![addr.toLowerCase()].isEligible,
          isChecked: this.store.eligibilityCache![addr.toLowerCase()].isChecked,
          isClaimed: this.store.eligibilityCache![addr.toLowerCase()].isClaimed,
          giftUsdValue:
            this.store.eligibilityCache![addr.toLowerCase()].giftUsdValue,
        });
      } else {
        uncachedAddresses.push(addr);
      }
    });

    // 检查未缓存的地址
    if (uncachedAddresses.length > 0) {
      try {
        const uncachedData = await this.checkUncachedAddresses(
          uncachedAddresses,
        );
        return this.mergeCachedAndUncachedData(cachedData, uncachedData);
      } catch (error) {
        console.error('Failed to check uncached addresses eligibility:', error);
        // 如果检查未缓存地址失败，返回已缓存的数据
        this.updateCurrentEligibleAddress(cachedData);
        return cachedData;
      }
    }

    return cachedData;
  };

  // 检查未缓存的地址
  private checkUncachedAddresses = async (uncachedAddresses: string[]) => {
    console.debug('checkUncachedAddresses', uncachedAddresses);
    const data = await openapi.checkGasAccountGiftEligibilityBatch({
      ids: uncachedAddresses,
    });
    console.debug('checkUncachedAddresses data', data);

    return data.map(item => ({
      address: item.id!,
      isEligible: item.has_eligibility,
      isChecked: true,
      isClaimed: false,
      giftUsdValue: item.can_claimed_usd_value,
    }));
  };

  // 合并缓存数据和新数据
  private mergeCachedAndUncachedData = (
    cachedData: ClaimedGiftAddress[],
    uncachedData: ClaimedGiftAddress[],
  ) => {
    // 查找第一个符合要求的地址（优先检查新数据）
    const firstEligible =
      uncachedData.find(item => item.isEligible) ||
      cachedData.find(item => item.isEligible);

    this.updateCurrentEligibleAddress(firstEligible);

    // 更新缓存，只保存不符合资格的新数据
    this.updateCacheWithNewData(uncachedData);

    // 合并缓存数据和新数据
    const allData = [...cachedData, ...uncachedData];

    return allData;
  };

  // 从API检查资格
  private checkEligibilityFromAPI = async (addresses: string[]) => {
    try {
      const data = await this.checkUncachedAddresses(addresses);
      // 查找第一个符合要求的地址
      const firstEligible = data.find(item => item.isEligible);

      if (firstEligible) {
        this.store.currentEligibleAddress = firstEligible;
        const result = [firstEligible];
        return result;
      }

      // 如果没有符合要求的地址，清除之前保存的有资格地址
      this.store.currentEligibleAddress = undefined;

      // 只缓存不符合资格的数据
      this.updateCacheWithNewData(data);

      return data;
    } catch (error) {
      console.error(
        'Failed to check gas account gift eligibility batch:',
        error,
      );
      throw error;
    }
  };

  // 更新当前有资格的地址
  private updateCurrentEligibleAddress = (
    data: ClaimedGiftAddress[] | ClaimedGiftAddress | undefined,
  ) => {
    if (Array.isArray(data)) {
      const firstEligible = data.find(item => item.isEligible);
      this.store.currentEligibleAddress = firstEligible;
    } else {
      this.store.currentEligibleAddress = data?.isEligible ? data : undefined;
    }
  };

  // 用新数据更新缓存
  private updateCacheWithNewData = (newData: ClaimedGiftAddress[]) => {
    const ineligibleData = newData.filter(
      item => !item.isEligible && !!item.address,
    );

    if (ineligibleData.length > 0) {
      // 直接更新对象缓存
      ineligibleData.forEach(item => {
        if (!item || !item.address) return;
        const addressKey = item.address?.toLowerCase() || '';
        if (!addressKey || addressKey === 'undefined') return;
        this.store.eligibilityCache[addressKey] = {
          isEligible: item.isEligible,
          timestamp: Date.now(),
          isChecked: item.isChecked,
          isClaimed: item.isClaimed,
          giftUsdValue: item.giftUsdValue,
        };
      });

      // 更新缓存时间戳
      this.store.lastEligibilityCheckTimestamp = Date.now();
    }
  };

  // 获取单个地址资格（优先使用缓存）
  getAddressEligibility = async (address: string, force = false) => {
    // 检查缓存
    if (!force && this.isCacheValid() && this.store.eligibilityCache) {
      const addressKey = address.toLowerCase();
      const cachedData = this.store.eligibilityCache[addressKey];

      if (cachedData) {
        // 构造ClaimedGiftAddress对象
        const result: ClaimedGiftAddress = {
          address: address,
          isEligible: cachedData.isEligible,
          isChecked: cachedData.isChecked,
          isClaimed: cachedData.isClaimed,
          giftUsdValue: cachedData.giftUsdValue,
        };

        // 如果缓存的数据有资格，更新第一个有资格的地址
        this.updateCurrentEligibleAddress(result);
        return result;
      }
    }

    // 缓存中没有，调用单独接口
    try {
      const data: {
        id?: string;
        has_eligibility: boolean;
        can_claimed_usd_value: number;
      } = await openapi.checkGasAccountGiftEligibility({
        id: address,
      });
      const result = {
        address,
        isEligible: data.has_eligibility,
        isChecked: true,
        isClaimed: false,
        giftUsdValue: data.can_claimed_usd_value,
      };

      // 如果符合资格，更新第一个有资格的地址
      this.updateCurrentEligibleAddress(result);

      // 如果不符合资格，加入缓存
      if (!result.isEligible) {
        this.updateCacheWithNewData([result]);
      }

      return result;
    } catch (error) {
      console.error('Failed to check gas account gift eligibility:', error);
      throw error;
    }
  };

  // 清理缓存
  clearEligibilityCache = () => {
    this.store.eligibilityCache = {};
    this.store.lastEligibilityCheckTimestamp = undefined;
    this.store.hasClaimedGift = false;
    this.store.currentEligibleAddress = undefined;
  };

  claimGift = async (address: string, sig: string) => {
    try {
      const data = await openapi.claimGasAccountGift({
        sig,
        id: address,
      });
      return data;
    } catch (error) {
      console.error('Failed to claim gas account gift:', error);
      throw error;
    }
  };

  // 检查并清理过期缓存
  checkAndClearExpiredCache = () => {
    if (!this.store.eligibilityCache) return;

    const now = Date.now();
    const beforeCount = Object.keys(this.store.eligibilityCache).length;

    // 清理过期的缓存项
    Object.keys(this.store.eligibilityCache).forEach(addressKey => {
      const cacheItem = this.store.eligibilityCache[addressKey];
      const cacheAge = now - cacheItem.timestamp;

      if (cacheAge > CACHE_VALIDITY_PERIOD) {
        delete this.store.eligibilityCache[addressKey];
      }
    });

    const afterCount = Object.keys(this.store.eligibilityCache).length;

    // 如果缓存数量发生变化，更新状态
    if (beforeCount !== afterCount) {
      this.store.lastEligibilityCheckTimestamp = now;
    }
  };

  // 获取缓存状态
  getCacheStatus = () => {
    if (!this.store.eligibilityCache) {
      return {
        isValid: false,
        age: 0,
        cachedAddresses: [],
        remainingTime: 0,
      };
    }

    const now = Date.now();
    const cacheAge = now - (this.store.lastEligibilityCheckTimestamp || 0);
    const isValid = cacheAge <= CACHE_VALIDITY_PERIOD;
    const remainingTime = Math.max(0, CACHE_VALIDITY_PERIOD - cacheAge);

    // 从对象缓存中获取所有缓存的地址
    const cachedAddresses = Object.keys(this.store.eligibilityCache);

    return {
      isValid,
      age: cacheAge,
      cachedAddresses,
      remainingTime,
    };
  };
}
