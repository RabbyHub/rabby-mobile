import { testnetBalanceMMKV } from '@/core/storage/mmkvInstances';
import type { EvmTotalBalanceResponse } from '@/databases/hooks/balance';

export const getTestnetAddressBalanceCache = (
  address: string | undefined,
): EvmTotalBalanceResponse | null => {
  if (!address) {
    return null;
  }

  const value = testnetBalanceMMKV.getString(address.toLowerCase());
  return value ? (JSON.parse(value) as EvmTotalBalanceResponse) : null;
};

export const setTestnetAddressBalanceCache = (
  address: string,
  data: EvmTotalBalanceResponse,
) => {
  testnetBalanceMMKV.set(address.toLowerCase(), JSON.stringify(data));
};

export const removeTestnetAddressBalanceCache = (address: string) => {
  testnetBalanceMMKV.delete(address.toLowerCase());
};
