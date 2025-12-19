import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '@/core/utils/appFS';
import { openapi } from '@/core/request';
import { computeBalanceChange } from '@/core/apis/balance';

export const CURE_CACHE_TIME = 10 * 60 * 1000; // 10 min
// export const CURE_CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // TODO: 7 days min tmp for test
export const LONG_TIME_UNTIL_EXPIRED = 5 * 24 * 60 * 60 * 1000; // 5 days expired is invalid

export interface IBalance24hData {
  data: { total_usd_value: number };
  updateTime: number;
}

const storage = new MMKV({
  id: MMKV_FILE_NAMES.BALANCE_24H,
});

const isExpired = (updateTime: number) => {
  return Date.now() - updateTime > CURE_CACHE_TIME;
};

const isLongTimeExpired = (updateTime: number) => {
  return Date.now() - updateTime > LONG_TIME_UNTIL_EXPIRED;
};

export const getBalance24hCache = (_address: string) => {
  const address = _address.toLowerCase();
  const data = storage.getString(address);
  if (data) {
    const cache = JSON.parse(data) as IBalance24hData;
    return {
      data: cache.data,
      updateTime: cache.updateTime,
      isExpired: isExpired(cache.updateTime),
    };
  }
  return null;
};

export const setBalance24hCache = (addr: string, data: IBalance24hData) => {
  const address = addr.toLowerCase();
  storage.set(address, JSON.stringify(data));
};

export const get24hBalance = async (addr: string, force?: boolean) => {
  const res = await refresh24hBalanceWithCache(addr, force);
  return res;
};

const refresh24hBalanceWithCache = async (_address: string, force = false) => {
  const address = _address.toLowerCase();
  const cache = getBalance24hCache(address);
  if (cache && !force && !cache.isExpired) {
    return cache;
  }
  const { total_usd_value } = await openapi.get24hTotalBalance(address);
  const data = {
    total_usd_value: total_usd_value,
  };
  const updateTime = Date.now();
  setBalance24hCache(address, {
    data,
    updateTime,
  });
  return {
    data,
    updateTime,
    isExpired: false,
  };
};

export const delete24hBalanceCache = (_address: string) => {
  const address = _address.toLowerCase();
  storage.delete(address);
};

// delete all curve cache that is long time expired
export const deleteLongTime24hBalanceCache = () => {
  try {
    const keys = storage.getAllKeys();
    keys.forEach(key => {
      const cache = getBalance24hCache(key);
      if (cache && isLongTimeExpired(cache.updateTime)) {
        delete24hBalanceCache(key);
      }
    });
  } catch (error) {
    console.error('deleteLongTimeCurveCache', error);
  }
};

export const getChangeData = (
  data?: IBalance24hData['data'],
  realtimeNetWorth = 0,
  realtimeTimestamp?: number,
) => {
  const startData = data || { total_usd_value: 0 };
  const endNetWorth = realtimeTimestamp ? realtimeNetWorth : 0;
  const changeValues = computeBalanceChange(
    endNetWorth,
    startData.total_usd_value,
  );

  return {
    changePercent: changeValues.changePercent,
    isLoss: changeValues.assetsChange < 0,
  };
};
