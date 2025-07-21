import { openapi } from '@/core/request';
import {
  getAddrDescWithCexLocalCacheSync,
  getCexWithLocalCache,
} from '@/databases/hooks/cex';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { findChainByEnum, findChainByServerID } from './chain';
import { CHAINS_ENUM } from '@/constant/chains';

export const getDefaultToken = (): { chain: string; tokenId: string } => {
  const chainInfo = findChainByEnum(CHAINS_ENUM.ETH);
  return {
    chain: chainInfo?.serverId || CHAINS_ENUM.ETH,
    tokenId: chainInfo?.nativeTokenAddress || 'eth',
  };
};

export const isCexAddressSupportToken = async (
  address: string,
  chain: string,
  tokenId: string,
): Promise<{
  isCex: boolean;
  isSupport: boolean;
}> => {
  try {
    const cexInfo = await getCexWithLocalCache(address);
    // 非交易所地址直接通过
    if (!cexInfo?.id) {
      return {
        isCex: false,
        isSupport: true,
      };
    }
    const cexId = cexInfo.id;
    const { find, cex_ids } = await TokenItemEntity.getCexIds(tokenId, chain);
    // 本地能查到token支持的交易所信息的话就用本地的
    if (find) {
      return {
        isCex: true,
        isSupport: cex_ids.some(id => id.toLowerCase() === cexId.toLowerCase()),
      };
    }
    // 最后才去后端查
    const support = await openapi.depositCexSupport(tokenId, chain, cexId);
    if (!support.support) {
      return {
        isCex: true,
        isSupport: false,
      };
    }
    return {
      isCex: true,
      isSupport: true,
    };
  } catch (error) {
    // 兜底不支持，还是eth
    return {
      isCex: false,
      isSupport: false,
    };
  }
};

export const isAddrsssContractSupportToken = async (
  address: string,
  chain: string,
  _addressDesc?: AddrDescResponse['desc'],
): Promise<[boolean, string[]]> => {
  const addressDesc =
    _addressDesc || (await getAddrDescWithCexLocalCacheSync(address));
  const isContract = Object.keys(addressDesc?.contract || {}).length > 0;
  if (!isContract) {
    return [true, []];
  }
  const supportChains = Object.entries(addressDesc?.contract || {}).map(
    ([chainName]) => chainName?.toLowerCase(),
  );
  return [supportChains.includes(chain?.toLowerCase()), supportChains];
};

export const getContractRecommendToken = async (
  address: string,
  chainList: string[],
) => {
  const tokenList = chainList
    .map(chainEnum => ({
      chain: chainEnum,
      tokenId: findChainByServerID(chainEnum)?.nativeTokenAddress || '',
    }))
    .filter(chainItem => chainItem.tokenId && chainItem.chain);
  const maxToken = await TokenItemEntity.getTokenWithMaxUsdValue(
    address,
    tokenList,
  );
  if (maxToken) {
    return {
      chain: maxToken.chain,
      tokenId: maxToken.id,
    };
  }
  if (tokenList.length) {
    return {
      chain: tokenList[0].chain,
      tokenId: tokenList[0].tokenId,
    };
  }
  return getDefaultToken();
};

export const getRecommendToken = async (options: {
  from: string;
  to: string;
  tokenId: string;
  chain: string;
}): Promise<{ chain: string; tokenId: string }> => {
  const passToken = {
    chain: options.chain,
    tokenId: options.tokenId,
  };
  const { isCex, isSupport } = await isCexAddressSupportToken(
    options.to,
    options.chain,
    options.tokenId,
  );
  if (isCex) {
    return isSupport ? passToken : getDefaultToken();
  }
  const [isContractSupport, supportChains] =
    await isAddrsssContractSupportToken(options.to, options.chain);
  if (isContractSupport) {
    return passToken;
  }
  return getContractRecommendToken(options.from, supportChains);
};
