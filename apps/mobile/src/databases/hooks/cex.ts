import { openapi } from '@/core/request';
import { CexEntity } from '../entities/cex';
import { runOnJS } from 'react-native-reanimated';
import { syncCexInfo } from '../sync/assets';
import { AddrDescResponse, Cex } from '@rabby-wallet/rabby-api/dist/types';

type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
type FirstParameter<T extends (...args: any) => any> = Parameters<T>[0];

export const getCexWithLocalCache = async (
  address: FirstParameter<typeof openapi.addrDesc>,
  force?: boolean,
): Promise<Cex | undefined> => {
  const isExpired = await CexEntity.isExpired(address);
  if (force || isExpired) {
    const addressDesc = await openapi.addrDesc(address);
    const cexInfo = addressDesc?.desc?.cex;
    runOnJS(syncCexInfo)(address, cexInfo);
    return cexInfo;
  } else {
    return CexEntity.queryCexInfo(address);
  }
};

export const getAddrDescWithCexLocalCacheSync = async (
  address: FirstParameter<typeof openapi.addrDesc>,
): Promise<AddrDescResponse['desc'] | undefined> => {
  const addressDesc = await openapi.addrDesc(address);
  const cexInfo = addressDesc?.desc?.cex;
  runOnJS(syncCexInfo)(address, cexInfo);
  return addressDesc?.desc;
};
