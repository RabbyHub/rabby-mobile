import { MMKV } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '@/core/utils/appFS';
import type { EvmTotalBalanceResponse } from '@/databases/hooks/balance';

const storage = new MMKV({
  id: MMKV_FILE_NAMES.TESTNET_BALANCE,
});

export const getTestnetAddressBalanceCache = (
  address: string | undefined,
): EvmTotalBalanceResponse | null => {
  if (!address) {
    return null;
  }

  const value = storage.getString(address.toLowerCase());
  return value ? (JSON.parse(value) as EvmTotalBalanceResponse) : null;
};

export const setTestnetAddressBalanceCache = (
  address: string,
  data: EvmTotalBalanceResponse,
) => {
  storage.set(address.toLowerCase(), JSON.stringify(data));
};

export const removeTestnetAddressBalanceCache = (address: string) => {
  storage.delete(address.toLowerCase());
};
