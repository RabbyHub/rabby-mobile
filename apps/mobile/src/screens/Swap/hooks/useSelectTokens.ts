import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  makeTokenSettingSets,
  tagTokenItemFavorite,
} from '@/screens/Home/utils/token';
import { Account } from '@/core/services/preference';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import useTokenList, { ITokenItem } from '@/store/tokens';

import { useSelectTokensThreadSafe } from '@/components/Token/hooks/selectToken';

export const useSelectTokens = ({
  currentAccount: _currentAccount,
  chain_server_id,
}: {
  currentAccount?: Account | null;
  chain_server_id?: string;
}) => {
  const currentAccount = useDebouncedValue(_currentAccount, 100);
  const currentAddress = currentAccount?.address || _currentAccount?.address;
  const { top10Addresses } = useAccountInfo();

  const [isFirstFetch, setIsFirstFetch] = useState(true);

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
      if (!address) return;
      getTokenList(address, true);
    },
    [getTokenList],
  );

  const firstLoadedRef = useRef(false);
  useEffect(() => {
    if (!currentAddress) return;
    if (!firstLoadedRef.current) {
      firstLoadedRef.current = true;
      getTokenList(currentAddress, true);
    }
  }, [currentAddress, getTokenList]);

  const tokens = forTokenSelect(currentAddress, chain_server_id);

  const tokenWithOwner = useMemo(() => {
    const formatToken = (token: ITokenItem) => {
      const tagedToken = tagTokenItemFavorite(
        token,
        makeTokenSettingSets(userTokenSettings),
      );
      return tagedToken;
    };

    return {
      unFoldTokens: tokens.unFoldTokens.map(formatToken),
      foldTokens: tokens.foldTokens.map(formatToken),
      scamTokens: tokens.scamTokens.map(formatToken),
    };
  }, [tokens, userTokenSettings]);

  const checkIsExpireAndUpdate = useCallback(async () => {
    if (currentAccount) {
      return;
    }
    return batchGetTokenList(top10Addresses).finally(() => {
      setIsFirstFetch(false);
    });
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
    isLoading: isLoadingToken,
    checkIsExpireAndUpdate,
    loadToken,
    refreshing: !!isLoadingToken && !isFirstFetch,
    loadOnVisibleChanged,
  };
};
