import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '@/core/utils/appFS';
import { openapi } from '@/core/request';
import { CurveDayType } from './curveDayType';

export interface ITIME_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}
interface ICURVE_DATA {
  data: ITIME_STEP_ITEM[];
  updateTime: number;
}
export const CURE_CACHE_TIME = 10 * 60 * 1000; // 10 min
// export const CURE_CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // TODO: 7 days min tmp for test
export const LONG_TIME_UNTIL_EXPIRED = 5 * 24 * 60 * 60 * 1000; // 5 days expired is invalid

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

const get24hCurveDataWithCache = async (_address: string, force = false) => {
  const address = _address.toLowerCase();
  const cache = getCurveCache(address);
  if (cache && !force && !cache.isExpired) {
    return cache;
  }
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
  try {
    const keys = storage.getAllKeys();
    keys.forEach(key => {
      const cache = getCurveCache(key);
      if (cache && isLongTimeExpired(cache.updateTime)) {
        deleteCurveCache(key);
      }
    });
  } catch (error) {
    console.error('deleteLongTimeCurveCache', error);
  }
};
