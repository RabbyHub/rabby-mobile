import { zCreate } from '@/core/utils/reexports';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import {
  fetch24hBalance,
  getBalance24hCache,
  type IBalance24hData,
  persist24hBalanceCacheAsync,
} from '@/utils/24hBalanceCache';

export type Address24hBalanceValue = IBalance24hData['data'] & {
  updateTime: IBalance24hData['updateTime'];
};

export type Address24hBalanceMap = Record<string, Address24hBalanceValue>;

type Address24hBalanceState = {
  balance24hMap: Address24hBalanceMap;
};

const balance24hStore = zCreate<Address24hBalanceState>(() => ({
  balance24hMap: {},
}));

function setAddress24hBalance(
  address: string,
  data: Address24hBalanceValue | undefined,
) {
  if (!data) {
    return;
  }

  const lowerAddress = address.toLowerCase();
  balance24hStore.setState(prev => ({
    ...prev,
    balance24hMap: {
      ...prev.balance24hMap,
      [lowerAddress]: data,
    },
  }));
}

export function getAddress24hBalance(address: string | undefined) {
  if (!address) {
    return undefined;
  }

  return balance24hStore.getState().balance24hMap[address.toLowerCase()];
}

export function hydrateAddress24hBalanceFromCache(address: string) {
  const lowerAddress = address.toLowerCase();
  const cacheData = getBalance24hCache(lowerAddress);
  const existedData = getAddress24hBalance(lowerAddress);
  const shouldHydrateFromCache =
    !!cacheData?.data && (!existedData || !cacheData.isExpired);

  if (shouldHydrateFromCache) {
    setAddress24hBalance(lowerAddress, {
      ...cacheData.data,
      updateTime: cacheData.updateTime,
    });
  }

  return cacheData;
}

export const refreshAddress24hBalance = makeSWRKeyAsyncFunc(
  async (address: string, force = false) => {
    const lowerAddress = address.toLowerCase();
    const cacheData = hydrateAddress24hBalanceFromCache(lowerAddress);

    if (cacheData?.data && !force && !cacheData.isExpired) {
      return {
        ...cacheData.data,
        updateTime: cacheData.updateTime,
      };
    }

    const nextData = await fetch24hBalance(lowerAddress);
    const normalizedData = {
      ...nextData.data,
      updateTime: nextData.updateTime,
    };
    setAddress24hBalance(lowerAddress, normalizedData);
    persist24hBalanceCacheAsync(lowerAddress, {
      data: {
        total_usd_value: normalizedData.total_usd_value,
      },
      updateTime: normalizedData.updateTime,
    });

    return normalizedData;
  },
  ctx => {
    const address = ctx.args[0]?.toLowerCase?.() || '';
    const force = !!ctx.args[1];
    return `refreshAddress24hBalance-${address}-${force ? 'force' : 'noforce'}`;
  },
);

export function useAddress24hBalance(address?: string) {
  const lowerAddress = address?.toLowerCase() || '';
  const balance24h = balance24hStore(s =>
    lowerAddress ? s.balance24hMap[lowerAddress] : undefined,
  );

  return { balance24h };
}

export function useAddress24hBalanceMap() {
  return balance24hStore(s => s.balance24hMap);
}

export default balance24hStore;
