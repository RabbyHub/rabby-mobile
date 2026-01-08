import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import {
  makeTokenSettingSets,
  tagTokenItemFavorite,
} from '@/screens/Home/utils/token';
import { Account } from '@/core/services/preference';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import useTokenList, {
  getTokenSelectCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';

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

  const { isLoading, isLoadingByAddress, batchGetTokenList, getTokenList } =
    useTokenList();

  const registerTokenSelect = useTokenListComputedStore(
    state => state.registerTokenSelect,
  );
  const emptyTokenSelectResult = useMemo(
    () => ({
      unFoldTokens: [] as ITokenItem[],
      foldTokens: [] as ITokenItem[],
      scamTokens: [] as ITokenItem[],
    }),
    [],
  );

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
      if (!currentAddress) {
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

  const tokenSelectKey = useMemo(
    () =>
      getTokenSelectCacheKey(
        tokenSelectAddresses,
        chain_server_id,
        keyword,
        isLpTokenEnabled,
      ),
    [tokenSelectAddresses, chain_server_id, keyword, isLpTokenEnabled],
  );

  useEffect(() => {
    registerTokenSelect(
      tokenSelectAddresses,
      chain_server_id,
      keyword,
      isLpTokenEnabled,
    );
  }, [
    registerTokenSelect,
    tokenSelectAddresses,
    chain_server_id,
    keyword,
    isLpTokenEnabled,
  ]);

  const tokens = useTokenListComputedStore(state => {
    return state.tokenSelectCache[tokenSelectKey] || emptyTokenSelectResult;
  });

  const mergedTokens = useMemo(() => {
    if (!keyword || !searchTokenResult?.length) {
      return tokens;
    }
    const seen = new Set(
      tokens.unFoldTokens.map(token => `${token.chain}:${token.id}`),
    );
    const mergedList = tokens.unFoldTokens.slice();
    searchTokenResult.forEach(token => {
      const key = `${token.chain}:${token.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        mergedList.push(token);
      }
    });
    return {
      unFoldTokens: mergedList,
      foldTokens: [],
      scamTokens: [],
    };
  }, [keyword, searchTokenResult, tokens]);

  const formatToken = useCallback(
    (token: ITokenItem) =>
      tagTokenItemFavorite(token, makeTokenSettingSets(userTokenSettings)),
    [userTokenSettings],
  );

  const tokenWithOwner = useMemo(() => {
    return {
      unFoldTokens: mergedTokens.unFoldTokens.map(formatToken),
      foldTokens: mergedTokens.foldTokens.map(formatToken),
      scamTokens: mergedTokens.scamTokens.map(formatToken),
    };
  }, [mergedTokens, formatToken]);

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
    tokens: tokenWithOwner,
    existedTokens: !!(
      mergedTokens.foldTokens.length +
      mergedTokens.unFoldTokens.length +
      mergedTokens.scamTokens.length
    ),
    isSearching: searchingToken,
    isLoading: isLoadingToken,
    checkIsExpireAndUpdate,
    loadToken,
    loadOnVisibleChanged,
  };
};
