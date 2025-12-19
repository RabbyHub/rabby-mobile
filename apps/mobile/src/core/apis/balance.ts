import { cached } from '@/utils/cache';
import { preferenceService, keyringService } from '../services';
import { testOpenapi } from '../request';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';
import { getTokenSettings } from '@/utils/getTokenSettings';
import {
  batchBalanceWithLocalCache,
  EvmTotalBalanceResponse,
} from '@/databases/hooks/balance';

const getTotalBalanceCached = async (address: string, force?: boolean) => {
  const addresses = await keyringService.getAllAddresses();
  const filtered = addresses.filter(item =>
    isSameAddress(item.address, address),
  );
  let core = false;
  if (filtered.some(item => CORE_KEYRING_TYPES.includes(item.type as any))) {
    core = true;
  }
  const tokenSetting = await getTokenSettings();
  const data = await batchBalanceWithLocalCache(
    {
      address,
      isCore: core,
      ...tokenSetting,
    },
    force,
    false,
    true,
  );
  preferenceService.updateAddressBalance(address, data);
  return data;
};

const getTestnetTotalBalanceCached = cached(async address => {
  const tokenSetting = await getTokenSettings();
  const testnetData = await testOpenapi.getTotalBalanceV2({
    address,
    isCore: false,
    ...tokenSetting,
  });
  const formatData: EvmTotalBalanceResponse = {
    ...testnetData,
    evm_usd_value: testnetData.total_usd_value,
  };
  preferenceService.updateTestnetAddressBalance(address, formatData);
  return formatData;
}, 5000);

export const getAddressBalance = async (
  address: string,
  {
    force = false,
    isTestnet = false,
  }: {
    force?: boolean;
    isTestnet?: boolean;
  } = {},
) => {
  if (isTestnet) {
    return getTestnetTotalBalanceCached([address], address, force);
  }
  return getTotalBalanceCached(address, force);
};

export const getAddressCacheBalanceSync = (
  address: string | undefined,
  isTestnet = false,
): EvmTotalBalanceResponse | null => {
  if (!address) {
    return null;
  }
  if (isTestnet) {
    return preferenceService.getTestnetAddressBalance(address);
  }
  return preferenceService.getAddressBalance(address);
};

export const getAddressCacheBalance = async (
  address: string | undefined,
  isTestnet = false,
) => {
  return getAddressCacheBalanceSync(address, isTestnet);
};

export function computeBalanceChange(realtimeValue: number, baseValue: number) {
  const assetsChange = realtimeValue - baseValue;

  const changePercent =
    baseValue !== 0
      ? `${Math.abs((assetsChange * 100) / baseValue).toFixed(2)}%`
      : `${realtimeValue === 0 ? '0' : '100.00'}%`;

  return {
    assetsChange,
    changePercent,
  };
}
