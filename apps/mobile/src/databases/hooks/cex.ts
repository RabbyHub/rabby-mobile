import { openapi } from '@/core/request';
import { CexEntity } from '../entities/cex';
import { runOnJS } from 'react-native-reanimated';
import { syncCexInfo } from '../sync/assets';
import { AddrDescResponse, Cex } from '@rabby-wallet/rabby-api/dist/types';
import { getCexId } from '@/utils/addressCexId';
import {
  globalSupportCexList,
  waitForCexSupportListReady,
} from '@/hooks/useCexSupportList';
import {
  findSupportedExchange,
  normalizeCex,
  projectItemToCex,
} from '@/utils/cex';

type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
type FirstParameter<T extends (...args: any) => any> = Parameters<T>[0];

export const getCexWithLocalCache = async (
  address: FirstParameter<typeof openapi.addrDesc>,
  force?: boolean,
  forceCache?: boolean,
): Promise<Cex | undefined> => {
  const supportCexListPromise = waitForCexSupportListReady();
  const isExpired = await CexEntity.isExpired(address);
  let res: Cex | undefined;
  if (!forceCache && (force || isExpired)) {
    const addressDesc = await openapi.addrDesc(address);
    const cexInfo = addressDesc?.desc?.cex;
    syncCexInfo(address, cexInfo);
    res = cexInfo;
  } else {
    res = await CexEntity.queryCexInfo(address);
  }
  const supportCexList = await supportCexListPromise;
  const localCexId = getCexId(address);
  const localCexInfo = findSupportedExchange(supportCexList, localCexId);
  if (localCexInfo) {
    return projectItemToCex(localCexInfo);
  }
  return normalizeCex(res, supportCexList);
};

export const getAddrDescWithCexLocalCacheSync = async (
  address: FirstParameter<typeof openapi.addrDesc>,
): Promise<AddrDescResponse['desc'] | undefined> => {
  try {
    const addressDesc = await openapi.addrDesc(address);
    let cexInfo = addressDesc?.desc?.cex;
    const localCexId = getCexId(address);
    if (localCexId) {
      const supportCexList = await waitForCexSupportListReady();
      const localCexInfo = findSupportedExchange(supportCexList, localCexId);
      if (localCexInfo) {
        cexInfo = projectItemToCex(localCexInfo);
      }
    }
    addressDesc.desc.cex = cexInfo;
    syncCexInfo(address, cexInfo);
    return addressDesc?.desc;
  } catch (error) {
    // may 429 error
    return undefined;
  }
};

export const getInitDescWithCexLocalCache = (
  address?: FirstParameter<typeof openapi.addrDesc>,
): AddrDescResponse['desc'] | undefined => {
  if (!address) {
    return;
  }
  try {
    const localCexId = getCexId(address);
    const localCexInfo = findSupportedExchange(
      globalSupportCexList,
      localCexId,
    );
    if (!localCexInfo) {
      return undefined;
    }
    return {
      cex: projectItemToCex(localCexInfo),
      usd_value: 0,
      born_at: 0,
      is_danger: false,
      is_spam: false,
      is_scam: false,
      name: '',
      id: '', // fix type check init default undefined
    };
  } catch (error) {
    // may 429 error
    return undefined;
  }
};
