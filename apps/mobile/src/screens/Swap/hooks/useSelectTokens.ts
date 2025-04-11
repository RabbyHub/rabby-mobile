import { useSafeState } from '@/hooks/useSafeState';
import { useMyAccounts } from '@/hooks/account';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _ from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { tokenItem2AbstractTokenWithOwner } from '@/utils/token';
import { tagTokenItem } from '@/screens/Home/utils/token';
import { preferenceService } from '@/core/services';
import useAsync from 'react-use/lib/useAsync';
import { TokenSelectType } from '@/components/Token/TokenSelectorSheetModal';
import { openapi } from '@/core/request';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { Account } from '@/core/services/preference';

export const useTokenAssetsMap = () => {
  const [tokensMap, setTokensMap] = useState<{
    [address: string]: TokenItem[];
  }>({});

  const updateTokens = useCallback(
    ({ address, newTokens }: { address: string; newTokens: TokenItem[] }) => {
      const lowerAddress = address.toLowerCase();
      setTokensMap(pre => {
        return {
          ...pre,
          [lowerAddress]: newTokens,
        };
      });
    },
    [],
  );
  return { tokensMap, setTokensMap, updateTokens };
};

export const useSelectTokens = ({
  currentAccount,
  visible,
  keyword,
  chain_server_id,
  type,
}: {
  currentAccount?: Account | null;
  visible?: boolean;
  keyword?: string;
  chain_server_id?: string;
  type?: TokenSelectType;
}) => {
  const [isLoading, setLoading] = useSafeState(false);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const { tokensMap, setTokensMap, updateTokens } = useTokenAssetsMap();
  const [userTokenSettings, setUserTokenSettings] = useState({});
  const currentAddress = currentAccount?.address;

  const {
    value: swapToTokenSearchResult,
    loading: swapToTokenSearchResultLoading,
  } = useAsync(async () => {
    if (type === 'swapTo' && keyword) {
      const list = await openapi.searchTokensV2({
        q: keyword,
      });
      return list
        .filter(e => e.chain === chain_server_id)
        .map(
          e =>
            ({
              ...e,
              _isPined: false,
              _isFold: false,
              _isExcludeBalance: false,
              _usdValueStr: 0,
              _amountStr: 1,
              _tokenId: e.id,
            } as any as AbstractPortfolioToken),
        );
    }
    return [];
  }, [keyword, chain_server_id]);

  useEffect(() => {
    if (visible && Object.keys(userTokenSettings).length === 0) {
      preferenceService
        .getUserTokenSettings()
        .then(res => res || {})
        .then(setUserTokenSettings);
    }
  }, [userTokenSettings, visible]);

  const loadToken = useCallback(
    async (address: string, force?: boolean) => {
      if (!address) {
        return;
      }
      const tokensExisted = !!tokensMap[address]?.length;
      // if token exist and not expired, don't sync to store
      const tokenRes = await syncTokens(address, force, tokensExisted);
      if (!tokenRes.length) {
        return;
      }
      updateTokens({
        address,
        newTokens: tokenRes || [],
      });
    },
    [tokensMap, updateTokens],
  );

  const batchLoadCacheTokens = useCallback(
    async (addresses: string[]) => {
      if (!addresses.length) {
        return;
      }
      setLoading(true);
      const cachedTokens = await TokenItemEntity.batchMultAddressTokens(
        addresses,
      );
      const assestGroup = _.groupBy(cachedTokens, 'owner_addr');
      setTokensMap(_pre => {
        const curr = { ...(_pre || {}) };
        Object.keys(assestGroup).forEach(address => {
          curr[address] = assestGroup[address];
        });
        return curr;
      });
      setTimeout(() => {
        setLoading(false);
      }, 0);
    },
    [setLoading, setTokensMap],
  );

  const checkIsExpireAndUpdate = useCallback(
    async (force?: boolean) => {
      const top10Account = sortedAccounts
        .slice(0, 10)
        .filter(acc => acc.balance);
      const addresses = [
        ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
      ];
      try {
        for (const address of addresses) {
          try {
            await loadToken(address, force);
          } catch (error) {
            console.error(
              `Error fetching data for ${address.slice(-4)}:`,
              error,
            );
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      } finally {
        setIsFirstFetch(false);
      }
    },
    [loadToken, sortedAccounts],
  );

  const getCacheTop10Tokens = useCallback(async () => {
    const top10Account = sortedAccounts.slice(0, 10).filter(acc => acc.balance);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    const emptyTokenAddresses = addresses.filter(
      addr => !tokensMap[addr]?.length,
    );
    await batchLoadCacheTokens(emptyTokenAddresses);
  }, [batchLoadCacheTokens, sortedAccounts, tokensMap]);

  const getCacheTokens = useCallback(
    (addrresses: string[]) => {
      return batchLoadCacheTokens(addrresses);
    },
    [batchLoadCacheTokens],
  );

  // filter tokens
  const tokens = useMemo(() => {
    let resTokens: TokenItem[] = [];
    if (!visible) {
      return [];
    }
    if (currentAddress) {
      resTokens = tokensMap[currentAddress?.toLocaleLowerCase()] || [];
    } else {
      resTokens = Object.values(tokensMap).flat();
    }
    if (chain_server_id) {
      resTokens = resTokens.filter(token => token.chain === chain_server_id);
    }
    if (keyword) {
      resTokens = resTokens
        .filter(item => {
          const matchKeyWords = [item.id, item.symbol];
          return matchKeyWords.some(i =>
            i?.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
          );
        })
        .sort((a, b) => {
          const keywordLower = keyword.toLocaleLowerCase();
          const aIdLower = a.id?.toLocaleLowerCase() || '';
          const bIdLower = b.id?.toLocaleLowerCase() || '';
          const aSymbolLower = a.symbol?.toLocaleLowerCase() || '';
          const bSymbolLower = b.symbol?.toLocaleLowerCase() || '';

          // Check exact matches
          const aExactMatch =
            aIdLower === keywordLower || aSymbolLower === keywordLower;
          const bExactMatch =
            bIdLower === keywordLower || bSymbolLower === keywordLower;

          // Check is_core status
          const aIsCore = a.is_core;
          const bIsCore = b.is_core;

          // Calculate scores based on match type and is_core status
          const getScore = (exactMatch: boolean, isCore: boolean) => {
            if (exactMatch && isCore) return 4;
            if (exactMatch && !isCore) return 3;
            if (!exactMatch && isCore) return 2;
            return 1;
          };

          const aScore = getScore(aExactMatch, aIsCore);
          const bScore = getScore(bExactMatch, bIsCore);

          // Compare scores
          if (aScore !== bScore) {
            return bScore - aScore; // Higher score comes first
          }

          // If scores are equal, use is_scam as tiebreaker
          if (a.is_scam !== b.is_scam) {
            return a.is_scam ? 1 : -1;
          }

          // If still equal, prioritize id matches over symbol matches
          const aIdMatch = aIdLower.includes(keywordLower);
          const bIdMatch = bIdLower.includes(keywordLower);
          const aSymbolMatch = aSymbolLower.includes(keywordLower);
          const bSymbolMatch = bSymbolLower.includes(keywordLower);

          if (aIdMatch && !bIdMatch) return -1;
          if (!aIdMatch && bIdMatch) return 1;
          if (aSymbolMatch && !bSymbolMatch) return -1;
          if (!aSymbolMatch && bSymbolMatch) return 1;

          // sort with balance
          const aUsdValue = a.usd_value || a.price * a.amount;
          const bUsdValue = b.usd_value || b.price * b.amount;
          return bUsdValue - aUsdValue;
        });
    } else {
      resTokens = resTokens.sort((a, b) => {
        const aUsdValue = a.usd_value || a.price * a.amount;
        const bUsdValue = b.usd_value || b.price * b.amount;
        return bUsdValue - aUsdValue;
      });
    }

    return resTokens;
  }, [chain_server_id, currentAddress, keyword, tokensMap, visible]);

  const tokenWithOwner = useMemo(() => {
    if (type === 'swapTo' && keyword) {
      return (
        swapToTokenSearchResult?.map(token =>
          tagTokenItem(
            {
              ...token,

              _tokenId: token.id,
            },
            userTokenSettings,
          ),
        ) || []
      );
    }
    const tokenItems = tokens.map(token => {
      return {
        ...token,
        ownerAccount:
          currentAccount &&
          isSameAddress(currentAccount.address, token.owner_addr)
            ? currentAccount
            : accounts.find(acc =>
                isSameAddress(acc.address, token.owner_addr),
              ),
      };
    });
    return tokenItems.map(token => {
      const data = tokenItem2AbstractTokenWithOwner(token, token.ownerAccount);
      return tagTokenItem(data, userTokenSettings);
    });
  }, [
    accounts,
    currentAccount,
    keyword,
    swapToTokenSearchResult,
    tokens,
    type,
    userTokenSettings,
  ]);

  return {
    tokensMap,
    tokens: tokenWithOwner,
    isLoading: isLoading || swapToTokenSearchResultLoading,
    getCacheTop10Tokens,
    getCacheTokens,
    checkIsExpireAndUpdate,
    loadToken,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
