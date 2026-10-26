import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import type { Account } from '@/types/account';
import { openapi } from '../request';
import dayjs from 'dayjs';

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

export type GasAccountRuntimeAccount = {
  address: string;
  type: string;
  brandName: string;
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
  hasEverLoggedIn?: boolean;
  currentBalanceAccountId?: string;
  currentHasBalance?: boolean;
  ga4ActiveEventTime?: number;
};

const getInitialHasEverLoggedIn = (
  rawStore?: Partial<GasAccountServiceStore> | null,
) => {
  if (typeof rawStore?.hasEverLoggedIn === 'boolean') {
    return rawStore.hasEverLoggedIn;
  }

  if (rawStore?.sig && rawStore?.accountId) {
    return true;
  }

  if (rawStore) {
    return undefined;
  }

  return false;
};

export class GasAccountService extends StoreServiceBase<
  GasAccountServiceStore,
  APP_STORE_NAMES.gasAccount
> {
  runtimeState: {
    pendingHardwareAccount?: GasAccountRuntimeAccount;
    accountsWithGasAccountBalance: GasAccountRuntimeAccount[];
  } = {
    pendingHardwareAccount: undefined,
    accountsWithGasAccountBalance: [],
  };

  constructor(options?: StorageAdapaterOptions) {
    const rawStore = options?.storageAdapter?.getItem(
      APP_STORE_NAMES.gasAccount,
    ) as Partial<GasAccountServiceStore> | null | undefined;
    super(
      APP_STORE_NAMES.gasAccount,
      {
        hasClaimedGift: false,
        eligibilityCache: {},
        lastEligibilityCheckTimestamp: undefined,
        currentEligibleAddress: undefined,
        hasEverLoggedIn: false,
        ga4ActiveEventTime: 0,
      },
      {
        storageAdapter: options?.storageAdapter,
      },
    );
    this.mutateStore(draft => {
      draft.hasEverLoggedIn = getInitialHasEverLoggedIn(rawStore);
    });
  }

  getGasAccountData = (key?: keyof GasAccountServiceStore) => {
    return cloneDeep(key ? this.store[key] : this.store);
  };

  getGasAccountSig = () => {
    return { sig: this.store.sig, accountId: this.store.accountId };
  };

  setGasAccountSig = (
    sig?: string,
    account?: GasAccountServiceStore['account'],
  ) => {
    this.mutateStore(draft => {
      if (!sig || !account) {
        draft.sig = undefined;
        draft.accountId = undefined;
        draft.account = undefined;
        draft.currentBalanceAccountId = undefined;
        draft.currentHasBalance = undefined;
      } else {
        draft.sig = sig;
        draft.accountId = account.address;
        draft.account = { ...account };
      }
    });
  };

  getLastDepositAccount = () => {
    return cloneDeep(this.store.lastDepositAccount);
  };

  setLastDepositAccount = (account?: Account) => {
    this.mutateStore(draft => {
      draft.lastDepositAccount = account;
    });
  };

  getHasClaimedGift = (): boolean => {
    return this.store.hasClaimedGift;
  };

  setHasClaimedGift = (hasClaimed: boolean) => {
    this.mutateStore(draft => {
      draft.hasClaimedGift = hasClaimed;
    });
  };

  getCurrentEligibleAddress = (): ClaimedGiftAddress | undefined => {
    return cloneDeep(this.store.currentEligibleAddress);
  };

  setCurrentEligibleAddress = (address: string) => {
    this.mutateStore(draft => {
      draft.currentEligibleAddress = {
        address,
        isChecked: true,
        isEligible: true,
        isClaimed: false,
        giftUsdValue: 0,
      };
    });
  };

  clearCurrentEligibleAddress = () => {
    this.mutateStore(draft => {
      draft.currentEligibleAddress = undefined;
    });
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

  // 批量检查地址资格（带缓存）
  checkAddressEligibilityBatch = async (addresses: string[], force = false) => {
    console.debug('checkAddressEligibilityBatch', addresses, force);
    // 检查缓存
    if (!force && this.isCacheValid()) {
      const result = this.getDataFromCache(addresses);
      if (result) {
        return result;
      }
    }

    // 缓存无效或强制刷新，调用API
    return this.checkEligibilityFromAPI(addresses);
  };

  // 从缓存获取数据
  private getDataFromCache = (addresses: string[]) => {
    const cache = this.store.eligibilityCache;
    const allAddressesCached = addresses.every(
      addr => !!cache[addr.toLowerCase()],
    );

    return allAddressesCached
      ? this.getFullyCachedData(addresses)
      : this.getPartiallyCachedData(addresses);
  };

  // 获取完全缓存的数据
  private getFullyCachedData = (addresses: string[]) => {
    const cache = this.store.eligibilityCache;
    const filteredData: ClaimedGiftAddress[] = [];
    addresses.forEach(addr => {
      const item = cache[addr.toLowerCase()];
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
    const cache = this.store.eligibilityCache;
    const cachedData: ClaimedGiftAddress[] = [];
    const uncachedAddresses: string[] = [];
    addresses.forEach(addr => {
      const addressKey = addr.toLowerCase();
      const cached = cache[addressKey];
      if (cached) {
        cachedData.push({
          address: addr,
          isEligible: !!cached.isEligible,
          isChecked: !!cached.isChecked,
          isClaimed: !!cached.isClaimed,
          giftUsdValue: cached.giftUsdValue,
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
    return [...cachedData, ...uncachedData];
  };

  // 从API检查资格
  private checkEligibilityFromAPI = async (addresses: string[]) => {
    try {
      const data = await this.checkUncachedAddresses(addresses);
      // 查找第一个符合要求的地址
      const firstEligible = data.find(item => item.isEligible);

      if (firstEligible) {
        this.mutateStore(draft => {
          draft.currentEligibleAddress = firstEligible;
        });
        const result = [firstEligible];
        return result;
      }

      // 如果没有符合要求的地址，清除之前保存的有资格地址
      this.mutateStore(draft => {
        draft.currentEligibleAddress = undefined;
      });

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
    const nextAddress = Array.isArray(data)
      ? data.find(item => item.isEligible)
      : data?.isEligible
      ? data
      : undefined;
    this.mutateStore(draft => {
      draft.currentEligibleAddress = nextAddress;
    });
  };

  // 用新数据更新缓存
  private updateCacheWithNewData = (newData: ClaimedGiftAddress[]) => {
    const ineligibleData = newData.filter(
      item => !item.isEligible && !!item.address,
    );

    if (!ineligibleData.length) {
      return;
    }

    const now = Date.now();
    this.mutateStore(draft => {
      ineligibleData.forEach(item => {
        const addressKey = item.address.toLowerCase();
        if (!addressKey || addressKey === 'undefined') {
          return;
        }
        draft.eligibilityCache[addressKey] = {
          isEligible: item.isEligible,
          timestamp: now,
          isChecked: item.isChecked,
          isClaimed: item.isClaimed,
          giftUsdValue: item.giftUsdValue,
        };
      });
      draft.lastEligibilityCheckTimestamp = now;
    });
  };

  // 获取单个地址资格（优先使用缓存）
  getAddressEligibility = async (address: string, force = false) => {
    // 检查缓存
    if (!force && this.isCacheValid()) {
      const addressKey = address.toLowerCase();
      const cachedData = this.store.eligibilityCache[addressKey];

      if (cachedData) {
        // 构造ClaimedGiftAddress对象
        const result: ClaimedGiftAddress = {
          address,
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
    this.mutateStore(draft => {
      draft.eligibilityCache = {};
      draft.lastEligibilityCheckTimestamp = undefined;
      draft.hasClaimedGift = false;
      draft.currentEligibleAddress = undefined;
    });
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

  markGiftClaimed = (address: string) => {
    const normalizedAddress = address.toLowerCase();
    this.mutateStore(draft => {
      draft.hasClaimedGift = true;
      if (
        draft.currentEligibleAddress?.address.toLowerCase() ===
        normalizedAddress
      ) {
        draft.currentEligibleAddress = undefined;
      }
      if (draft.eligibilityCache[normalizedAddress]) {
        draft.eligibilityCache[normalizedAddress] = {
          ...draft.eligibilityCache[normalizedAddress],
          isEligible: false,
          isClaimed: true,
          giftUsdValue: 0,
        };
      }
    });
  };

  // 检查并清理过期缓存
  checkAndClearExpiredCache = () => {
    if (!this.store.eligibilityCache) {
      return;
    }

    const now = Date.now();
    const expiredKeys = Object.keys(this.store.eligibilityCache).filter(
      addressKey => {
        const cacheItem = this.store.eligibilityCache[addressKey];
        const cacheAge = now - cacheItem.timestamp;
        return cacheAge > CACHE_VALIDITY_PERIOD;
      },
    );

    // 如果缓存数量发生变化，更新状态
    if (expiredKeys.length) {
      this.mutateStore(draft => {
        expiredKeys.forEach(addressKey => {
          delete draft.eligibilityCache[addressKey];
        });
        draft.lastEligibilityCheckTimestamp = now;
      });
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

  markLoggedIn() {
    const isFirstLogin = this.store.hasEverLoggedIn === false;
    this.mutateStore(draft => {
      draft.hasEverLoggedIn = true;
    });
    return isFirstLogin;
  }

  getCurrentBalanceState() {
    return {
      accountId: this.store.currentBalanceAccountId,
      hasBalance: this.store.currentHasBalance,
    };
  }

  setCurrentBalanceState(accountId?: string, hasBalance?: boolean) {
    this.mutateStore(draft => {
      draft.currentBalanceAccountId = accountId;
      draft.currentHasBalance = hasBalance;
    });
  }

  hasTrackedGa4ActiveToday() {
    return dayjs(this.store.ga4ActiveEventTime || 0)
      .utc()
      .isSame(dayjs().utc(), 'day');
  }

  markGa4ActiveTracked(timestamp = Date.now()) {
    this.mutateStore(draft => {
      draft.ga4ActiveEventTime = timestamp;
    });
  }

  getPendingHardwareAccount() {
    return this.runtimeState.pendingHardwareAccount;
  }

  setPendingHardwareAccount(account?: GasAccountRuntimeAccount) {
    this.runtimeState.pendingHardwareAccount = account;
  }

  clearPendingHardwareAccount() {
    this.runtimeState.pendingHardwareAccount = undefined;
  }

  getAccountsWithGasAccountBalance() {
    return this.runtimeState.accountsWithGasAccountBalance;
  }

  setAccountsWithGasAccountBalance(accounts: GasAccountRuntimeAccount[]) {
    this.runtimeState.accountsWithGasAccountBalance = accounts;
  }

  clearAccountsWithGasAccountBalance() {
    this.runtimeState.accountsWithGasAccountBalance = [];
  }
}
