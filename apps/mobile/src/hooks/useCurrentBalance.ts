import { useCallback, useEffect } from 'react';
import { apiBalance } from '@/core/apis';
import { BalanceEntity } from '@/databases/entities/balance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { keyringService } from '@/core/services';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

export type BalanceState = {
  balance: number | null;
  evmBalance: number | null;
  testnetBalance: string | null;
};

type AddressBalanceState = {
  [address: string]: BalanceState | null;
};

type CurrentBalanceStore = {
  addressBalances: AddressBalanceState;
};

const currentBalanceStore = zCreate(
  zMutative<CurrentBalanceStore>(() => ({
    addressBalances: {},
  })),
);

export type AddressBalanceUpdaterSource =
  | 'Unknown'
  | 'SingleAddressHome'
  | 'TokenDetail'
  | 'DefiDetail'
  | 'LendingDetail';
function setAddrBalanceStore(
  address: string,
  valOrFunc: UpdaterOrPartials<AddressBalanceState[string]>,
  options: {
    force?: boolean;
    /** @description The source or scene from which the balance update is triggered */
    fromScene: AddressBalanceUpdaterSource;
  },
) {
  if (!address) return;

  currentBalanceStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.addressBalances[address] || null,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return;

    perfEvents.emit('TMP_UPDATED:SINGLE_HOME_BALANCE', {
      address,
      newBalance: newVal,
      prevBalance: prev[address],
      force: !!options.force,
      fromScene: options.fromScene,
    });

    prev.addressBalances[address] = newVal;
  });
}

const triggerUpdate = ({
  ...params
}: GetAddressBalanceOptions & { address: string }) => {
  getAddressBalance(params.address, {
    force: params.force,
    fromScene: params.fromScene,
  });
};

export const apisAddressBalance = {
  triggerUpdate,
  getBalanceState(address: string) {
    return currentBalanceStore.getState()?.addressBalances?.[address] || null;
  },
};

const addrLoadingBalanceState = zCreate<Record<string, boolean>>(() => ({}));

function setBalanceLoading(address: string, val: boolean) {
  if (address) {
    addrLoadingBalanceState.setState(prev => {
      return { ...prev, [address]: val };
    });
  }
}

type GetAddressBalanceOptions = {
  force?: boolean;
  fromScene: AddressBalanceUpdaterSource;
};
const getAddressBalance = makeSWRKeyAsyncFunc(
  async (address: string, options: GetAddressBalanceOptions) => {
    const { force } = options || {};
    try {
      // TODO: improve it, fetch addresses from cache first
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
      setBalanceLoading(address, true);

      const remotedGotRef = { current: false };
      await Promise.race([
        BalanceEntity.queryBalance(address, core).then(cachedBalance => {
          if (remotedGotRef.current) return;
          if (cachedBalance) {
            setAddrBalanceStore(
              address,
              {
                balance: cachedBalance.total_usd_value,
                evmBalance: cachedBalance.evm_usd_value || 0,
              },
              {
                force: !!force,
                fromScene: options?.fromScene,
              },
            );
          }
        }),
        apiBalance
          .getAddressBalance(address, { force })
          .then(async remoteBalance => {
            const {
              total_usd_value: totalUsdValue,
              chain_list: chainList,
              evm_usd_value: evmUsdValue,
            } = remoteBalance;

            remotedGotRef.current = true;
            setAddrBalanceStore(
              address,
              {
                balance: totalUsdValue,
                evmBalance: evmUsdValue || 0,
              },
              {
                force: !!force,
                fromScene: options?.fromScene,
              },
            );
            setBalanceLoading(address, false);
          }),
      ]);
    } catch (e) {
      setBalanceLoading(address, false);
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
    const fromScene = ctx.args[1]?.fromScene || 'Unknown';
    return `getAddressBalance-${addr}-force:${
      force ? '1' : '0'
    }-fromScene:${fromScene}`;
  },
);

export function useIsLoadingBalance(address?: string) {
  const balanceLoading = addrLoadingBalanceState(s =>
    address ? s[address] || false : false,
  );

  return { balanceLoading };
}

export function useAddressBalance(address?: string) {
  const balance = currentBalanceStore(s =>
    address ? s.addressBalances[address]?.balance ?? null : null,
  );
  const evmBalance = currentBalanceStore(s =>
    address ? s.addressBalances[address]?.evmBalance ?? null : null,
  );

  return { balance, evmBalance };
}

export default function useCurrentBalance(options: {
  address?: string;
  AUTO_FETCH?: boolean;
  fromScene: AddressBalanceUpdaterSource;
}) {
  const { address, fromScene } = options;
  const balanceLoadingState = useIsLoadingBalance(address);
  const { balance } = useAddressBalance(address);

  const fetchBalance = useCallback(
    async (params: Omit<GetAddressBalanceOptions, 'address' | 'fromScene'>) => {
      if (!address) return;
      return getAddressBalance(address, { force: params.force, fromScene });
    },
    [address, fromScene],
  );

  useEffect(() => {
    if (!address) return;

    if (options?.AUTO_FETCH) {
      fetchBalance({ force: true });
    }
  }, [address, options?.AUTO_FETCH, fetchBalance]);

  return {
    ...balanceLoadingState,
    balance,
    fetchBalance,
  };
}
