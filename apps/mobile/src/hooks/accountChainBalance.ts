import { useEffect, useMemo } from 'react';

import { preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { ChainWithBalance } from '@rabby-wallet/rabby-api/dist/types';
import {
  DisplayChainWithWhiteLogo,
  formatChainToDisplay,
  varyAndSortChainItems,
} from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { coerceFloat } from '@/utils/number';
import { zCreate } from '@/core/utils/reexports';
import balanceStore from '@/store/balance';

type MatteredChainBalances = {
  [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
};
const addrMatteredBalancesStore = zCreate<{
  currentAddress: string;
}>(() => ({
  currentAddress: '',
}));

export function setCurrentCaredAddress(
  address: string,
  options?: { forceFetch?: true },
) {
  const addr = address.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    return {
      ...prev,
      currentAddress: address.toLowerCase(),
    };
  });
  const currentAddress = addrMatteredBalancesStore.getState().currentAddress;
  const needFetch =
    options?.forceFetch || address.toLowerCase() !== currentAddress;

  if (needFetch) {
    fetchMatteredChainBalance({ address: addr });
  }
}

const DEFAULT_TESTNET_MATTERED_BALANCES: MatteredChainBalances = {};

function buildMatteredChainBalances(
  chainList: ChainWithBalance[] = [],
): MatteredChainBalances {
  if (!chainList.length) return {};
  const totalUsdValue = chainList.reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  if (totalUsdValue <= 0) return {};

  return chainList.reduce((accu, cur) => {
    const curUsdValue = coerceFloat(cur.usd_value);
    if (curUsdValue > 1 && curUsdValue / totalUsdValue > 0.01) {
      accu[cur.id] = formatChainToDisplay(cur);
    }
    return accu;
  }, {} as MatteredChainBalances);
}

function mergeChainListsById(
  chainUSDMap: Record<string, ChainWithBalance[]>,
): ChainWithBalance[] {
  const merged: Record<string, ChainWithBalance> = {};
  Object.values(chainUSDMap).forEach(list => {
    list?.forEach(chain => {
      const existing = merged[chain.id];
      if (existing) {
        existing.usd_value += chain.usd_value;
      } else {
        merged[chain.id] = { ...chain };
      }
    });
  });
  return Object.values(merged);
}

function getChainListByAddress(address?: string) {
  const addr =
    address?.toLowerCase() ||
    addrMatteredBalancesStore.getState().currentAddress;
  if (!addr) return [];
  return balanceStore.getState().chainUSDMap[addr] || [];
}

export function useChainBalances() {
  const currentAddress = addrMatteredBalancesStore(s => s.currentAddress);
  const chainList = balanceStore(s =>
    currentAddress ? s.chainUSDMap[currentAddress] : undefined,
  );
  const matteredChainBalances = useMemo(
    () => buildMatteredChainBalances(chainList || []),
    [chainList],
  );
  const testnetMatteredChainBalances = DEFAULT_TESTNET_MATTERED_BALANCES;

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
  };
}

const fetchAllAddressesChainBalance = async (): Promise<{
  matteredChainBalances: MatteredChainBalances;
}> => {
  const chainList = mergeChainListsById(balanceStore.getState().chainUSDMap);
  const matteredChainBalances = buildMatteredChainBalances(chainList);
  return {
    matteredChainBalances,
  };
};

const fetchMatteredChainBalance = async ({
  address,
}: {
  address?: string;
  // isTestnet?: boolean;
} = {}): Promise<{
  matteredChainBalances: MatteredChainBalances;
  testnetMatteredChainBalances: MatteredChainBalances;
}> => {
  const chainList = getChainListByAddress(address);
  const matteredChainBalances = buildMatteredChainBalances(chainList);
  const testnetMatteredChainBalances = DEFAULT_TESTNET_MATTERED_BALANCES;

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
  };
};

const fetchOrderedChainList = async (opts: {
  address?: string;
  supportChains?: CHAINS_ENUM[];
}) => {
  const { address, supportChains } = opts || {};
  const { pinned, matteredChainBalances } = await Promise.allSettled([
    preferenceService.getPreference('pinnedChain'),
    fetchMatteredChainBalance({ address }),
  ]).then(([pinnedChain, balance]) => {
    return {
      pinned: (pinnedChain.status === 'fulfilled'
        ? pinnedChain.value
        : []) as CHAINS_ENUM[],
      matteredChainBalances: (balance.status === 'fulfilled'
        ? // only SUPPORT mainnet now
          balance.value.matteredChainBalances
        : {}) as MatteredChainBalances,
    };
  });

  const { matteredList, unmatteredList } = varyAndSortChainItems({
    supportChains,
    pinned,
    matteredChainBalances,
  });

  return {
    matteredList,
    unmatteredList,
    firstChain: matteredList[0],
  };
};

export function useLoadMatteredChainBalances({
  account: currentAccount,
}: {
  account?: Account | null;
}) {
  const currentAccountAddr = currentAccount?.address;

  useEffect(() => {
    setCurrentCaredAddress(currentAccountAddr || '');
  }, [currentAccountAddr]);

  const { matteredChainBalances, testnetMatteredChainBalances } =
    useChainBalances();

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,

    fetchAllAddressesChainBalance,

    fetchMatteredChainBalance,
    /** @deprecated */
    getMatteredChainBalance: fetchMatteredChainBalance,

    fetchOrderedChainList,
    /** @deprecated */
    getOrderedChainList: fetchOrderedChainList,
  };
}

export function useMatteredChainBalancesAll() {
  const chainUSDMap = balanceStore(s => s.chainUSDMap);
  const matteredChainBalancesAll = useMemo(
    () => buildMatteredChainBalances(mergeChainListsById(chainUSDMap)),
    [chainUSDMap],
  );

  return { matteredChainBalancesAll };
}
