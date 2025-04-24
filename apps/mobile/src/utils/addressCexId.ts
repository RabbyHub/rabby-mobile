import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '@/core/utils/appFS';

export interface ITIME_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}

const storage = new MMKV({
  id: MMKV_FILE_NAMES.CEXID,
});

export const getCexId = (_address: string) => {
  const address = _address.toLowerCase();
  return storage.getString(address);
};

export const setCexId = (_address: string, cexId: string) => {
  const address = _address.toLowerCase();
  if (cexId) {
    storage.set(address, cexId);
  }
};
export const removeCexId = (_address: string) => {
  const address = _address.toLowerCase();
  storage.delete(address);
};
