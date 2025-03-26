import { useSafeState } from '@/hooks/useSafeState';
import { useMyAccounts } from '@/hooks/account';
import { useCallback, useMemo, useState } from 'react';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _ from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

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
}: {
  currentAddress?: string;
  visible?: boolean;
}) => {
  const [isLoading, setLoading] = useSafeState(false);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const { tokensMap, setTokensMap, updateTokens } = useTokenAssetsMap();
  const [userTokenSettings, setUserTokenSettings] = useState({});

  const loadToken = async (address: string, force?: boolean) => {
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
  };

  const batchLoadCacheTokens = async (addresses: string[]) => {
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
  };

  const checkIsExpireAndUpdate = async (force?: boolean) => {
    const top10Account = sortedAccounts.slice(0, 10).filter(acc => acc.balance);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    try {
      for (const address of addresses) {
        try {
          await loadToken(address, force);
        } catch (error) {
          console.error(`Error fetching data for ${address.slice(-4)}:`, error);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      setIsFirstFetch(false);
    }
  };

  const getCacheTop10Tokens = async () => {
    const top10Account = sortedAccounts.slice(0, 10).filter(acc => acc.balance);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    const emptyTokenAddresses = addresses.filter(
      addr => !tokensMap[addr]?.length,
    );
    await batchLoadCacheTokens(emptyTokenAddresses);
  };

  const tokens = useMemo(() => {
    if (currentAddress) {
      return tokensMap[currentAddress?.toLocaleLowerCase()] || [];
    } else {
      return Object.values(tokensMap).flat();
    }
  }, [currentAddress, tokensMap]);

  return {
    tokensMap,
    tokens,
    isLoading,
    getCacheTop10Tokens,
    checkIsExpireAndUpdate,
    loadToken,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
