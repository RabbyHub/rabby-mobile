import { useSafeState } from '@/hooks/useSafeState';
import { useMyAccounts } from '@/hooks/account';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isAddress } from 'viem';
import BigNumber from 'bignumber.js';
import { formatUsdValue } from '@/utils/number';
import { formatAmount } from '@/utils/math';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';

type LocalDBTokenItem = TokenItem & {
  _db_id?: TokenItemEntity['_db_id'];
  owner_addr: TokenItemEntity['owner_addr'];
};
export const useTokenAssetsMap = () => {
  const [tokensMap, setTokensMap] = useState<{
    [address: string]: LocalDBTokenItem[];
  }>({});
  // ref tag if address has tokens
  const addressHasTokensRef = useRef<{
    [address: string]: boolean;
  }>({});

  const updateTokens = useCallback(
    ({
      address,
      newTokens,
    }: {
      address: string;
      newTokens: LocalDBTokenItem[];
    }) => {
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
  useEffect(() => {
    Object.keys(tokensMap).forEach(address => {
      addressHasTokensRef.current[address] = !!tokensMap[address]?.length;
    });
  }, [tokensMap]);
  return { tokensMap, setTokensMap, updateTokens, addressHasTokensRef };
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
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const { tokensMap, setTokensMap, updateTokens, addressHasTokensRef } =
    useTokenAssetsMap();
  const [userTokenSettings, setUserTokenSettings] = useState({});
  const currentAddress = currentAccount?.address;
  const { top10Addresses, fetchAccounts } = useAccountInfo();

  const enableSearchTokensV2 = useMemo(
    () =>
      keyword &&
      type &&
      (['swapFrom', 'swapTo', 'bridgeFrom'] as TokenSelectType[]).some(
        e => e === type,
      ),
    [keyword, type],
  );
  const {
    value: swapToTokenSearchResult,
    loading: swapToTokenSearchResultLoading,
  } = useAsync(async () => {
    if (enableSearchTokensV2 && keyword) {
      const list = await openapi.searchTokensV2({
        q: keyword,
      });

      const filterAddresses = currentAddress
        ? [currentAddress]
        : top10Addresses;

      const tokenList = list.map(token => ({
        chain: token.chain,
        tokenId: token.id,
      }));

      let localAmounts: Array<{
        chain: string;
        tokenId: string;
        amount: number;
      }> = [];
      if (filterAddresses.length > 0 && tokenList.length > 0) {
        try {
          localAmounts = await TokenItemEntity.getTokenListAmount({
            owner_addr: filterAddresses,
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

      return list
        .filter(e => (chain_server_id ? e.chain === chain_server_id : true))
        .filter(e =>
          isAddress(keyword, { strict: false }) ? true : !!e.is_core,
        )
        .map(e => {
          const key = `${e.chain}-${e.id}`;
          const localAmount = amountMap.get(key) || 0;

          const amountBn = new BigNumber(localAmount);
          const priceBn = new BigNumber(e.price || 0);
          const usdValue = amountBn.times(priceBn).toNumber();

          return {
            ...e,
            _isPined: false,
            _isFold: false,
            _isExcludeBalance: false,
            _usdValueStr: usdValue ? formatUsdValue(usdValue) : '$0',
            _amountStr: localAmount ? formatAmount(localAmount) : '0',
            _tokenId: e.id,
          } as any as AbstractPortfolioToken;
        });
    }
    return [];
  }, [enableSearchTokensV2, keyword, chain_server_id, currentAccount?.address]);

  useEffect(() => {
    if (visible && Object.keys(userTokenSettings).length === 0) {
      preferenceService
        .getUserTokenSettings()
        .then(res => res || {})
        .then(setUserTokenSettings);
    }
  }, [userTokenSettings, visible]);

  const loadToken = useCallback(
    async (_address: string, force?: boolean) => {
      const address = _address.toLowerCase();
      if (!address) {
        return;
      }
      try {
        const tokensExisted = addressHasTokensRef.current[address];
        if (!tokensExisted) {
          setLoading(true);
        }
        // if token exist and not expired, don't sync to store
        const tokenRes = await syncTokens(address, force, tokensExisted);
        if (!tokenRes.length) {
          setLoading(false);
          return;
        }
        updateTokens({
          address,
          newTokens: tokenRes || [],
        });
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [addressHasTokensRef, setLoading, updateTokens],
  );

  const batchLoadCacheTokens = useCallback(
    async (_addresses: string[]) => {
      if (!_addresses.length) {
        return;
      }
      const addresses = _addresses.map(i => i.toLowerCase());
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
      try {
        for (const address of top10Addresses) {
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
    [loadToken, top10Addresses],
  );

  const getCacheTop10Tokens = useCallback(async () => {
    const emptyTokenAddresses = top10Addresses.filter(
      addr => !tokensMap[addr]?.length,
    );
    await batchLoadCacheTokens(emptyTokenAddresses);
  }, [batchLoadCacheTokens, tokensMap, top10Addresses]);

  const getCacheTokens = useCallback(
    (addrresses: string[]) => {
      return batchLoadCacheTokens(addrresses);
    },
    [batchLoadCacheTokens],
  );

  // filter tokens
  const tokens = useMemo(() => {
    let resTokens: LocalDBTokenItem[] = [];
    if (!visible) {
      return [];
    }
    if (currentAddress) {
      resTokens = tokensMap[currentAddress?.toLowerCase()] || [];
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
            i?.toLowerCase().includes(keyword.toLowerCase()),
          );
        })
        .sort((a, b) => {
          const keywordLower = keyword.toLowerCase();
          const aIdLower = a.id?.toLowerCase() || '';
          const bIdLower = b.id?.toLowerCase() || '';
          const aSymbolLower = a.symbol?.toLowerCase() || '';
          const bSymbolLower = b.symbol?.toLowerCase() || '';

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
            if (exactMatch && isCore) {
              return 4;
            }
            if (exactMatch && !isCore) {
              return 3;
            }
            if (!exactMatch && isCore) {
              return 2;
            }
            return 1;
          };

          const aScore = getScore(aExactMatch, aIsCore);
          const bScore = getScore(bExactMatch, bIsCore);

          // Compare scores
          if (aScore !== bScore) {
            return bScore - aScore; // Higher score comes first
          }

          // If scores are equal, use is_suspicious as tiebreaker
          if (a.is_suspicious !== b.is_suspicious) {
            return a.is_suspicious ? 1 : -1;
          }

          // If still equal, prioritize id matches over symbol matches
          const aIdMatch = aIdLower.includes(keywordLower);
          const bIdMatch = bIdLower.includes(keywordLower);
          const aSymbolMatch = aSymbolLower.includes(keywordLower);
          const bSymbolMatch = bSymbolLower.includes(keywordLower);

          if (aIdMatch && !bIdMatch) {
            return -1;
          }
          if (!aIdMatch && bIdMatch) {
            return 1;
          }
          if (aSymbolMatch && !bSymbolMatch) {
            return -1;
          }
          if (!aSymbolMatch && bSymbolMatch) {
            return 1;
          }

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
    if (enableSearchTokensV2 && keyword) {
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
    enableSearchTokensV2,
    keyword,
    swapToTokenSearchResult,
    tokens,
    userTokenSettings,
  ]);

  useEffect(() => {
    if (visible) {
      fetchAccounts();
    }
  }, [visible, fetchAccounts]);

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
