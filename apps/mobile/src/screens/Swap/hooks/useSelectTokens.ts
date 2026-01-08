import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  useEffect(() => {
    console.log(keyword, Date.now());
  }, [keyword]);

  const mergedTokens = useMemo(() => {
    if (!searchTokenResult?.length) {
      return tokens;
    }

    const tokensKeySet = new Set<string>();
    const collectTokenKeys = (list: ITokenItem[]) => {
      list.forEach(item => {
        tokensKeySet.add(`${item.chain}_${item.id}`);
      });
    };
    collectTokenKeys(tokens.unFoldTokens);
    collectTokenKeys(tokens.foldTokens);
    collectTokenKeys(tokens.scamTokens);

    const seenSearchKeys = new Set<string>();
    const sortedSearchTokens = searchTokenResult
      .filter(item => {
        const key = `${item.chain}_${item.id}`;
        if (tokensKeySet.has(key) || seenSearchKeys.has(key)) {
          return false;
        }
        seenSearchKeys.add(key);
        return true;
      })
      .sort((a, b) => {
        if (a.is_core !== b.is_core) {
          return a.is_core ? -1 : 1;
        }
        return (b.credit_score || 0) - (a.credit_score || 0);
      });

    return {
      ...tokens,
      unFoldTokens: tokens.unFoldTokens.concat(sortedSearchTokens),
    };
  }, [tokens, searchTokenResult]);

  const formatToken = useCallback(
    (token: ITokenItem) =>
      tagTokenItemFavorite(token, makeTokenSettingSets(userTokenSettings)),
    [userTokenSettings],
  );

  const tokenWithOwner = useMemo(
    () => ({
      unFoldTokens: mergedTokens.unFoldTokens.map(formatToken),
      foldTokens: mergedTokens.foldTokens.map(formatToken),
      scamTokens: mergedTokens.scamTokens.map(formatToken),
    }),
    [mergedTokens, formatToken],
  );

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
      tokens.foldTokens.length +
      tokens.unFoldTokens.length +
      tokens.scamTokens.length
    ),
    isSearching: searchingToken,
    isLoading: isLoadingToken,
    checkIsExpireAndUpdate,
    loadToken,
    loadOnVisibleChanged,
  };
};
