import { useCallback, useEffect } from 'react';
import { perfEvents } from '@/core/utils/perf';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import addressBalanceStore, { IBalanceData } from '@/store/balance';

export type BalanceState = {
  balance: number | null;
  evmBalance: number | null;
  testnetBalance: string | null;
};

export type AddressBalanceUpdaterSource =
  | 'Unknown'
  | 'SingleAddressHome'
  | 'TokenDetail'
  | 'DefiDetail'
  | 'LendingDetail';

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
    return mapBalanceState(addressBalanceStore.getAddressValue(address));
  },
};

type GetAddressBalanceOptions = {
  force?: boolean;
  fromScene: AddressBalanceUpdaterSource;
};
const getAddressBalance = makeSWRKeyAsyncFunc(
  async (address: string, options: GetAddressBalanceOptions) => {
    const { force } = options || {};
    try {
      const lowerAddress = address.toLowerCase();
      const prevBalanceState = mapBalanceState(
        addressBalanceStore.getAddressValue(lowerAddress),
      );
      await addressBalanceStore.getTotalBalance(address, force, {
        scene: options.fromScene,
        requester: 'useCurrentBalance.getAddressBalance',
        endpoint: 'openapi.getTotalBalanceV2',
      });
      const nextBalanceState = mapBalanceState(
        addressBalanceStore.getAddressValue(lowerAddress),
      );

      if (!isBalanceStateEqual(prevBalanceState, nextBalanceState)) {
        perfEvents.emit('TMP_UPDATED:SINGLE_HOME_BALANCE', {
          address,
          newBalance: nextBalanceState,
          prevBalance: prevBalanceState,
          force: !!force,
          fromScene: options.fromScene,
        });
      }
    } catch (e) {
      try {
        const { error_code } = JSON.parse((e as Error).message);
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
  const { isLoadingWithoutValue } =
    addressBalanceStore.useAddressFlowState(address);
  const balanceLoading = isLoadingWithoutValue;

  return { balanceLoading };
}

export function useAddressBalance(address?: string) {
  const balanceData = addressBalanceStore.useAddressValue(address);
  const balance = balanceData?.totalBalance ?? null;
  const evmBalance = balanceData?.evmBalance ?? null;

  return { balance, evmBalance };
}

function mapBalanceState(
  balanceData?: IBalanceData | null,
): BalanceState | null {
  if (!balanceData) return null;
  return {
    balance: balanceData.totalBalance,
    evmBalance: balanceData.evmBalance,
    testnetBalance: null,
  };
}

function isBalanceStateEqual(
  prevBalance: BalanceState | null,
  nextBalance: BalanceState | null,
) {
  if (!prevBalance && !nextBalance) return true;
  if (!prevBalance || !nextBalance) return false;
  return (
    prevBalance.balance === nextBalance.balance &&
    prevBalance.evmBalance === nextBalance.evmBalance
  );
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
