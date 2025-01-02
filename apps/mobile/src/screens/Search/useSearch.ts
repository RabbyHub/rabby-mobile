import { useDebounce } from 'ahooks';
import { useState } from 'react';
import { AbstractPortfolioToken } from '../Home/types';
import { CombineDefiItem, CombineNFTItem } from '../Home/hooks/store';

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
  tokens: AbstractPortfolioToken[],
  filterText?: string,
) => {
  if (!filterText) {
    return tokens;
  }
  return tokens.filter(token => {
    const tokenSymbolLower = token.symbol?.toLowerCase() || '';
    const tokenAddressLower = token._tokenId?.toLowerCase() || '';
    const tokenChainLower = token.chain?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';

    return [tokenSymbolLower, tokenAddressLower, tokenChainLower].some(i =>
      i.includes(filterTextLower),
    );
  });
};

export const filterPortfolios = (
  portfolios: CombineDefiItem[],
  filterText?: string,
) => {
  if (!filterText) {
    return portfolios;
  }
  return portfolios.filter(portfolio => {
    const portfolioNameLower = portfolio.name?.toLowerCase() || '';
    const portfolioAddressLower = portfolio.id?.toLowerCase() || '';
    const portfolioChainLower = portfolio.chain?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';
    return [
      portfolioNameLower,
      portfolioAddressLower,
      portfolioChainLower,
    ].some(i => i.includes(filterTextLower));
  });
};

export const filterNfts = (nfts: CombineNFTItem[], filterText?: string) => {
  if (!filterText) {
    return nfts;
  }
  return nfts.filter(nft => {
    const nftNameLower = nft.name?.toLowerCase() || '';
    const nftChainLower = nft.chain?.toLowerCase() || '';
    const nftContractIdLower = nft.contract_id?.toLowerCase() || '';
    const nftContractNameLower = nft.contract_name?.toLowerCase() || '';
    const filterTextLower = filterText?.toLowerCase() || '';
    return [
      nftNameLower,
      nftChainLower,
      nftContractIdLower,
      nftContractNameLower,
    ].some(i => i.includes(filterTextLower));
  });
};
