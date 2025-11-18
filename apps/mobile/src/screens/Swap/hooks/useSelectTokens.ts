import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import _, { add } from 'lodash';
import { isAddress } from 'viem';
import BigNumber from 'bignumber.js';
import * as Sentry from '@sentry/react-native';
import useAsync from 'react-use/lib/useAsync';
import { atom, useAtom } from 'jotai';

import { useMyAccounts } from '@/hooks/account';
import { syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { tokenItem2AbstractTokenWithOwner } from '@/utils/token';
import { tagTokenItem } from '@/screens/Home/utils/token';
import { preferenceService } from '@/core/services';
import { TokenSelectType } from '@/components/Token/TokenSelectorSheetModal';
import { openapi } from '@/core/request';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { Account } from '@/core/services/preference';
import { formatUsdValue } from '@/utils/number';
import { formatAmount } from '@/utils/math';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import useDebounceValue from '@/hooks/common/useDebounceValue';

import {
  getAddressIndexedTokens,
  LocalDBTokenItem,
  useSelectTokensThreadSafe,
} from '@/components/Token/hooks/selectToken';

export const useSelectTokens = ({
  currentAccount: _currentAccount,
  noNeedTokens = false,
  keyword,
  chain_server_id,
  type,
}: {
  currentAccount?: Account | null;
  noNeedTokens?: boolean;
  keyword?: string;
  chain_server_id?: string;
  type?: TokenSelectType;
}) => {
  const currentAccount = useDebounceValue(_currentAccount, 100);
  const currentAddress = currentAccount?.address || _currentAccount?.address;
  const { top10Addresses } = useAccountInfo();

  const { accounts } = useMyAccounts({ disableAutoFetch: true });

  const [isFirstFetch, setIsFirstFetch] = useState(true);

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
        chain_id: chain_server_id || '',
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
  }, [
    enableSearchTokensV2,
    currentAddress,
    top10Addresses,
    keyword,
    chain_server_id,
  ]);

  const {
    isLoadingToken,
    userTokenSettings,
    getCacheTokens,
    checkIsExpireAndUpdate: _checkIsExpireAndUpdate,
    loadToken,
    fetchAccountsAndTokenSettings,
  } = useSelectTokensThreadSafe();

  const tokensMap = getAddressIndexedTokens();
  const tokensInMemory = useMemo(() => {
    let resTokens: LocalDBTokenItem[] = [];
    if (currentAddress) {
      resTokens = tokensMap[currentAddress?.toLowerCase()] || [];
    } else {
      resTokens = Object.values(tokensMap).flat();
    }
    return resTokens;
  }, [tokensMap, currentAddress]);

  // filter tokens
  const tokens = useMemo(() => {
    if (noNeedTokens) return [];
    let resTokens: LocalDBTokenItem[] = Array.from(tokensInMemory);
    if (chain_server_id) {
      resTokens = tokensInMemory.filter(
        token => token.chain === chain_server_id,
      );
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
  }, [noNeedTokens, tokensInMemory, chain_server_id, keyword]);

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

  const checkIsExpireAndUpdate = useCallback(async () => {
    return _checkIsExpireAndUpdate().finally(() => {
      setIsFirstFetch(false);
    });
  }, [_checkIsExpireAndUpdate]);

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
    existedTokens: !!tokensInMemory.length,
    isLoading: isLoadingToken || swapToTokenSearchResultLoading,
    getCacheTokens,
    checkIsExpireAndUpdate,
    loadToken,
    refreshing: !!isLoadingToken && !isFirstFetch,
    loadOnVisibleChanged,
  };
};
