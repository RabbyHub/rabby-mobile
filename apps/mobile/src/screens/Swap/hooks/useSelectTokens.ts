import { useCallback, useEffect, useMemo, useRef } from 'react';
import useAsync from 'react-use/lib/useAsync';

import {
  makeTokenSettingSets,
  tagTokenItemFavorite,
} from '@/screens/Home/utils/token';
import { Account } from '@/core/services/preference';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import useTokenList, { ITokenItem } from '@/store/tokens';

import { useSelectTokensThreadSafe } from '@/components/Token/hooks/selectToken';
import { openapi } from '@/core/request';
import { tokenItemToITokenItem } from '@/utils/token';

export const useSelectTokens = ({
  currentAccount: _currentAccount,
  chain_server_id,
  isLpTokenEnabled,
  keyword,
}: {
  currentAccount?: Account | null;
  chain_server_id?: string;
  isLpTokenEnabled?: boolean;
  keyword?: string;
}) => {
  const currentAccount = useDebouncedValue(_currentAccount, 100);
  const currentAddress = currentAccount?.address || _currentAccount?.address;
  const { top10Addresses } = useAccountInfo();
  const tokenSelectAddresses = useMemo(() => {
    if (currentAddress) {
      return [currentAddress];
    }
    return top10Addresses;
  }, [currentAddress, top10Addresses]);

  const {
    isLoading,
    isLoadingByAddress,
    forTokenSelect,
    batchGetTokenList,
    getTokenList,
  } = useTokenList();

  const isLoadingToken = useMemo(() => {
    if (!currentAccount) {
      return isLoading;
    }
    const address = currentAccount.address.toLowerCase();
    return isLoadingByAddress[address];
  }, [isLoading, isLoadingByAddress, currentAccount]);

  const { fetchAccountsAndTokenSettings, userTokenSettings } =
    useSelectTokensThreadSafe();

  const loadToken = useCallback(
    (address?: string) => {
      if (!address) {
        return;
      }
      getTokenList(address, true);
    },
    [getTokenList],
  );

  const firstLoadedRef = useRef(false);
  useEffect(() => {
    if (!currentAddress) {
      return;
    }
    if (!firstLoadedRef.current) {
      firstLoadedRef.current = true;
      getTokenList(currentAddress, true);
    }
  }, [currentAddress, getTokenList]);

  const { value: searchTokenResult, loading: searchingToken } =
    useAsync(async () => {
      if (!currentAddress || isLpTokenEnabled) {
        return [];
      }
      if (keyword) {
        const list = await openapi.searchToken(
          currentAddress,
          keyword,
          chain_server_id || '',
        );
        return list.map(item => tokenItemToITokenItem(item, currentAddress));
      }
      return [];
    }, [chain_server_id, currentAddress, keyword, isLpTokenEnabled]);

  const tokens = forTokenSelect(
    tokenSelectAddresses,
    chain_server_id,
    keyword,
    isLpTokenEnabled,
  );

  const formatToken = useCallback(
    (token: ITokenItem) =>
      tagTokenItemFavorite(token, makeTokenSettingSets(userTokenSettings)),
    [userTokenSettings],
  );

  const tokenWithOwner = useMemo(() => {
    if (searchTokenResult && (searchTokenResult?.length || 0) > 0) {
      return searchTokenResult.map(formatToken);
    }
    return tokens.map(formatToken);
  }, [tokens, searchTokenResult, formatToken]);

  const shouldLoadRecommended = useMemo(() => {
    if (
      !currentAddress ||
      isLpTokenEnabled ||
      keyword ||
      (searchTokenResult && searchTokenResult.length > 0)
    ) {
      return false;
    }
    return tokens.length < 10;
  }, [
    currentAddress,
    isLpTokenEnabled,
    keyword,
    searchTokenResult,
    tokens.length,
  ]);

  const { value: recommendedTokens, loading: loadingRecommendedTokens } =
    useAsync(async () => {
      if (!shouldLoadRecommended || !currentAddress) {
        return [];
      }
      const list = await openapi.getSwapTokenList(
        currentAddress,
        chain_server_id || '',
      );
      return list.map(item => tokenItemToITokenItem(item, ''));
    }, [shouldLoadRecommended, currentAddress, chain_server_id]);

  const finalTokens = useMemo(() => {
    if (recommendedTokens && recommendedTokens.length > 0) {
      const formattedRecommended = recommendedTokens.map(formatToken);
      return [...tokenWithOwner, ...formattedRecommended];
    }
    return tokenWithOwner;
  }, [tokenWithOwner, recommendedTokens, formatToken]);

  const checkIsExpireAndUpdate = useCallback(async () => {
    if (currentAccount) {
      return;
    }
    return batchGetTokenList(top10Addresses);
  }, [batchGetTokenList, currentAccount, top10Addresses]);

  const loadOnVisibleChanged = useCallback(
    (nextVisible = false) => {
      if (!nextVisible) {
        fetchAccountsAndTokenSettings();
      }
    },
    [fetchAccountsAndTokenSettings],
  );

  return {
    tokens: finalTokens,
    existedTokens: !!tokens.length,
    isSearching: searchingToken || loadingRecommendedTokens,
    isLoading: isLoadingToken,
    checkIsExpireAndUpdate,
    loadToken,
    loadOnVisibleChanged,
  };
};
