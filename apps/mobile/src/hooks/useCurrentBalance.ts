import { useCallback, useEffect, useState } from 'react';
import { atom, useAtom } from 'jotai';
import {
  DisplayChainWithWhiteLogo,
  findChainByServerID,
  formatChain,
} from '@/utils/chain';
import { apiBalance } from '@/core/apis';

const balanceAtom = atom<number | null>(null);
const testnetBalanceAtom = atom<string | null>(null);
const balanceUpdateNonceAtom = atom<number>(0);

export const useTriggerHomeBalanceUpdate = () => {
  /**
   * @description in the future, only nonce >= 0, the fetching will be triggered
   */
  const [balanceNonce, setNonce] = useAtom(balanceUpdateNonceAtom);

  const triggerUpdate = useCallback(() => {
    setNonce(n => n + 1);
  }, [setNonce]);

  return { balanceNonce, triggerUpdate };
};

export default function useCurrentBalance(
  account: string | undefined,
  opts?: {
    noNeedBalance?: boolean;
    update?: boolean;
    includeTestnet?: boolean;
  },
) {
  const {
    update = false,
    noNeedBalance = false,
    includeTestnet = false,
  } = opts || {};

  const [balance, setBalance] = useAtom(balanceAtom);
  const [success, setSuccess] = useState(true);
  const { balanceNonce } = useTriggerHomeBalanceUpdate();
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceUpdating, setBalanceUpdating] = useState(false);
  const [balanceFromCache, setBalanceFromCache] = useState(false);
  let isCanceled = false;
  const [chainBalances, setChainBalances] = useState<
    DisplayChainWithWhiteLogo[]
  >([]);
  const [hasValueChainBalances, setHasValueChainBalances] = useState<
    DisplayChainWithWhiteLogo[]
  >([]);
  const [testnetBalance, setTestnetBalance] = useAtom(testnetBalanceAtom);
  const [testnetSuccess, setTestnetSuccess] = useState(true);
  const [testnetBalanceLoading, setTestnetBalanceLoading] = useState(false);
  const [testnetBalanceFromCache, setTestnetBalanceFromCache] = useState(false);
  const [testnetChainBalances, setTestnetChainBalances] = useState<
    DisplayChainWithWhiteLogo[]
  >([]);
  const [missingList, setMissingList] = useState<string[]>();

  const getAddressBalance = async (
    address: string,
    options?: { force?: boolean },
  ) => {
    const { force } = options || {};
    try {
      const { total_usd_value: totalUsdValue, chain_list: chainList } =
        await apiBalance.getAddressBalance(address, { force });
      if (isCanceled) {
        return;
      }
      setBalance(totalUsdValue);
      setSuccess(true);
      setChainBalances(chainList.filter(i => i.usd_value > 0).map(formatChain));
      setHasValueChainBalances(chainList.filter(item => item.usd_value > 0));
      setBalanceLoading(false);
      setBalanceFromCache(false);
      setBalanceUpdating(false);
    } catch (e) {
      setBalanceLoading(false);
      try {
        const { error_code, err_chain_ids } = JSON.parse((e as Error).message);
        if (error_code === 2) {
          const chainNames = err_chain_ids.map((serverId: string) => {
            const chain = findChainByServerID(serverId);
            return chain?.name;
          });
          setMissingList(chainNames);
          setSuccess(true);
          return;
        }
      } catch (error) {
        console.error(error);
      }
      setSuccess(false);
    }
  };

  const getTestnetBalance = async (
    address: string,
    options?: { force?: boolean },
  ) => {
    const { force } = options || {};
    try {
      const { total_usd_value: totalUsdValue, chain_list: chainList } =
        await apiBalance.getAddressBalance(address, { force });
      if (isCanceled) {
        return;
      }
      setTestnetBalance(totalUsdValue.toString());
      setTestnetSuccess(true);
      setTestnetChainBalances(
        chainList.filter(i => i.usd_value > 0).map(formatChain),
      );
      setTestnetBalanceLoading(false);
      setTestnetBalanceFromCache(false);
    } catch (e) {
      setTestnetSuccess(false);
      setTestnetBalanceLoading(false);
    }
  };

  const getCurrentBalance = async (force = false) => {
    if (!account || noNeedBalance) {
      return;
    }
    setBalanceLoading(true);
    const cacheData = await apiBalance.getAddressCacheBalance(account);
    if (cacheData) {
      setBalanceFromCache(true);
      setBalance(cacheData.total_usd_value);
      const chanList = cacheData.chain_list
        .filter(item => item.born_at !== null)
        .map(formatChain);
      setHasValueChainBalances(chanList.filter(item => item.usd_value > 0));
      if (update) {
        setBalanceLoading(true);
        getAddressBalance(account.toLowerCase(), { force });
        if (includeTestnet) {
          getTestnetBalance(account.toLowerCase(), { force });
        }
      } else {
        setBalanceLoading(false);
      }
    } else {
      await getAddressBalance(account.toLowerCase(), { force });
      if (includeTestnet) {
        await getTestnetBalance(account.toLowerCase(), { force });
      }
      setBalanceLoading(false);
      setBalanceFromCache(false);
    }
  };

  useEffect(() => {
    if (balanceNonce > 0) {
      setBalanceUpdating(true);
    }
  }, [balanceNonce]);

  useEffect(() => {
    getCurrentBalance();
    if (!noNeedBalance && account) {
      apiBalance.getAddressCacheBalance(account).then(cache => {
        setChainBalances(
          cache
            ? cache.chain_list
                .filter(item => item.usd_value > 0)
                .map(formatChain)
            : [],
        );
      });
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      isCanceled = true;
    };
  }, [account, balanceNonce]);
  return {
    balance,
    chainBalances,
    getAddressBalance,
    success,
    balanceLoading,
    balanceFromCache,
    testnetBalance,
    testnetSuccess,
    testnetBalanceLoading,
    testnetBalanceFromCache,
    testnetChainBalances,
    balanceUpdating,
    missingList,
    hasValueChainBalances,
  };
}
