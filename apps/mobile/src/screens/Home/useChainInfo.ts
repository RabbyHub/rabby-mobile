import BigNumber from 'bignumber.js';
import { isAppChain } from '@/screens/Home/utils/appchain';
import {
  AbstractPortfolioToken,
  AbstractProject,
  DisplayNftItem,
} from './types';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import {
  AssetsMapState,
  assetsMapStore,
  computeAssetsApis,
} from './hooks/store';
import { debounce } from 'lodash';
import { getTop10MyAddresses } from '@/core/apis/account';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { DisplayedProject } from './utils/project';

type ChainAssetsUnit = Record<string, BigNumber>;
interface BaseInfo {
  token: ChainAssetsUnit;
  portfolio: ChainAssetsUnit;
  nft: ChainAssetsUnit;
}
type FinalInfo = BaseInfo & {
  computedResult: {
    chainAssets: ChainListItem[];
    chainLength: number;
    top3Chains: string[];
  };
};
const chainStaticsStore = zCreate<FinalInfo>(() => ({
  token: {},
  portfolio: {},
  nft: {},

  computedResult: {
    chainAssets: [],
    chainLength: 0,
    top3Chains: [],
  },
}));

function setFinalInfo(valOrFunc: UpdaterOrPartials<FinalInfo>) {
  chainStaticsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

const debounceComputeChainList = debounce<
  Parameters<typeof assetsMapStore.subscribe>[0]
>(async () => {
  const top10Addresses = await getTop10MyAddresses();

  setFinalInfo(computeChainsListV2(top10Addresses));
}, 100);
assetsMapStore.subscribe(debounceComputeChainList);

export function getComputedChainInfo() {
  const baseInfo = chainStaticsStore.getState();
  return baseInfo.computedResult;
}

export function useTop3Chains() {
  const top3Chains = chainStaticsStore(s => s.computedResult.top3Chains);

  return useCreationWithShallowCompare(() => top3Chains, [top3Chains]);
}

export const useChainInfo = () => {
  const chainsInfo = chainStaticsStore(s => s.computedResult);

  return {
    chainAssets: chainsInfo.chainAssets,
    chainLength: chainsInfo.chainLength,
  };
};

export const otherStore = zCreate(() => {
  return {
    selectedChainItem: undefined as ChainListItem | undefined,
  };
});

export function getSelectChainItem() {
  return otherStore.getState().selectedChainItem;
}

export function useSelectedChainItem() {
  return otherStore(s => s.selectedChainItem);
}

export function setSelectChainItem(
  valOrFunc: UpdaterOrPartials<ChainListItem | undefined>,
) {
  otherStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.selectedChainItem, valOrFunc);

    return {
      ...prev,
      selectedChainItem: newVal,
    };
  });
}

const addrChainStaticsStore = zCreate<Record<string, FinalInfo>>(() => ({}));
function setAddressChainInfo(
  valOrFunc: UpdaterOrPartials<Record<string, FinalInfo>>,
) {
  addrChainStaticsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function useAddrChainInfo(address: string) {
  const addr = address.toLowerCase();
  return addrChainStaticsStore(
    s => s[addr] || apisAddrChainStatics.makeFinalInfo(),
  );
}

export function getAddrChainInfo(address: string) {
  const addr = address.toLowerCase();
  return (
    addrChainStaticsStore.getState()[addr] ||
    apisAddrChainStatics.makeFinalInfo()
  );
}

export const apisAddrChainStatics = {
  makeFinalInfo: (): FinalInfo => {
    return {
      token: {},
      portfolio: {},
      nft: {},
      computedResult: {
        chainAssets: [],
        chainLength: 0,
        top3Chains: [],
      },
    };
  },
  computeChainAssetsToken: (tokens: AbstractPortfolioToken[]) => {
    const chainUnit: ChainAssetsUnit = {};
    tokens?.forEach(token => {
      const chainId = token.chain;
      if (!chainUnit[chainId]) {
        chainUnit[chainId] = new BigNumber(0);
      }
      if (token._isExcludeBalance) {
        return;
      }
      chainUnit[chainId] = chainUnit[chainId].plus(token._usdValue || 0);
    });

    return chainUnit;
  },
  updateToken: (addr: string, tokens: AbstractPortfolioToken[]) => {
    addr = addr.toLowerCase();

    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const combinedTokens = computeAssetsApis.memoTokens([addr], {
      [addr]: tokens,
    });

    prevFinalInfo.token =
      apisAddrChainStatics.computeChainAssetsToken(combinedTokens);
    const newFinalInfo = {
      ...apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo),
    };

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: newFinalInfo,
      };
    });
  },
  computeChainAssetsPortfolio: (portfolios: AbstractProject[]) => {
    const chainUnit: ChainAssetsUnit = {};
    portfolios?.forEach(portfolio => {
      const chainId = portfolio.chain;
      // ignore app chain percent
      if (!chainId || isAppChain(chainId)) {
        return;
      }
      if (!chainUnit[chainId]) {
        chainUnit[chainId] = new BigNumber(0);
      }
      if (portfolio._isExcludeBalance) {
        return;
      }
      chainUnit[chainId] = chainUnit[chainId].plus(portfolio.netWorth || 0);
    });

    return chainUnit;
  },
  updatePortfolio: (addr: string, _portfolios: DisplayedProject[]) => {
    addr = addr.toLowerCase();

    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const combinedPortfolios = computeAssetsApis.memoPortfolios([addr], {
      [addr]: _portfolios,
    });

    // reset
    prevFinalInfo.portfolio =
      apisAddrChainStatics.computeChainAssetsPortfolio(combinedPortfolios);
    const newFinalInfo = {
      ...apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo),
    };

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: newFinalInfo,
      };
    });
  },
  computeChainAssetsNft: (nftList: DisplayNftItem[]) => {
    const chainUnit: ChainAssetsUnit = {};
    nftList?.forEach(nft => {
      const chainId = nft.chain;
      if (!chainUnit[chainId]) {
        chainUnit[chainId] = new BigNumber(0);
      }
    });
    return chainUnit;
  },
  updateNft: (addr: string, nftList: DisplayNftItem[]) => {
    addr = addr.toLowerCase();

    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const combinedNfts = computeAssetsApis.memoNfts([addr], {
      [addr]: nftList,
    });

    // reset
    prevFinalInfo.nft =
      apisAddrChainStatics.computeChainAssetsNft(combinedNfts);
    const newFinalInfo = {
      ...apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo),
    };

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: newFinalInfo,
      };
    });
  },
  getComputedResultFromChainAssets: (chainUnit: Record<string, BigNumber>) => {
    const totalValue = Object.values(chainUnit).reduce(
      (sum, total) => sum.plus(total),
      new BigNumber(0),
    );

    const canDiv = totalValue.gt(0);
    const chainAssetsArray = Object.entries(chainUnit).map(
      ([chain, total]) => ({
        chain,
        total: total.toNumber(),
        percentage: !canDiv
          ? 0
          : total.div(totalValue).multipliedBy(100).toNumber(),
      }),
    );

    chainAssetsArray.sort((a, b) => b.total - a.total);

    return {
      chainAssets: chainAssetsArray,
      chainLength: Object.keys(chainUnit).length,
      top3Chains: chainAssetsArray.slice(0, 3).map(i => i.chain),
    };
  },
  recomputeFinalInfoFromChainUnits: (finalInfo: FinalInfo) => {
    const chainUnit: ChainAssetsUnit = {};

    Object.entries(finalInfo.token || {}).forEach(([chainId, total]) => {
      chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
      chainUnit[chainId] = chainUnit[chainId].plus(total);
    });

    Object.entries(finalInfo.portfolio || {}).forEach(([chainId, total]) => {
      chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
      chainUnit[chainId] = chainUnit[chainId].plus(total);
    });

    Object.entries(finalInfo.nft || {}).forEach(([chainId, total]) => {
      chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
      chainUnit[chainId] = chainUnit[chainId].plus(total);
    });

    finalInfo.computedResult =
      apisAddrChainStatics.getComputedResultFromChainAssets(chainUnit);

    return finalInfo;
  },
};

/* computation section :start */
function computeChainsListV2(
  caredAddresses: string[],
  {
    combinedTokens,
    combinedPortfolios,
    combinedNfts,
  }: // retFinalInfo,
  {
    combinedTokens?: ReturnType<typeof computeAssetsApis.memoTokens>;
    combinedPortfolios?: ReturnType<typeof computeAssetsApis.memoPortfolios>;
    combinedNfts?: ReturnType<typeof computeAssetsApis.memoNfts>;
    // retFinalInfo?: FinalInfo;
  } = {},
) {
  const finalInfo = /* retFinalInfo ||  */ apisAddrChainStatics.makeFinalInfo();

  const chainUnit: ChainAssetsUnit = {};

  const assetsMap = assetsMapStore.getState();

  const tokens =
    combinedTokens ||
    computeAssetsApis.memoTokens(caredAddresses, assetsMap.tokensMap);
  tokens?.forEach(token => {
    const chainId = token.chain;
    if (!finalInfo.token[chainId]) {
      finalInfo.token[chainId] = new BigNumber(0);
    }
    if (token._isExcludeBalance) {
      return;
    }
    finalInfo.token[chainId] = finalInfo.token[chainId].plus(
      token._usdValue || 0,
    );
    chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
    chainUnit[chainId] = chainUnit[chainId].plus(token._usdValue || 0);
  });

  const portfolios =
    combinedPortfolios ||
    computeAssetsApis.memoPortfolios(caredAddresses, assetsMap.portfoliosMap);
  portfolios?.forEach(portfolio => {
    const chainId = portfolio.chain;
    // ignore app chain percent
    if (!chainId || isAppChain(chainId)) {
      return;
    }
    if (!finalInfo.portfolio[chainId]) {
      finalInfo.portfolio[chainId] = new BigNumber(0);
    }
    if (portfolio._isExcludeBalance) {
      return;
    }
    finalInfo.portfolio[chainId] = finalInfo.portfolio[chainId].plus(
      portfolio.netWorth || 0,
    );
    chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
    chainUnit[chainId] = chainUnit[chainId].plus(portfolio.netWorth || 0);
  });

  const nfts =
    combinedNfts ||
    computeAssetsApis.memoNfts(caredAddresses, assetsMap.nftsMap);
  nfts?.forEach(nft => {
    const chainId = nft.chain;
    if (!finalInfo.nft[chainId]) {
      finalInfo.nft[chainId] = new BigNumber(0);
    }
    chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
  });

  finalInfo.computedResult =
    apisAddrChainStatics.getComputedResultFromChainAssets(chainUnit);

  return finalInfo;
}
