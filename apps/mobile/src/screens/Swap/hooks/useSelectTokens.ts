import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useShallow } from 'zustand/shallow';

import {
  makeTokenSettingSets,
  tagTokenItemFavorite,
} from '@/screens/Home/utils/token';
import { Account } from '@/core/services/preference';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import useTokenList, {
  buildTokenEntityId,
  ITokenItem,
  selectTokenSelectIndexResult,
  TokenSelectIndexRow,
  tokenEntityResourceStore,
  TokenEntityId,
  useTokenIndexStore,
} from '@/store/tokens';

import { useSelectTokensThreadSafe } from '@/components/Token/hooks/selectToken';
import { openapi } from '@/core/request';
import { tokenItemToITokenItem } from '@/utils/token';

const EMPTY_TOKEN_LIST: ITokenItem[] = [];
const EMPTY_TOKEN_ROWS: TokenSelectIndexRow[] = [];

const buildTokenRows = (tokens: ITokenItem[]): TokenSelectIndexRow[] => {
  if (!tokens.length) {
    return EMPTY_TOKEN_ROWS;
  }
  tokenEntityResourceStore.upsertTokens(tokens);
  return tokens.map(token => ({
    type: 'token',
    tokenId: buildTokenEntityId(token),
  }));
};

const useSkipRemoteLoad = (
  chain_server_id?: string,
  skipEmptyChainInit?: boolean,
) => {
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (chain_server_id) {
      setInitialized(true);
    }
  }, [chain_server_id]);
  return skipEmptyChainInit && !initialized;
};

export const useSelectTokens = ({
  currentAccount: _currentAccount,
  chain_server_id,
  isLpTokenEnabled,
  keyword,
  returnTokenObjects = false,
  skipEmptyChainInit = false,
}: {
  currentAccount?: Account | null;
  chain_server_id?: string;
  isLpTokenEnabled?: boolean;
  keyword?: string;
  returnTokenObjects?: boolean;
  skipEmptyChainInit?: boolean;
}) => {
  const currentAccount = useDebouncedValue(_currentAccount, 100);
  const currentAddress = currentAccount?.address || _currentAccount?.address;
  const prevCurrentAddress = useRef(
    currentAccount?.address || _currentAccount?.address,
  );
  const lastCurrentAddressRef = useRef(
    currentAccount?.address || _currentAccount?.address,
  );
  const { myTop10Addresses } = useAccountInfo();

  const skipRemoteLoad = useSkipRemoteLoad(chain_server_id, skipEmptyChainInit);

  // 产品需求：当 x 掉地址选择时搜索视图下仍然展示当前地址的余额，用 ref 缓存最后一个 currentAddress 实现
  useEffect(() => {
    if (currentAddress !== lastCurrentAddressRef.current) {
      prevCurrentAddress.current = lastCurrentAddressRef.current;
      lastCurrentAddressRef.current = currentAddress;
    }
  }, [currentAddress]);

  const tokenSelectAddresses = useMemo(() => {
    if (currentAddress) {
      return [currentAddress];
    }
    if (keyword && prevCurrentAddress.current) {
      // 产品需求：x 掉当前地址后默认视图下展示多地址的余额，搜索视图下只展示当前地址的余额
      return [prevCurrentAddress.current];
    }
    return myTop10Addresses;
  }, [currentAddress, myTop10Addresses, keyword]);

  const isLoading = useTokenList(s => s.isLoading);
  const isLoadingByAddress = useTokenList(s => s.isLoadingByAddress);
  const batchGetTokenList = useTokenList(s => s.batchGetTokenList);
  const getTokenList = useTokenList(s => s.getTokenList);

  const isLoadingToken = useMemo(() => {
    if (!currentAccount) {
      return isLoading;
    }
    const address = currentAccount.address.toLowerCase();
    if (isLpTokenEnabled) {
      return isLoadingByAddress[address]?.allLoading;
    }
    return isLoadingByAddress[address]?.loading;
  }, [currentAccount, isLpTokenEnabled, isLoadingByAddress, isLoading]);

  const { fetchAccountsAndTokenSettings, userTokenSettings } =
    useSelectTokensThreadSafe();

  const loadToken = useCallback(
    (address?: string) => {
      if (!address || skipRemoteLoad) {
        return;
      }
      getTokenList(address, true, chain_server_id);
    },
    [chain_server_id, getTokenList, skipRemoteLoad],
  );

  const lastLoadedTokenRequestKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentAddress || skipRemoteLoad) {
      return;
    }
    const requestKey = `${currentAddress.toLowerCase()}::${
      chain_server_id || ''
    }`;
    if (lastLoadedTokenRequestKeyRef.current !== requestKey) {
      lastLoadedTokenRequestKeyRef.current = requestKey;
      getTokenList(currentAddress, true, chain_server_id);
    }
  }, [chain_server_id, currentAddress, getTokenList, skipRemoteLoad]);

  const { value: searchTokenResult, loading: searchingToken } =
    useAsync(async () => {
      const address = currentAddress || prevCurrentAddress.current || '';
      if (keyword) {
        const list = await openapi.searchToken(
          address,
          keyword,
          chain_server_id || '',
        );
        return list.map(item => tokenItemToITokenItem(item, address));
      }
      return [];
    }, [chain_server_id, currentAddress, keyword]);

  useEffect(() => {
    useTokenIndexStore
      .getState()
      .syncFromTokenListMap(
        useTokenList.getState().tokenListMap,
        tokenSelectAddresses,
      );
  }, [tokenSelectAddresses]);

  const tokenSelectIndexResult = useTokenIndexStore(
    useShallow(state =>
      selectTokenSelectIndexResult(
        state,
        tokenSelectAddresses,
        chain_server_id,
        keyword,
        isLpTokenEnabled,
      ),
    ),
  );
  const tokenIds = tokenSelectIndexResult.tokenIds;
  const tokenRows = tokenSelectIndexResult.rows;

  const shouldSubscribeTokenObjects = !!keyword || returnTokenObjects;
  const tokenObjects = tokenEntityResourceStore.useStore(
    useShallow(state => {
      if (!shouldSubscribeTokenObjects) {
        return EMPTY_TOKEN_LIST;
      }
      return tokenIds
        .map(tokenId => state.valueMap[tokenId])
        .filter((token): token is ITokenItem => !!token);
    }),
  );

  const existingTokenIdSet = useMemo(() => {
    if (!keyword) {
      return null;
    }
    return new Set<TokenEntityId>(tokenIds);
  }, [keyword, tokenIds]);

  const mergedTokens = useMemo(() => {
    if (!keyword || !searchTokenResult?.length) {
      return tokenObjects;
    }
    const seen = new Set(tokenObjects.map(buildTokenEntityId));
    const mergedList = tokenObjects.slice();
    searchTokenResult.forEach(token => {
      const key = buildTokenEntityId(token);
      if (!seen.has(key)) {
        seen.add(key);
        mergedList.push(token);
      }
    });
    return mergedList;
  }, [keyword, searchTokenResult, tokenObjects]);

  const formatToken = useCallback(
    (token: ITokenItem) =>
      tagTokenItemFavorite(token, makeTokenSettingSets(userTokenSettings)),
    [userTokenSettings],
  );

  const tokenWithOwner = useMemo(() => {
    return mergedTokens.map(formatToken);
  }, [mergedTokens, formatToken]);

  const shouldLoadRecommended = useMemo(() => {
    if (
      !currentAddress ||
      isLpTokenEnabled ||
      keyword ||
      (searchTokenResult && searchTokenResult.length > 0)
    ) {
      return false;
    }
    return tokenRows.length === 0;
  }, [
    currentAddress,
    isLpTokenEnabled,
    keyword,
    searchTokenResult,
    tokenRows.length,
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
    if (!returnTokenObjects) {
      return EMPTY_TOKEN_LIST;
    }
    if (recommendedTokens && recommendedTokens.length > 0) {
      const formattedRecommended = recommendedTokens.map(formatToken);
      return [...tokenWithOwner, ...formattedRecommended];
    }
    return tokenWithOwner;
  }, [returnTokenObjects, recommendedTokens, tokenWithOwner, formatToken]);

  const finalTokenRows = useMemo(() => {
    if (recommendedTokens && recommendedTokens.length > 0) {
      return [
        ...buildTokenRows(tokenWithOwner),
        ...buildTokenRows(recommendedTokens),
      ];
    }
    if (keyword && searchTokenResult?.length) {
      const externalTokens = tokenWithOwner.filter(token => {
        if (!existingTokenIdSet) {
          return true;
        }
        return !existingTokenIdSet.has(buildTokenEntityId(token));
      });
      return [...tokenRows, ...buildTokenRows(externalTokens)];
    }
    return tokenRows;
  }, [
    existingTokenIdSet,
    keyword,
    recommendedTokens,
    searchTokenResult?.length,
    tokenRows,
    tokenWithOwner,
  ]);

  const checkIsExpireAndUpdate = useCallback(async () => {
    if (currentAccount) {
      return;
    }
    return batchGetTokenList(myTop10Addresses);
  }, [batchGetTokenList, currentAccount, myTop10Addresses]);

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
    tokenRows: finalTokenRows,
    existedTokens:
      !!finalTokenRows.length || !!finalTokens.length || !!tokenObjects.length,
    isSearching: searchingToken || loadingRecommendedTokens,
    isLoading: isLoadingToken,
    checkIsExpireAndUpdate,
    loadToken,
    loadOnVisibleChanged,
  };
};
