import { Chain, CHAINS_ENUM, getChainList } from '@/constant/chains';
import { TestnetChain } from '@/core/services/customTestnetService';
import { ITokenItem } from '@/store/tokens';
import {
  ChainWithBalance,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';

export function makeChainServerIdSet(_chainList?: (Chain | TestnetChain)[]) {
  const chainList = _chainList || [
    ...getChainList('mainnet'),
    ...getChainList('testnet'),
  ];

  return new Set(chainList.map(chain => chain.serverId));
}

export const findChain = (
  params: {
    enum?: CHAINS_ENUM | string | null;
    id?: number | null;
    serverId?: string | null;
    hex?: string | null;
    networkId?: string | null;
  },
  _chainList?: (Chain | TestnetChain)[],
): Chain | null | undefined => {
  const chainList = _chainList || [
    ...getChainList('mainnet'),
    ...getChainList('testnet'),
  ];
  const { enum: chainEnum, id, serverId, hex, networkId } = params;
  if (chainEnum && chainEnum.startsWith('CUSTOM_')) {
    return findChain(
      {
        id: +chainEnum.replace('CUSTOM_', ''),
      },
      chainList,
    );
  }
  const chain = chainList.find(
    item =>
      item.enum === chainEnum ||
      (id && +item.id === +id) ||
      item.serverId === serverId ||
      item.hex === hex ||
      item.network === networkId,
  );

  return chain;
};
/**
 * @description safe find chain, if not found, return fallback(if provided) or null
 */
export function findChainByEnum(
  chainEnum?: CHAINS_ENUM | string,
  options?: {
    fallback?: true | CHAINS_ENUM;
  },
): Chain | null {
  const fallbackIdx = !options?.fallback
    ? null
    : typeof options?.fallback === 'string'
    ? options?.fallback
    : ('ETH' as const);
  const toFallbackEnum: CHAINS_ENUM | null = fallbackIdx
    ? CHAINS_ENUM[fallbackIdx] || CHAINS_ENUM.ETH
    : null;
  const toFallbackChain = toFallbackEnum
    ? findChain({ enum: toFallbackEnum }) || null
    : null;

  if (!chainEnum) {
    return toFallbackChain;
  }

  return (
    findChain({
      enum: chainEnum,
    }) || toFallbackChain
  );
}

export function filterChainEnum(chainEnum: CHAINS_ENUM) {
  return findChainByEnum(chainEnum)?.enum || null;
}

export function ensureChainHashValid<
  T extends {
    [K in CHAINS_ENUM]?: any;
  },
>(obj: T) {
  const newObj = <T>{};
  Object.entries(obj).forEach(([chainEnum, value]) => {
    if (findChainByEnum(chainEnum)) {
      newObj[chainEnum as CHAINS_ENUM] = value;
    }
  });

  return newObj;
}

export function ensureChainListValid<T extends CHAINS_ENUM[]>(list: T) {
  return list.filter(chainEnum => findChainByEnum(chainEnum));
}

/**
 * @description safe find chain
 */
export function findChainByID(chainId: Chain['id']): Chain | null {
  return (
    findChain({
      id: chainId,
    }) || null
  );
}

/**
 * @description safe find chain by serverId
 */
export function findChainByServerID(chainId: Chain['serverId']): Chain | null {
  return (
    findChain({
      serverId: chainId,
    }) || null
  );
}

export function isTestnet(chainServerId?: string) {
  if (!chainServerId) {
    return false;
  }
  const chain = findChainByServerID(chainServerId);
  if (!chain) {
    return false;
  }
  return !!chain.isTestnet;
}

export function isTestnetChainId(chainId?: string | number) {
  if (!chainId) {
    return false;
  }
  const chain = findChainByID(Number(chainId));
  if (!chain) {
    return false;
  }
  return !!chain.isTestnet;
}

export interface DisplayChainWithWhiteLogo extends ChainWithBalance {
  logo?: string;
  whiteLogo?: string;
}

export function formatChainToDisplay(
  item: ChainWithBalance,
): DisplayChainWithWhiteLogo {
  const chain = findChain({
    id: item.community_id,
  });
  return {
    ...item,
    logo: chain?.logo || item.logo_url,
    whiteLogo: chain?.whiteLogo,
  };
}

export function sortChainItems<T extends Chain>(
  items: T[],
  opts?: {
    cachedChainBalances?: {
      [P in Chain['serverId']]?: DisplayChainWithWhiteLogo;
    };
    supportChains?: CHAINS_ENUM[];
  },
) {
  const { cachedChainBalances = {}, supportChains } = opts || {};

  return (
    items
      // .map((item, index) => ({
      //   ...item,
      //   index,
      // }))
      .sort((a, b) => {
        const aBalance = cachedChainBalances[a.serverId]?.usd_value || 0;
        const bBalance = cachedChainBalances[b.serverId]?.usd_value || 0;

        if (!supportChains) {
          return aBalance > bBalance ? -1 : 1;
        }

        if (supportChains.includes(a.enum) && !supportChains.includes(b.enum)) {
          return -1;
        }
        if (!supportChains.includes(a.enum) && supportChains.includes(b.enum)) {
          return 1;
        }

        return aBalance > bBalance ? -1 : 1;
      })
  );
}

export function searchChains(options: {
  list: Chain[];
  pinned: string[];
  searchKeyword: string;
}) {
  const { list, pinned } = options;
  let { searchKeyword = '' } = options;

  searchKeyword = searchKeyword?.trim().toLowerCase();
  if (!searchKeyword) {
    return list.filter(item => !pinned.includes(item.enum));
  }
  const res = list.filter(item =>
    [item.name, item.enum, item.nativeTokenSymbol].some(item =>
      item.toLowerCase().includes(searchKeyword),
    ),
  );
  return res
    .filter(item => pinned.includes(item.enum))
    .concat(res.filter(item => !pinned.includes(item.enum)));
}

export function varyAndSortChainItems(deps: {
  supportChains?: CHAINS_ENUM[];
  searchKeyword?: string;
  pinned: CHAINS_ENUM[];
  matteredChainBalances: {
    [x: string]: DisplayChainWithWhiteLogo | undefined;
  };
  netTabKey?: 'mainnet' | 'testnet';
  mainnetList?: Chain[];
  testnetList?: Chain[];
}) {
  const {
    supportChains,
    searchKeyword = '',
    pinned,
    matteredChainBalances,
    netTabKey,
    mainnetList = getChainList('mainnet'),
    testnetList = getChainList('testnet'),
  } = deps;

  const unpinnedListGroup = {
    withBalance: [] as Chain[],
    withoutBalance: [] as Chain[],
    disabled: [] as Chain[],
  };
  const pinnedListGroup = {
    withBalance: [] as Chain[],
    withoutBalance: [] as Chain[],
    disabled: [] as Chain[],
  };

  const _all = (
    (netTabKey === 'testnet' ? testnetList : mainnetList) || mainnetList
  )
    .sort((a: { name: string }, b: { name: any }) =>
      a.name.localeCompare(b.name),
    )
    .sort((a, b) => (a.severity || 0) - (b.severity || 0));

  _all.forEach((item: Chain) => {
    const inPinned = pinned.find(pinnedEnum => pinnedEnum === item.enum);

    if (!inPinned) {
      if (supportChains?.length && !supportChains.includes(item.enum)) {
        unpinnedListGroup.disabled.push(item);
      } else if (!matteredChainBalances[item.serverId]) {
        unpinnedListGroup.withoutBalance.push(item);
      } else {
        unpinnedListGroup.withBalance.push(item);
      }
    } else {
      if (supportChains?.length && !supportChains.includes(item.enum)) {
        pinnedListGroup.disabled.push(item);
      } else if (!matteredChainBalances[item.serverId]) {
        pinnedListGroup.withoutBalance.push(item);
      } else {
        pinnedListGroup.withBalance.push(item);
      }
    }
  });

  const allSearched = searchChains({
    list: _all,
    pinned,
    searchKeyword: searchKeyword?.trim() || '',
  });

  pinnedListGroup.withBalance = sortChainItems(pinnedListGroup.withBalance, {
    supportChains,
    cachedChainBalances: matteredChainBalances,
  });
  unpinnedListGroup.withBalance = sortChainItems(
    unpinnedListGroup.withBalance,
    {
      supportChains,
      cachedChainBalances: matteredChainBalances,
    },
  );
  pinnedListGroup.disabled = sortChainItems(pinnedListGroup.disabled, {
    supportChains,
    cachedChainBalances: matteredChainBalances,
  });
  unpinnedListGroup.disabled = sortChainItems(unpinnedListGroup.disabled, {
    supportChains,
    cachedChainBalances: matteredChainBalances,
  });

  return {
    allSearched,
    matteredList: [
      ...pinnedListGroup.withBalance,
      ...pinnedListGroup.withoutBalance,
      ...unpinnedListGroup.withBalance,
      ...pinnedListGroup.disabled,
    ],
    unmatteredList: [
      ...unpinnedListGroup.withoutBalance,
      ...unpinnedListGroup.disabled,
    ],
  };
}

export const formatChain = (
  item: ChainWithBalance,
): DisplayChainWithWhiteLogo => {
  const chain = findChain({
    id: item.community_id,
  });

  return {
    ...item,
    logo: chain?.logo || item.logo_url,
    whiteLogo: chain?.whiteLogo,
  };
};

export function makeTokenFromChain(chain: Chain): TokenItem {
  return {
    id: chain.nativeTokenAddress,
    decimals: chain.nativeTokenDecimals,
    logo_url: chain.nativeTokenLogo,
    symbol: chain.nativeTokenSymbol,
    display_symbol: chain.nativeTokenSymbol,
    optimized_symbol: chain.nativeTokenSymbol,
    is_core: true,
    is_verified: true,
    is_wallet: true,
    amount: 0,
    price: 0,
    name: chain.nativeTokenSymbol,
    chain: chain.serverId,
    time_at: 0,
  };
}

export const getChain = (chainId?: string) => {
  if (!chainId) {
    return null;
  }
  return findChain({
    serverId: chainId,
  });
};

export const getTop3Chains = (tokens: ITokenItem[]): string[] => {
  if (!tokens.length) {
    return [];
  }

  const chainValueMap: Record<string, number> = {};

  tokens.forEach(token => {
    const chainId = token.chain;
    if (!chainId) {
      return;
    }
    const usdValue = token.is_core ? token.usd_value ?? 0 : 0;
    chainValueMap[chainId] = (chainValueMap[chainId] || 0) + usdValue;
  });

  return Object.entries(chainValueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([chainId]) => chainId);
};
