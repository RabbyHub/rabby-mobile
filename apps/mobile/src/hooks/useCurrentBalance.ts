import { useCallback, useEffect, useRef, useState } from 'react';
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
import { perfEvents } from '@/core/utils/perf';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

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
  forceUpdate: boolean;
};

const triggerHomeBalanceStore = zCreate<TriggerHomeBalanceState>(() => ({
  forceUpdate: false,
}));

const triggerUpdate = (force?: boolean) => {
  perfEvents.emit('TRIGGER_SINGLE_HOME_BALANCE', force);
};

export const useTriggerHomeBalanceUpdate = () => {
  return { triggerUpdate };
};

const addrLoadingBalanceState = zCreate<Record<string, boolean>>(() => ({}));

function setBalanceLoading(val: boolean, address?: string) {
  if (address) {
    addrLoadingBalanceState.setState(prev => {
      return { ...prev, [address]: val };
    });
  }
}

const getAddressBalance = makeSWRKeyAsyncFunc(
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
        setAddrBalanceStore(address || '', {
          balance: cachedBalance.total_usd_value,
          evmBalance: cachedBalance.evm_usd_value || 0,
        });
        setBalanceLoading(false);
      }
      const {
        total_usd_value: totalUsdValue,
        chain_list: chainList,
        evm_usd_value: evmUsdValue,
      } = await apiBalance.getAddressBalance(address, { force });

      setAddrBalanceStore(address || '', {
        balance: totalUsdValue,
        evmBalance: evmUsdValue || 0,
      });
      setBalanceLoading(false);
    } catch (e) {
      setBalanceLoading(false);
      try {
        const { error_code, err_chain_ids } = JSON.parse((e as Error).message);
        if (error_code === 2) {
          // const missingChains = err_chain_ids.map((serverId: string) => {
          //   const chain = findChainByServerID(serverId);
          //   return chain?.name;
          // });
          return;
        }
      } catch (error) {
        console.error(error);
      }
    }
  },
  ctx => {
    const addr = ctx.args[0];
    const force = ctx.args[1]?.force;
    return `getAddressBalance-${addr}-force:${force ? '1' : '0'}`;
  },
);

export default function useCurrentBalance(
  account: string | undefined,
  opts?: {
    noNeedBalance?: boolean;
    update?: boolean;
    // includeTestnet?: boolean;
  },
) {
  const {
    update = false,
    noNeedBalance = false,
    // includeTestnet = false,
  } = opts || {};

  const balance = currentBalanceStore(s =>
    account ? s[account]?.balance : null,
  );
  const evmBalance = currentBalanceStore(s =>
    account ? s[account]?.evmBalance : null,
  );

  // const getTestnetBalance = useMemoizedFn(
  //   async (address: string, options?: { force?: boolean }) => {
  //     const { force } = options || {};
  //     try {
  //       const { total_usd_value: totalUsdValue, chain_list: chainList } =
  //         await apiBalance.getAddressBalance(address, { force });
  //       setAddrBalanceStore(account || '', {
  //         testnetBalance: totalUsdValue.toString(),
  //       });
  //     } catch (e) {}
  //   },
  // );

  const getCurrentBalance = useCallback(
    async (force = false) => {
      if (!account || noNeedBalance) {
        return;
      }
      setBalanceLoading(true);
      const cacheData = await apiBalance.getAddressCacheBalance(account);
      if (cacheData) {
        setAddrBalanceStore(account || '', {
          balance: cacheData.total_usd_value,
          evmBalance: cacheData.evm_usd_value || 0,
        });
        // const chanList = cacheData.chain_list
        //   .filter(item => item.born_at !== null)
        //   .map(formatChain);
        // setHasValueChainBalances(chanList.filter(item => item.usd_value > 0));
        if (update) {
          setBalanceLoading(true);
          await getAddressBalance(account.toLowerCase(), { force });
          // if (includeTestnet) {
          //   await getTestnetBalance(account.toLowerCase(), { force });
          // }
        } else {
          setBalanceLoading(false);
        }
      } else {
        await getAddressBalance(account.toLowerCase(), { force });
        // if (includeTestnet) {
        //   await getTestnetBalance(account.toLowerCase(), { force });
        // }
        setBalanceLoading(false);
      }
    },
    [account, noNeedBalance, update],
  );

  const balanceLoading = addrLoadingBalanceState(s =>
    account ? s[account] || false : false,
  );

  useEffect(() => {
    getCurrentBalance();

    const { remove } = perfEvents.subscribe(
      'TRIGGER_SINGLE_HOME_BALANCE',
      async (force?: boolean) => {
        console.debug('[perf] TRIGGER_SINGLE_HOME_BALANCE triggered');
        getCurrentBalance(!!force);
      },
    );

    return () => {
      remove();
    };
  }, [getCurrentBalance]);

  // useEffect(() => {
  //   getCurrentBalance(forceUpdate);
  //   setForceUpdate(false);
  // }, [account?.toLowerCase(), balanceNonce]);

  return {
    balance,
    evmBalance,
    balanceLoading,
  };
}
