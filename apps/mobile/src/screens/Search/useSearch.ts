import { useDebounce } from 'ahooks';
import { useState } from 'react';
import {
  CombineDefiItem,
  CombineNFTItem,
  CombineTokensItem,
} from '../Home/hooks/store';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedPortfolio } from '../Home/utils/project';
import { formatAmount } from '@/utils/math';

export const useSearch = () => {
  const [searchState, setSearchState] = useState<string>('');
  const debouncedSearchValue = useDebounce(searchState, {
    wait: 500,
  });
  return {
    debouncedSearchValue,
    searchState,
    setSearchState,
  };
};
export const filterTokens = (
  tokens: CombineTokensItem[],
  filterText?: string,
) => {
  if (!filterText) {
    return tokens;
  }
  return tokens.filter(token => {
    const tokenSymbolLower = token.symbol?.toLowerCase() || '';
    const tokenAddressLower = token._tokenId?.toLowerCase() || '';
    // const tokenChainLower = token.chain?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';

    return [tokenSymbolLower, tokenAddressLower].some(i =>
      i.includes(filterTextLower),
    );
  });
};
const findTokenWithHighestAmount = (
  portfolios: DisplayedPortfolio[],
  filterText: string,
) => {
  const symbolTotals = new Map();
  const filterTextLower = filterText.toLowerCase();

  portfolios.forEach(position => {
    position._tokenList.forEach(token => {
      if (token.symbol.toLowerCase().includes(filterTextLower)) {
        const currentTotal = symbolTotals.get(token.symbol) || 0;
        symbolTotals.set(token.symbol, currentTotal + token.amount);
      }
    });
  });

  if (symbolTotals.size === 0) {
    return null;
  }

  let maxSymbol = '';
  let maxAmount = 0;

  symbolTotals.forEach((amount, symbol) => {
    if (amount > maxAmount) {
      maxAmount = amount;
      maxSymbol = symbol;
    }
  });

  return {
    symbol: maxSymbol,
    amount: maxAmount,
  };
};

export const filterPortfolios = (
  portfolios: CombineDefiItem[],
  filterText?: string,
) => {
  if (!filterText) {
    return portfolios;
  }
  const res: CombineDefiItem[] = [];
  portfolios.forEach(portfolio => {
    const portfolioNameLower = portfolio.name?.toLowerCase() || '';
    const portfolioAddressLower = portfolio.id?.toLowerCase() || '';
    // const portfolioChainLower = portfolio.chain?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';
    const { symbol, amount } =
      findTokenWithHighestAmount(portfolio._portfolios, filterText) || {};
    if (
      [portfolioNameLower, portfolioAddressLower].some(i =>
        i.includes(filterTextLower),
      ) ||
      amount
    ) {
      res.push(
        Object.assign(
          portfolio,
          amount
            ? {
                filterTokenDesc: `${formatAmount(amount)}${symbol}`,
              }
            : {},
        ),
      );
      return;
    }
  });
  return res;
};

export const filterNfts = (nfts: CombineNFTItem[], filterText?: string) => {
  if (!filterText) {
    return nfts;
  }
  return nfts.filter(nft => {
    const nftNameLower = nft.name?.toLowerCase() || '';
    // const nftChainLower = nft.chain?.toLowerCase() || '';
    // const nftContractIdLower = nft.contract_id?.toLowerCase() || '';
    // const nftContractNameLower = nft.contract_name?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';
    return [
      nftNameLower,
      // nftChainLower,
      // nftContractIdLower,
      // nftContractNameLower,
    ].some(i => i.includes(filterTextLower));
  });
};

export const combinePinTokens = (
  pinTokens: TokenItem[],
  tokens: CombineTokensItem[],
) => {
  const existPinTokens = tokens
    .filter(i => i._isPined)
    .sort((a, b) => {
      if (a._isPined && b._isPined) {
        return a._pinIndex! - b._pinIndex!;
      }
      if (a._isPined) {
        return -1;
      }
      if (b._isPined) {
        return 1;
      }
      return 0;
    });
  const noPinTokens = tokens.filter(i => !i._isPined).sort();
  const unloadPinTokens = pinTokens
    .filter(
      i =>
        !existPinTokens.some(j => j._tokenId === i.id && j.chain === i.chain),
    )
    .map(i => ({
      ...i,
      _isPined: true,
      _isFold: false,
      _isExcludeBalance: false,
      _usdValueStr: 0,
      _amountStr: 1,
      _unHold: true,
      _tokenId: i.id,
    }));
  return [
    ...existPinTokens,
    ...unloadPinTokens,
    ...noPinTokens,
  ] as CombineTokensItem[];
};
