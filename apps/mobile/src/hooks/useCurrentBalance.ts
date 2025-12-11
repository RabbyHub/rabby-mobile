import { useCallback, useEffect, useState } from 'react';
import {
  DisplayChainWithWhiteLogo,
  findChainByServerID,
  formatChain,
} from '@/utils/chain';
import { apiBalance } from '@/core/apis';
import { BalanceEntity } from '@/databases/entities/balance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { keyringService } from '@/core/services';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useMemoizedFn } from 'ahooks';

type BalanceState = {
  balance: number | null;
  evmBalance: number | null;
  testnetBalance: string | null;
};

type CurrentBalanceState = Record<string, BalanceState>;

const currentBalanceStore = zCreate<CurrentBalanceState>(() => ({}));

function setAddrBalanceStore(
  address: string,
  valOrFunc: UpdaterOrPartials<CurrentBalanceState[string]>,
) {
  if (!address) return;
  currentBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev[address],
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;

    return { ...prev, [address]: newVal };
  });
}

type TriggerHomeBalanceState = {
  balanceUpdateNonce: number;
  forceUpdate: boolean;
};

const triggerHomeBalanceStore = zCreate<TriggerHomeBalanceState>(() => ({
  balanceUpdateNonce: 0,
  forceUpdate: false,
}));

function setNonce(
  valOrFunc: UpdaterOrPartials<TriggerHomeBalanceState['balanceUpdateNonce']>,
) {
  triggerHomeBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.balanceUpdateNonce,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;
    return { ...prev, balanceNonce: newVal };
  });
}

function setForceUpdate(
  valOrFunc: UpdaterOrPartials<TriggerHomeBalanceState['forceUpdate']>,
) {
  triggerHomeBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.forceUpdate,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;
    return { ...prev, forceUpdate: newVal };
  });
}

export const useTriggerHomeBalanceUpdate = () => {
  /**
   * @description in the future, only nonce >= 0, the fetching will be triggered
   */
  const balanceNonce = triggerHomeBalanceStore(s => s.balanceUpdateNonce);

  const triggerUpdate = useCallback(() => {
    setNonce(n => n + 1);
    setForceUpdate(true);
  }, []);

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

  const balance = currentBalanceStore(s =>
    account ? s[account]?.balance : null,
  );
  const evmBalance = currentBalanceStore(s =>
    account ? s[account]?.evmBalance : null,
  );
  // const testnetBalance = currentBalanceStore(s => account ? s[account]?.testnetBalance : null);

  const forceUpdate = triggerHomeBalanceStore(s => s.forceUpdate);

  // const [success, setSuccess] = useState(true);
  const { balanceNonce } = useTriggerHomeBalanceUpdate();

  const [balanceLoading, setBalanceLoading] = useState(true);
  // const [balanceUpdating, setBalanceUpdating] = useState(false);
  // const [balanceFromCache, setBalanceFromCache] = useState(false);
  let isCanceled = false;
  // const [chainBalances, setChainBalances] = useState<
  //   DisplayChainWithWhiteLogo[]
  // >([]);
  // const [hasValueChainBalances, setHasValueChainBalances] = useState<
  //   DisplayChainWithWhiteLogo[]
  // >([]);
  // const [testnetSuccess, setTestnetSuccess] = useState(true);
  // const [testnetBalanceLoading, setTestnetBalanceLoading] = useState(false);
  // const [testnetBalanceFromCache, setTestnetBalanceFromCache] = useState(false);
  // const [testnetChainBalances, setTestnetChainBalances] = useState<
  //   DisplayChainWithWhiteLogo[]
  // >([]);
  // const [missingList, setMissingList] = useState<string[]>();

  const getAddressBalance = useMemoizedFn(
    async (address: string, options?: { force?: boolean }) => {
      const { force } = options || {};
      try {
        const addresses = await keyringService.getAllAddresses();
        const filtered = addresses.filter(item =>
          isSameAddress(item.address, address),
        );
        let core = false;
        if (
          filtered.some(item => CORE_KEYRING_TYPES.includes(item.type as any))
        ) {
          core = true;
        }
        const cachedBalance = await BalanceEntity.queryBalance(address, core);
        if (cachedBalance) {
          setAddrBalanceStore(account || '', {
            balance: cachedBalance.total_usd_value,
            evmBalance: cachedBalance.evm_usd_value || 0,
          });
          // setSuccess(true);
          // setBalanceLoading(false);
          // setBalanceFromCache(false);
          // setBalanceUpdating(false);
        }
        const {
          total_usd_value: totalUsdValue,
          chain_list: chainList,
          evm_usd_value: evmUsdValue,
        } = await apiBalance.getAddressBalance(address, { force });
        if (isCanceled) {
          return;
        }
        setAddrBalanceStore(account || '', {
          balance: totalUsdValue,
          evmBalance: evmUsdValue || 0,
        });
        // setSuccess(true);
        // setChainBalances(
        //   chainList.filter(i => i.usd_value > 0).map(formatChain),
        // );
        // setHasValueChainBalances(chainList.filter(item => item.usd_value > 0));
        // setBalanceLoading(false);
        // setBalanceFromCache(false);
        // setBalanceUpdating(false);
      } catch (e) {
        setBalanceLoading(false);
        try {
          const { error_code, err_chain_ids } = JSON.parse(
            (e as Error).message,
          );
          if (error_code === 2) {
            const chainNames = err_chain_ids.map((serverId: string) => {
              const chain = findChainByServerID(serverId);
              return chain?.name;
            });
            // setMissingList(chainNames);
            // setSuccess(true);
            return;
          }
        } catch (error) {
          console.error(error);
        }
        // setSuccess(false);
      }
    },
  );

  const getTestnetBalance = useMemoizedFn(
    async (address: string, options?: { force?: boolean }) => {
      const { force } = options || {};
      try {
        const { total_usd_value: totalUsdValue, chain_list: chainList } =
          await apiBalance.getAddressBalance(address, { force });
        if (isCanceled) {
          return;
        }
        setAddrBalanceStore(account || '', {
          testnetBalance: totalUsdValue.toString(),
        });
        // setTestnetSuccess(true);
        // setTestnetChainBalances(
        //   chainList.filter(i => i.usd_value > 0).map(formatChain),
        // );
        // setTestnetBalanceLoading(false);
        // setTestnetBalanceFromCache(false);
      } catch (e) {
        // setTestnetSuccess(false);
        // setTestnetBalanceLoading(false);
      }
    },
  );

  const getCurrentBalance = useMemoizedFn(async (force = false) => {
    if (!account || noNeedBalance) {
      return;
    }
    setBalanceLoading(true);
    const cacheData = await apiBalance.getAddressCacheBalance(account);
    if (cacheData) {
      // setBalanceFromCache(true);
      setAddrBalanceStore(account || '', {
        balance: cacheData.total_usd_value,
        evmBalance: cacheData.evm_usd_value || 0,
      });
      const chanList = cacheData.chain_list
        .filter(item => item.born_at !== null)
        .map(formatChain);
      // setHasValueChainBalances(chanList.filter(item => item.usd_value > 0));
      if (update) {
        setBalanceLoading(true);
        await getAddressBalance(account.toLowerCase(), { force });
        if (includeTestnet) {
          await getTestnetBalance(account.toLowerCase(), { force });
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
      // setBalanceFromCache(false);
    }
  });

  // useEffect(() => {
  //   if (balanceNonce > 0) {
  //     setBalanceUpdating(true);
  //   }
  // }, [balanceNonce]);

  useEffect(() => {
    getCurrentBalance(forceUpdate);
    setForceUpdate(false);
    // if (!noNeedBalance && account) {
    //   apiBalance.getAddressCacheBalance(account).then(cache => {
    //     setChainBalances(
    //       cache
    //         ? cache.chain_list
    //             .filter(item => item.usd_value > 0)
    //             .map(formatChain)
    //         : [],
    //     );
    //   });
    // }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      isCanceled = true;
    };
  }, [account?.toLowerCase(), balanceNonce]);

  return {
    balance,
    evmBalance,
    // chainBalances,
    // getAddressBalance,
    // success,
    balanceLoading,
    // balanceFromCache,
    // testnetBalance,
    // testnetSuccess,
    // testnetBalanceLoading,
    // testnetBalanceFromCache,
    // testnetChainBalances,
    // balanceUpdating,
    // missingList,
    // hasValueChainBalances,
  };
}
