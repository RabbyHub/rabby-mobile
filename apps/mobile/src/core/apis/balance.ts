import { cached } from '@/utils/cache';
import { preferenceService, keyringService } from '../services';
import { testOpenapi } from '../request';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';
import { getTokenSettings } from '@/utils/getTokenSettings';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';

const getTotalBalanceCached = cached(async address => {
  const addresses = await keyringService.getAllAddresses();
  const filtered = addresses.filter(item =>
    isSameAddress(item.address, address),
  );
  let core = false;
  if (filtered.some(item => CORE_KEYRING_TYPES.includes(item.type as any))) {
    core = true;
  }
  const tokenSetting = await getTokenSettings();
  const data = await batchBalanceWithLocalCache({
    address,
    isCore: core,
    ...tokenSetting,
  });
  preferenceService.updateAddressBalance(address, data);
  return data;
}, 5000);

const getTestnetTotalBalanceCached = cached(async address => {
  const tokenSetting = await getTokenSettings();
  const testnetData = await testOpenapi.getTotalBalanceV2({
    address,
    isCore: false,
    ...tokenSetting,
  });
  preferenceService.updateTestnetAddressBalance(address, testnetData);
  return testnetData;
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
  return getTotalBalanceCached([address], address, force);
};

export const getAddressCacheBalance = async (
  address: string | undefined,
  isTestnet = false,
) => {
  if (!address) {
    return null;
  }
  if (isTestnet) {
    return await preferenceService.getTestnetAddressBalance(address);
  }
  return await preferenceService.getAddressBalance(address);
};
