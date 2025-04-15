import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '@/core/utils/appFS';
import { openapi } from '@/core/request';
import { CurveDayType } from '@/hooks/useCurve';

export interface ITIME_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}
interface ICURVE_DATA {
  data: ITIME_STEP_ITEM[];
  updateTime: number;
}
export const CURE_CACHE_TIME = 10 * 60 * 1000; // 10 min
export const LONG_TIME_UNTIL_EXPIRED = 7 * 24 * 60 * 60 * 1000; // 7 days

const storage = new MMKV({
  id: MMKV_FILE_NAMES.DAYCURVE,
});

const isExpired = (updateTime: number) => {
  return Date.now() - updateTime > CURE_CACHE_TIME;
};

const isLongTimeExpired = (updateTime: number) => {
  return Date.now() - updateTime > LONG_TIME_UNTIL_EXPIRED;
};

export const getCurveCache = (_address: string) => {
  const address = _address.toLowerCase();
  const data = storage.getString(address);
  if (data) {
    const cache = JSON.parse(data) as ICURVE_DATA;
    console.log(
      '🔍 CUSTOM_LOGGER:=>: isExpired:',
      address.slice(-4),
      (Date.now() - cache.updateTime) / 1000 / 60,
    );
    return {
      data: cache.data,
      updateTime: cache.updateTime,
      isExpired: isExpired(cache.updateTime),
    };
  }
  return null;
};

export const setCurveCache = (_address: string, data: ICURVE_DATA) => {
  const address = _address.toLowerCase();
  storage.set(address, JSON.stringify(data));
};

export const getNetCurve = async (
  addr: string,
  days?: CurveDayType,
  force?: boolean,
) => {
  if (days === CurveDayType.DAY) {
    const res = await get24hCurveDataWithCache(addr, force);
    return res?.data;
  }
  return openapi.getNetCurve(addr, days);
};

export const get24hCurveDataWithCache = async (
  _address: string,
  force = false,
) => {
  const address = _address.toLowerCase();
  const cache = getCurveCache(address);
  if (cache && !force && !cache.isExpired) {
    return cache;
  }
  console.log('🔍 CUSTOM_LOGGER:=>: openapi.getNetCurve', address.slice(-4), {
    force,
    isExpired: cache?.isExpired,
  });
  const curve = await openapi.getNetCurve(address, 1);
  setCurveCache(address, {
    data: curve,
    updateTime: Date.now(),
  });
  return {
    data: curve,
    updateTime: Date.now(),
    isExpired: false,
  };
};

export const deleteCurveCache = (_address: string) => {
  const address = _address.toLowerCase();
  storage.delete(address);
};

// delete all curve cache that is long time expired
export const deleteLongTimeCurveCache = () => {
  const keys = storage.getAllKeys();
  keys.forEach(key => {
    const cache = getCurveCache(key);
    if (cache && isLongTimeExpired(cache.updateTime)) {
      deleteCurveCache(key);
    }
  });
};
