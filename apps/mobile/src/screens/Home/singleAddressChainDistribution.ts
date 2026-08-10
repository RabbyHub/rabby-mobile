import BigNumber from 'bignumber.js';
import { isEqual } from 'lodash';

import { isAppChain } from '@/screens/Home/utils/appchain';
import type { IProtocolItem } from '@/store/protocols';
import type { ITokenItem } from '@/store/tokens';
import type { ChainListItem } from '@/components2024/SelectChainWithDistribute';

import type { DisplayNftItem } from './types';

export type ChainAssetsUnit = Record<string, BigNumber>;

export type SingleAddressChainInfo = {
  token: ChainAssetsUnit;
  portfolio: ChainAssetsUnit;
  nft: ChainAssetsUnit;
  computedResult: {
    chainAssets: ChainListItem[];
    chainLength: number;
    top3Chains: string[];
  };
};

export type SingleAddressChainDomain = 'token' | 'portfolio' | 'nft';

export type AddressChainDomainUpdate = {
  address: string;
  domain: SingleAddressChainDomain;
  chainUnit: ChainAssetsUnit;
};

export const makeSingleAddressChainInfo = (): SingleAddressChainInfo => ({
  token: {},
  portfolio: {},
  nft: {},
  computedResult: {
    chainAssets: [],
    chainLength: 0,
    top3Chains: [],
  },
});

export const computeTokenChainAssets = (tokens: ITokenItem[]) => {
  const chainUnit: ChainAssetsUnit = {};
  tokens.forEach(token => {
    if (!token.chain) {
      return;
    }
    chainUnit[token.chain] = chainUnit[token.chain] || new BigNumber(0);
    if (token.is_core) {
      chainUnit[token.chain] = chainUnit[token.chain].plus(
        token.usd_value || 0,
      );
    }
  });
  return chainUnit;
};

export const computePortfolioChainAssets = (portfolios: IProtocolItem[]) => {
  const chainUnit: ChainAssetsUnit = {};
  portfolios.forEach(portfolio => {
    if (!portfolio.chain || isAppChain(portfolio.chain)) {
      return;
    }
    chainUnit[portfolio.chain] = (
      chainUnit[portfolio.chain] || new BigNumber(0)
    ).plus(portfolio.netWorth || 0);
  });
  return chainUnit;
};

export const computeNftChainAssets = (
  nftList: Array<Pick<DisplayNftItem, 'chain' | 'id'>>,
) => {
  const chainUnit: ChainAssetsUnit = {};
  nftList.forEach(nft => {
    if (nft.id && nft.chain && !chainUnit[nft.chain]) {
      chainUnit[nft.chain] = new BigNumber(0);
    }
  });
  return chainUnit;
};

export const computeChainDistribution = (chainUnit: ChainAssetsUnit) => {
  const totalValue = Object.values(chainUnit).reduce(
    (sum, total) => sum.plus(total),
    new BigNumber(0),
  );
  const canDivide = totalValue.gt(0);
  const chainAssets = Object.entries(chainUnit)
    .map(([chain, total]) => ({
      chain,
      total: total.toNumber(),
      percentage: canDivide
        ? total.div(totalValue).multipliedBy(100).toNumber()
        : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    chainAssets,
    chainLength: chainAssets.length,
    top3Chains: chainAssets.slice(0, 3).map(item => item.chain),
  };
};

export const recomputeSingleAddressChainInfo = (
  info: Pick<SingleAddressChainInfo, SingleAddressChainDomain>,
) => {
  const chainUnit: ChainAssetsUnit = {};
  (['token', 'portfolio', 'nft'] as const).forEach(domain => {
    Object.entries(info[domain]).forEach(([chainId, total]) => {
      chainUnit[chainId] = (chainUnit[chainId] || new BigNumber(0)).plus(total);
    });
  });
  return computeChainDistribution(chainUnit);
};

export const updateSingleAddressChainDomain = (
  previous: SingleAddressChainInfo,
  domain: SingleAddressChainDomain,
  chainUnit: ChainAssetsUnit,
): SingleAddressChainInfo => {
  if (isEqual(previous[domain], chainUnit)) {
    return previous;
  }

  const next = {
    ...previous,
    [domain]: chainUnit,
  };
  const computedResult = recomputeSingleAddressChainInfo(next);

  return {
    ...next,
    computedResult: isEqual(previous.computedResult, computedResult)
      ? previous.computedResult
      : computedResult,
  };
};

export const applyAddressChainDomainUpdates = (
  previousState: Record<string, SingleAddressChainInfo>,
  updates: AddressChainDomainUpdate[],
) => {
  let nextState = previousState;

  updates.forEach(({ address, domain, chainUnit }) => {
    const normalizedAddress = address.toLowerCase();
    const previousInfo =
      nextState[normalizedAddress] || makeSingleAddressChainInfo();
    const nextInfo = updateSingleAddressChainDomain(
      previousInfo,
      domain,
      chainUnit,
    );
    if (nextInfo === previousInfo) {
      return;
    }
    if (nextState === previousState) {
      nextState = { ...previousState };
    }
    nextState[normalizedAddress] = nextInfo;
  });

  return nextState;
};

export const getChangedAddressKeys = <T>(
  previous: Record<string, T>,
  next: Record<string, T>,
) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return Array.from(keys).filter(key => previous[key] !== next[key]);
};
