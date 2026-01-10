import { useDebounce } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import {
  CombineDefiItem,
  CombineNFTItem,
  CombineTokensItem,
} from '../Home/hooks/store';
import { formatAmount } from '@/utils/math';
import { AbstractPortfolio } from '../Home/types';
import { openapi } from '@/core/request';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useAccountInfo } from '../Address/components/MultiAssets/hooks/index';
import BigNumber from 'bignumber.js';
import { formatUsdValue } from '@/utils/number';
import { ITokenItem } from '@/store/tokens';
import { tokenItemToITokenItem } from '@/utils/token';
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
  portfolios: AbstractPortfolio[],
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

export const useSearchTokens = (filterText?: string) => {
  const [resultTokens, setResultTokens] = useState<ITokenItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchedRef = useRef<string>('');
  const { myTop10Addresses } = useAccountInfo();

  const handleSearch = async (text?: string) => {
    if (!text) {
      return;
    }
    searchedRef.current = text;
    setResultTokens([]);
    setLoading(true);
    try {
      const res = await openapi.searchTokensV2({
        q: text,
      });

      // 查询本地数据库获取 amount 数据
      const tokenList = res.map(token => ({
        chain: token.chain,
        tokenId: token.id,
      }));

      let localAmounts: Array<{
        chain: string;
        tokenId: string;
        amount: number;
      }> = [];
      if (myTop10Addresses.length > 0 && tokenList.length > 0) {
        try {
          localAmounts = await TokenItemEntity.getTokenListAmount({
            owner_addr: myTop10Addresses,
            tokenList,
          });
        } catch (error) {
          console.error('Failed to get local token amounts:', error);
        }
      }

      const amountMap = new Map<string, number>();
      localAmounts.forEach(item => {
        const key = `${item.chain}-${item.tokenId}`;
        amountMap.set(key, item.amount);
      });

      setResultTokens(
        res.map(token => {
          const key = `${token.chain}-${token.id}`;
          const localAmount = amountMap.get(key) || 0;

          return tokenItemToITokenItem(
            {
              ...token,
              amount: localAmount,
            },
            '',
          );
        }),
      );
      setSearched(true);
    } catch (error) {
      console.log('get web chain error)', filterText, error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (filterText !== searchedRef.current) {
      setSearched(false);
      setResultTokens([]);
    }
  }, [filterText]);

  return {
    resultTokens,
    searched,
    loading,
    handleSearch,
  };
};
