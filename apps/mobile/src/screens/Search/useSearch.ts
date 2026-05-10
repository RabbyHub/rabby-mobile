import { useDebounce } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { CombineNFTItem, CombineTokensItem } from '../Home/hooks/store';
import { openapi } from '@/core/request';
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
      setResultTokens(res.map(token => tokenItemToITokenItem(token, '')));
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
