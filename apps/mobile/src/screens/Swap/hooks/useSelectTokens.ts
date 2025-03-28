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
  currentAddress,
  visible,
  keyword,
  chain_server_id,
}: {
  currentAddress?: string;
  visible?: boolean;
  keyword?: string;
  chain_server_id?: string;
}) => {
  const [isLoading, setLoading] = useSafeState(false);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const { tokensMap, setTokensMap, updateTokens } = useTokenAssetsMap();
  const [userTokenSettings, setUserTokenSettings] = useState({});

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
      console.log(
        'CUSTOM_LOGGER:=>: batchLoadCacheTokens',
        addresses.map(addr => addr.slice(-4)),
      );
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
      setLoading(false);
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

    if (keyword) {
      resTokens = resTokens.filter(item => {
        const allMatchKeyWords = [item.chain, item.id];
        const partMatchKeyWords = [
          item.name,
          item.symbol,
          item.optimized_symbol,
          item.display_symbol,
        ];
        const allMatch = allMatchKeyWords.some(
          i => i?.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
        );
        const partMatch = partMatchKeyWords.some(i =>
          i?.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
        );
        return allMatch || partMatch;
      });
    }
    if (chain_server_id) {
      resTokens = resTokens.filter(token => token.chain === chain_server_id);
    }
    // TODO: need to check may use useSortToken
    resTokens = resTokens.sort((a, b) => {
      const aUsdValue = a.usd_value || a.price * a.amount;
      const bUsdValue = b.usd_value || b.price * b.amount;

      return bUsdValue - aUsdValue;
    });
    return resTokens;
  }, [chain_server_id, currentAddress, keyword, tokensMap, visible]);

  const tokenWithOwner = useMemo(() => {
    const tokenItems = tokens.map(token => {
      return {
        ...token,
        ownerAccount: accounts.find(acc =>
          isSameAddress(acc.address, token.owner_addr),
        ),
      };
    });
    return tokenItems.map(token => {
      const data = tokenItem2AbstractTokenWithOwner(token, token.ownerAccount);
      return tagTokenItem(data, userTokenSettings);
    });
  }, [accounts, tokens, userTokenSettings]);

  return {
    tokensMap,
    tokens: tokenWithOwner,
    isLoading,
    getCacheTop10Tokens,
    checkIsExpireAndUpdate,
    loadToken,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
