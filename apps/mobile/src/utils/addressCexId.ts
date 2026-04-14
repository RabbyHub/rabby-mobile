import { cexIdMMKV } from '@/core/storage/mmkvInstances';

export interface ITIME_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}

export const getCexId = (_address: string) => {
  const address = _address.toLowerCase();
  return cexIdMMKV.getString(address);
};

export const setCexId = (_address: string, cexId: string) => {
  const address = _address.toLowerCase();
  if (cexId) {
    cexIdMMKV.set(address, cexId);
  }
};
export const removeCexId = (_address: string) => {
  const address = _address.toLowerCase();
  cexIdMMKV.delete(address);
};
