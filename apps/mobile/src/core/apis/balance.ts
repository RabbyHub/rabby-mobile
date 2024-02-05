import { cached } from '@/utils/cache';
import { preferenceService } from '../services';
import { openapi, testOpenapi } from '../request';

const getTotalBalanceCached = cached(async address => {
  const data = await openapi.getTotalBalance(address);
  preferenceService.updateAddressBalance(address, data);
  return data;
  // 3 mins
});

const getTestnetTotalBalanceCached = cached(async address => {
  const testnetData = await testOpenapi.getTotalBalance(address);
  preferenceService.updateTestnetAddressBalance(address, testnetData);
  return testnetData;
});

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
