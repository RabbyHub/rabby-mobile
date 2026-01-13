import { useEffect } from 'react';

import { CORE_KEYRING_TYPES, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { keyringService, preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import {
  DisplayChainWithWhiteLogo,
  formatChainToDisplay,
  varyAndSortChainItems,
} from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { coerceFloat } from '@/utils/number';
import { requestOpenApiMultipleNets } from '@/utils/openapi';
import * as apiBalance from '@/core/apis/balance';
import { unionBy } from 'lodash';
import { BalanceEntity } from '@/databases/entities/balance';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useMyAccounts } from './account';

type MatteredChainBalances = {
  [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
};
type MatteredBalancesState = {
  matteredChainBalances: MatteredChainBalances;
  testnetMatteredChainBalances: MatteredChainBalances;
};
function getDefaultMatteredBalancesState(): MatteredBalancesState {
  return {
    matteredChainBalances: {},
    testnetMatteredChainBalances: {},
  };
}
type MatteredBalancesStore = Record<string, MatteredBalancesState>;
const addrMatteredBalancesStore = zCreate<{
  currentAddress: string;
  store: MatteredBalancesStore;
}>(() => {
  return {
    currentAddress: '',
    store: {},
  };
});

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

function setMattredChainBalancesByAddr(
  addr: string,
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  const address = addr.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.store[address]?.matteredChainBalances || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return {
      ...prev,
      store: {
        ...prev.store,
        [address]: {
          ...getDefaultMatteredBalancesState(),
          ...prev.store[address],
          matteredChainBalances: newVal,
        },
      },
    };
  });
}

function setTestMattredChainBalances(
  addr: string,
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  const address = addr.toLowerCase();
  addrMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.store[address]?.testnetMatteredChainBalances || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return {
      ...prev,
      store: {
        ...prev.store,
        [address]: {
          ...getDefaultMatteredBalancesState(),
          ...prev.store[address],
          testnetMatteredChainBalances: newVal,
        },
      },
    };
  });
}

const allMatteredBalancesStore = zCreate<MatteredChainBalances>(() => {
  return {};
});
function setMattredChainBalancesAll(
  valOrFunc: UpdaterOrPartials<MatteredChainBalances>,
) {
  allMatteredBalancesStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev?.matteredChainBalancesAll || {},
      valOrFunc,
      { strict: false },
    );

    // if (!changed) return prev;

    return newVal;
  });
}

const DEFAULT_MATTERED_BALANCES_STATE = getDefaultMatteredBalancesState();
export function useChainBalances() {
  const matteredChainBalances = addrMatteredBalancesStore(
    s =>
      (s.currentAddress
        ? s.store[s.currentAddress]?.matteredChainBalances
        : null) || DEFAULT_MATTERED_BALANCES_STATE.matteredChainBalances,
  );
  const testnetMatteredChainBalances = addrMatteredBalancesStore(
    s =>
      (s.currentAddress
        ? s.store[s.currentAddress]?.testnetMatteredChainBalances
        : null) || DEFAULT_MATTERED_BALANCES_STATE.testnetMatteredChainBalances,
  );

  return {
    matteredChainBalances,
    testnetMatteredChainBalances,
  };
}

const isShowTestnet = false;

const fetchSingleAddressBalanceFromDb = async (
  address: string,
): Promise<{
  mainnet: TotalBalanceResponse | null;
  testnet: TotalBalanceResponse | null;
}> => {
  return requestOpenApiMultipleNets<
    TotalBalanceResponse | null,
    {
      mainnet: TotalBalanceResponse | null;
      testnet: TotalBalanceResponse | null;
    }
  >(
    ctx => {
      if (!isShowTestnet && ctx.isTestnetTask) {
        return null;
      }
      return BalanceEntity.queryBalance(address, true);
    },
    {
      needTestnetResult: isShowTestnet,
      processResults: ({ mainnet, testnet }) => {
        return {
          mainnet: mainnet,
          testnet: testnet,
        };
      },
      fallbackValues: {
        mainnet: null,
        testnet: null,
      },
    },
  );
};
const fetchAllAddressesChainBalance = async (): Promise<{
  matteredChainBalances: MatteredChainBalances;
}> => {
  console.log('fetchAllAddressesChainBalance exe');
  const addresses = await keyringService.getAllAddresses();
  const filtered = addresses.filter(item =>
    CORE_KEYRING_TYPES.includes(item.type as any),
  );
  const unionAddresses = unionBy(filtered, 'address').map(i =>
    i.address.toLowerCase(),
  );

  const allResults = await Promise.all(
    unionAddresses.map(async address => {
      return {
        address,
        result: await fetchSingleAddressBalanceFromDb(address),
      };
    }),
  );

  const mainnetBalance: TotalBalanceResponse = {
    chain_list: [],
    total_usd_value: 0,
  };

  allResults.forEach(({ address, result }) => {
    if (result.mainnet?.chain_list) {
      result.mainnet.chain_list.forEach(chain => {
        const existingChain = mainnetBalance.chain_list.find(
          c => c.id === chain.id,
        );
        if (existingChain) {
          existingChain.usd_value = existingChain.usd_value + chain.usd_value;
        } else {
          mainnetBalance.chain_list.push(chain);
        }
      });
    }
  });

  const mainnetTotalUsdValue = (mainnetBalance?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const matteredChainBalances = (mainnetBalance?.chain_list || []).reduce(
    (accu, cur) => {
      const curUsdValue = coerceFloat(cur.usd_value);
      if (curUsdValue > 1 && curUsdValue / mainnetTotalUsdValue > 0.01) {
        accu[cur.id] = formatChainToDisplay(cur);
      }
      return accu;
    },
    {} as MatteredChainBalances,
  );

  setMattredChainBalancesAll(matteredChainBalances);
  console.log('fetchAllAddressesChainBalance  done');
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
  const currentAccountAddr =
    address || addrMatteredBalancesStore.getState().currentAddress;

  const result = await requestOpenApiMultipleNets<
    TotalBalanceResponse | null,
    {
      mainnet: TotalBalanceResponse | null;
      testnet: TotalBalanceResponse | null;
    }
  >(
    ctx => {
      if (!isShowTestnet && ctx.isTestnetTask) {
        return null;
      }

      return apiBalance.getAddressCacheBalance(
        currentAccountAddr,
        ctx.isTestnetTask,
      );
    },
    {
      needTestnetResult: isShowTestnet,
      processResults: ({ mainnet, testnet }) => {
        return {
          mainnet: mainnet,
          testnet: testnet,
        };
      },
      fallbackValues: {
        mainnet: null,
        testnet: null,
      },
    },
  );

  const mainnetTotalUsdValue = (result.mainnet?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const matteredChainBalances = (result.mainnet?.chain_list || []).reduce(
    (accu, cur) => {
      const curUsdValue = coerceFloat(cur.usd_value);
      // TODO: only leave chain with blance greater than $1 and has percentage 1%
      if (curUsdValue > 1 && curUsdValue / mainnetTotalUsdValue > 0.01) {
        accu[cur.id] = formatChainToDisplay(cur);
      }
      return accu;
    },
    {} as MatteredChainBalances,
  );

  const testnetTotalUsdValue = (result.testnet?.chain_list || []).reduce(
    (accu, cur) => accu + coerceFloat(cur.usd_value),
    0,
  );
  const testnetMatteredChainBalances = (
    result.testnet?.chain_list || []
  ).reduce((accu, cur) => {
    const curUsdValue = coerceFloat(cur.usd_value);

    if (curUsdValue > 1 && curUsdValue / testnetTotalUsdValue > 0.01) {
      accu[cur.id] = formatChainToDisplay(cur);
    }
    return accu;
  }, {} as MatteredChainBalances);

  if (currentAccountAddr) {
    setMattredChainBalancesByAddr(currentAccountAddr, matteredChainBalances);
    setTestMattredChainBalances(
      currentAccountAddr,
      testnetMatteredChainBalances,
    );
  }

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
  account?: Account;
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
  const matteredChainBalancesAll = allMatteredBalancesStore(s => s);

  return { matteredChainBalancesAll };
}
