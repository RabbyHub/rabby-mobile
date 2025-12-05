import { useCallback, useMemo, useState } from 'react';
import BigNumber from 'bignumber.js';
import { isAppChain } from '@/screens/Home/utils/appchain';
import {
  AbstractPortfolioToken,
  AbstractProject,
  DisplayNftItem,
} from './types';

interface BaseInfo {
  token: Record<string, BigNumber>;
  portfolio: Record<string, BigNumber>;
  nft: Record<string, BigNumber>;
}
export const useChainInfo = () => {
  const [baseInfo, setBaseInfo] = useState<BaseInfo>({
    token: {},
    portfolio: {},
    nft: {},
  });

  const updateToken = useCallback((tokens: AbstractPortfolioToken[]) => {
    const chainAssets: Record<string, BigNumber> = {};
    tokens?.forEach(token => {
      const chainId = token.chain;
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = new BigNumber(0);
      }
      if (token._isExcludeBalance) {
        return;
      }
      chainAssets[chainId] = chainAssets[chainId].plus(token._usdValue || 0);
    });
    setBaseInfo(prev => ({
      ...prev,
      token: chainAssets,
    }));
  }, []);

  const updatePortfolio = useCallback((_portfolios: AbstractProject[]) => {
    const chainAssets: Record<string, BigNumber> = {};
    _portfolios?.forEach(portfolio => {
      const chainId = portfolio.chain;
      // ignore app chain percent
      if (!chainId || isAppChain(chainId)) {
        return;
      }
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = new BigNumber(0);
      }
      if (portfolio._isExcludeBalance) {
        return;
      }
      chainAssets[chainId] = chainAssets[chainId].plus(portfolio.netWorth || 0);
    });
    setBaseInfo(prev => ({
      ...prev,
      portfolio: chainAssets,
    }));
  }, []);

  const updateNft = useCallback((nftList: DisplayNftItem[]) => {
    const chainAssets: Record<string, BigNumber> = {};
    nftList?.forEach(nft => {
      const chainId = nft.chain;
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = new BigNumber(0);
      }
    });
    setBaseInfo(prev => ({
      ...prev,
      nft: chainAssets,
    }));
  }, []);

  const chainsInfo = useMemo(() => {
    const chainAssets: Record<
      string,
      {
        total: BigNumber;
        percentage: BigNumber;
      }
    > = {};
    Object.entries(baseInfo.token).forEach(([chainId, value]) => {
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
      chainAssets[chainId].total = chainAssets[chainId].total.plus(value);
    });

    Object.entries(baseInfo.portfolio).forEach(([chainId, value]) => {
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
      chainAssets[chainId].total = chainAssets[chainId].total.plus(value);
    });
    // nft not count percentage
    Object.entries(baseInfo.nft).forEach(([chainId]) => {
      if (!chainAssets[chainId]) {
        chainAssets[chainId] = {
          total: new BigNumber(0),
          percentage: new BigNumber(0),
        };
      }
    });
    const totalValue = Object.values(chainAssets).reduce(
      (sum, { total }) => sum.plus(total),
      new BigNumber(0),
    );

    if (totalValue.gt(0)) {
      Object.keys(chainAssets).forEach(chainId => {
        chainAssets[chainId].percentage =
          chainAssets[chainId].total.div(totalValue);
      });
    }
    const chainAssetsArray = Object.entries(chainAssets).map(
      ([chain, data]) => ({
        chain,
        total: data.total.toNumber(),
        percentage: data.percentage.multipliedBy(100).toNumber(),
      }),
    );

    chainAssetsArray.sort((a, b) => b.total - a.total);

    return {
      chainAssets: chainAssetsArray,
      chainLength: Object.keys(chainAssets).length,
    };
  }, [baseInfo.token, baseInfo.portfolio, baseInfo.nft]);

  return {
    chainsInfo,
    updateToken,
    updatePortfolio,
    updateNft,
  };
};
