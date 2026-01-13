import BigNumber from 'bignumber.js';
import { isAppChain } from '@/screens/Home/utils/appchain';
import { AbstractProject, DisplayNftItem } from './types';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { assetsMapStore, computeAssetsApis } from './hooks/store';
import tokenStore, { ITokenItem } from '@/store/tokens';
import { debounce, isEqual } from 'lodash';
import { getTop10MyAccounts } from '@/core/apis/account';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { DisplayedProject } from './utils/project';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

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
  Parameters<typeof assetsMapStore.subscribe | typeof tokenStore.subscribe>[0]
>(async () => {
  const { top10Addresses } = await getTop10MyAccounts();

  setFinalInfo(computeChainsListV2(top10Addresses));
}, 100);

assetsMapStore.subscribe(debounceComputeChainList);
tokenStore.subscribe(debounceComputeChainList);

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

export function useAddrChainLength(address?: string) {
  const addr = address?.toLowerCase();
  const chainLength =
    addrChainStaticsStore(
      useShallow(s => (!addr ? 0 : s[addr]?.computedResult.chainLength || 0)),
    ) || 0;
  return { chainLength };
}

export function useAddrTop3Chains(address?: string) {
  const addr = address?.toLowerCase();
  const defaultValue = useMemo(() => [], []);
  const top3Chains =
    addrChainStaticsStore(s =>
      !addr ? defaultValue : s[addr]?.computedResult.top3Chains,
    ) || defaultValue;
  return { top3Chains };
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
  computeChainAssetsToken: (tokens: ITokenItem[]) => {
    const chainUnit: ChainAssetsUnit = {};
    tokens?.forEach(token => {
      const chainId = token.chain;
      if (!chainUnit[chainId]) {
        chainUnit[chainId] = new BigNumber(0);
      }
      if (token.is_core) {
        chainUnit[chainId] = chainUnit[chainId].plus(token.usd_value || 0);
      }
    });

    return chainUnit;
  },
  updateToken: (addr: string, tokens: ITokenItem[]) => {
    addr = addr.toLowerCase();
    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const token = apisAddrChainStatics.computeChainAssetsToken(tokens);
    // if (isEqual(prevFinalInfo.token, token)) return ;
    prevFinalInfo.token = token;

    const computed =
      apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo);
    if (isEqual(prevFinalInfo.computedResult, computed)) return;

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: { ...prevFinalInfo, computedResult: computed },
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
  updatePortfolio: debounce((addr: string, _portfolios: DisplayedProject[]) => {
    addr = addr.toLowerCase();
    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const combinedPortfolios = computeAssetsApis.memoPortfolios([addr], {
      [addr]: _portfolios,
    });

    const portfolio =
      apisAddrChainStatics.computeChainAssetsPortfolio(combinedPortfolios);
    // if (isEqual(prevFinalInfo.portfolio, portfolio)) return ;

    prevFinalInfo.portfolio = portfolio;
    const computed =
      apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo);
    if (isEqual(prevFinalInfo.computedResult, computed)) return;

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: { ...prevFinalInfo, computedResult: computed },
      };
    });
  }, 300),
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
  updateNft: debounce((addr: string, nftList: DisplayNftItem[]) => {
    addr = addr.toLowerCase();
    const prevFinalInfo =
      addrChainStaticsStore.getState()[addr] ||
      apisAddrChainStatics.makeFinalInfo();
    const combinedNfts = computeAssetsApis.memoNfts([addr], {
      [addr]: nftList,
    });

    const nft = apisAddrChainStatics.computeChainAssetsNft(combinedNfts);
    // if (isEqual(prevFinalInfo.nft, nft)) return ;

    prevFinalInfo.nft = nft;
    const computed =
      apisAddrChainStatics.recomputeFinalInfoFromChainUnits(prevFinalInfo);
    if (isEqual(prevFinalInfo.computedResult, computed)) return;

    setAddressChainInfo(prev => {
      return {
        ...prev,
        [addr]: { ...prevFinalInfo, computedResult: computed },
      };
    });
  }, 300),
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
  recomputeFinalInfoFromChainUnits: (finalInfo: BaseInfo) => {
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

    const computedResult =
      apisAddrChainStatics.getComputedResultFromChainAssets(chainUnit);

    return computedResult;
  },
};

/* computation section :start */
function computeChainsListV2(caredAddresses: string[]) {
  const finalInfo = /* retFinalInfo ||  */ apisAddrChainStatics.makeFinalInfo();

  const chainUnit: ChainAssetsUnit = {};

  const assetsMap = assetsMapStore.getState();
  const tokenListMap = tokenStore.getState().tokenListMap;
  const addrsInStore = Object.keys(tokenListMap);
  addrsInStore.forEach(addr => {
    apisAddrChainStatics.updateToken(addr, tokenListMap[addr]!);
  });
  const tokens = addrsInStore
    .filter(key => caredAddresses.includes(key))
    .map(key => tokenListMap[key] || [])
    .flat()
    .filter(token => token.is_core);
  tokens?.forEach(token => {
    const chainId = token.chain;
    if (!finalInfo.token[chainId]) {
      finalInfo.token[chainId] = new BigNumber(0);
    }
    finalInfo.token[chainId] = finalInfo.token[chainId].plus(
      token.usd_value || 0,
    );
    chainUnit[chainId] = chainUnit[chainId] || new BigNumber(0);
    chainUnit[chainId] = chainUnit[chainId].plus(token.usd_value || 0);
  });

  const portfolios = computeAssetsApis.memoPortfolios(
    caredAddresses,
    assetsMap.portfoliosMap,
  );
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

  const nfts = computeAssetsApis.memoNfts(caredAddresses, assetsMap.nftsMap);
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
