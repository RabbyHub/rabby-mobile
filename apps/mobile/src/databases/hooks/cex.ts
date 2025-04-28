import { openapi } from '@/core/request';
import { CexEntity } from '../entities/cex';
import { runOnJS } from 'react-native-reanimated';
import { syncCexInfo } from '../sync/assets';
import { AddrDescResponse, Cex } from '@rabby-wallet/rabby-api/dist/types';
import { getCexId, setCexId } from '@/utils/addressCexId';
import { globalSupportCexList } from '@/hooks/useCexSupportList';

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
  let res;
  if (force || isExpired) {
    const addressDesc = await openapi.addrDesc(address);
    const cexInfo = addressDesc?.desc?.cex;
    runOnJS(syncCexInfo)(address, cexInfo);
    res = cexInfo;
  } else {
    res = await CexEntity.queryCexInfo(address);
  }
  const localCexId = getCexId(address);
  const localCexInfo = globalSupportCexList.find(
    item => item.id === localCexId,
  );
  if (localCexId) {
    res = {
      ...(res || {}),
      ...(localCexInfo || {}),
      is_deposit: true,
    } as Cex;
  }
  return res;
};

export const getAddrDescWithCexLocalCacheSync = async (
  address: FirstParameter<typeof openapi.addrDesc>,
): Promise<AddrDescResponse['desc'] | undefined> => {
  try {
    const addressDesc = await openapi.addrDesc(address);
    let cexInfo = addressDesc?.desc?.cex;
    const localCexId = getCexId(address);
    const localCexInfo = globalSupportCexList.find(
      item => item.id === localCexId,
    );
    if (localCexId) {
      cexInfo = {
        ...(cexInfo || {}),
        ...(localCexInfo || {}),
        is_deposit: true,
      } as Cex;
    }
    addressDesc.desc.cex = cexInfo;
    runOnJS(syncCexInfo)(address, cexInfo);
    return addressDesc?.desc;
  } catch (error) {
    // may 429 error
    return undefined;
  }
};
