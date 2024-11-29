import { cached } from '@/utils/cache';
import { preferenceService, keyringService } from '../services';
import { openapi, testOpenapi } from '../request';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';

const getTotalBalanceCached = cached(async address => {
  const addresses = await keyringService.getAllAddresses();
  const filtered = addresses.filter(item =>
    isSameAddress(item.address, address),
  );
  let core = false;
  if (filtered.some(item => CORE_KEYRING_TYPES.includes(item.type as any))) {
    core = true;
  }
  console.log('core', core);
  const data = await openapi.getTotalBalance(address, core);
  preferenceService.updateAddressBalance(address, data);
  return data;
}, 5000);

const getTestnetTotalBalanceCached = cached(async address => {
  const testnetData = await testOpenapi.getTotalBalance(address);
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
