import React, { useEffect, useMemo } from 'react';
import { View, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useShallow } from 'zustand/shallow';

import { zCreate, zMutative } from '@/core/utils/reexports';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ChainItem from './ChainItem';
import {
  useChainBalances,
  useMatteredChainBalancesAll,
} from '@/hooks/accountChainBalance';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { Account } from '@/core/services/preference';
import {
  EMPTY_TOKEN_ENTITY_IDS,
  ITokenItem,
  TokenEntityId,
  tokenEntityResourceStore,
  useTokenIndexStore,
} from '@/store/tokens';
import useTokenList from '@/store/tokens';

const EMPTY_CHAIN_TOKEN_IDS_BY_CHAIN: Record<string, TokenEntityId[]> = {};

type ChainBalanceMap = Record<string, { usd_value?: number } | undefined>;

const getSelectedAddressesKey = (addresses: string[]) =>
  addresses
    .map(address => address.toLowerCase())
    .slice()
    .sort()
    .join('|');

const getChainTokenUsdValue = (token: ITokenItem) => token.price * token.amount;

const buildStableTokenIds = (
  tokenIds: TokenEntityId[],
  previousTokenIds?: TokenEntityId[],
) => {
  if (!tokenIds.length) {
    return previousTokenIds?.length
      ? EMPTY_TOKEN_ENTITY_IDS
      : previousTokenIds || EMPTY_TOKEN_ENTITY_IDS;
  }

  const canReusePrevious = previousTokenIds?.length === tokenIds.length;
  let nextTokenIds: TokenEntityId[] | undefined = canReusePrevious
    ? undefined
    : [];

  tokenIds.forEach((tokenId, index) => {
    if (canReusePrevious && !nextTokenIds) {
      if (previousTokenIds![index] === tokenId) {
        return;
      }
      nextTokenIds = previousTokenIds!.slice(0, index);
    }
    nextTokenIds!.push(tokenId);
  });

  return nextTokenIds || previousTokenIds!;
};

const buildChainTokenIdsByChain = ({
  tokenIds,
  chainBalanceMap,
  previousMap,
}: {
  tokenIds: TokenEntityId[];
  chainBalanceMap: ChainBalanceMap;
  previousMap?: Record<string, TokenEntityId[]>;
}) => {
  const tokenMap = tokenIds.reduce((map, tokenId) => {
    const token = tokenEntityResourceStore.getValue(tokenId);
    if (!token?.is_core || getChainTokenUsdValue(token) < 10) {
      return map;
    }

    const list = map[token.chain] || [];
    list.push({ tokenId, token });
    map[token.chain] = list;
    return map;
  }, {} as Record<string, Array<{ tokenId: TokenEntityId; token: ITokenItem }>>);

  const nextMap: Record<string, TokenEntityId[]> = {};
  Object.keys(tokenMap).forEach(chain => {
    const chainUsdValue = chainBalanceMap[chain]?.usd_value || 0;
    const previousTokenIds = previousMap?.[chain];
    nextMap[chain] = buildStableTokenIds(
      tokenMap[chain]
        .filter(item => getChainTokenUsdValue(item.token) > chainUsdValue * 0.1)
        .sort(
          (a, b) =>
            getChainTokenUsdValue(b.token) - getChainTokenUsdValue(a.token),
        )
        .slice(0, 5)
        .map(item => item.tokenId),
      previousTokenIds,
    );
  });

  return nextMap;
};

type ChainSelectorTokenIndexState = {
  chainTokenIdsByKey: Record<string, Record<string, TokenEntityId[]>>;
  syncChainTokenIds(params: {
    key: string;
    tokenIds: TokenEntityId[];
    chainBalanceMap: ChainBalanceMap;
  }): void;
};

const useChainSelectorTokenIndexStore = zCreate(
  zMutative<ChainSelectorTokenIndexState>((set, get) => ({
    chainTokenIdsByKey: {},
    syncChainTokenIds({ key, tokenIds, chainBalanceMap }) {
      const previousMap = get().chainTokenIdsByKey[key];
      const nextMap = buildChainTokenIdsByChain({
        tokenIds,
        chainBalanceMap,
        previousMap,
      });
      const previousKeys = Object.keys(previousMap || {});
      const nextKeys = Object.keys(nextMap);
      const isSame =
        previousKeys.length === nextKeys.length &&
        nextKeys.every(chain => previousMap?.[chain] === nextMap[chain]);

      if (isSame) {
        return;
      }

      set(draft => {
        draft.chainTokenIdsByKey[key] = nextMap;
      });
    },
  })),
);

export default function MixedFlatChainList({
  style,
  value,
  onChange,
  needAllAddresses,
  onScrollBeginDrag,
  matteredList = [],
  unmatteredList = [],
  supportChains,
  unsupportedChainMode = 'disabled',
  disabledTips = 'Not supported',
  account: currentAccount,
}: RNViewProps & {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  matteredList?: Chain[];
  unmatteredList?: Chain[];
  needAllAddresses?: boolean;
  supportChains?: CHAINS_ENUM[];
  unsupportedChainMode?: 'disabled' | 'hidden';
  onScrollBeginDrag?:
    | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
    | undefined;
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
  account?: Account | null;
}) {
  const { myTop10Addresses } = useAccountInfo();
  const selectedAddresses = useMemo(() => {
    if (needAllAddresses) {
      return myTop10Addresses;
    }
    if (currentAccount?.address) {
      return [currentAccount.address];
    }
    return [];
  }, [needAllAddresses, myTop10Addresses, currentAccount?.address]);
  const chainSelectorKey = useMemo(
    () => `${getSelectedAddressesKey(selectedAddresses)}::${needAllAddresses}`,
    [needAllAddresses, selectedAddresses],
  );

  useEffect(() => {
    useTokenIndexStore
      .getState()
      .syncFromTokenListMap(
        useTokenList.getState().tokenListMap,
        selectedAddresses,
      );
  }, [selectedAddresses]);

  const tokenIds = useTokenIndexStore(
    useShallow(state => {
      if (!selectedAddresses.length) {
        return EMPTY_TOKEN_ENTITY_IDS;
      }
      const ids: TokenEntityId[] = [];
      const seen = new Set<TokenEntityId>();
      selectedAddresses.forEach(address => {
        const addressTokenIds =
          state.addressTokenIds[address.toLowerCase()] ||
          EMPTY_TOKEN_ENTITY_IDS;
        addressTokenIds.forEach(tokenId => {
          if (seen.has(tokenId)) {
            return;
          }
          seen.add(tokenId);
          ids.push(tokenId);
        });
      });
      return ids;
    }),
  );
  const tokenVersions = tokenEntityResourceStore.useStore(
    useShallow(state =>
      tokenIds.map(tokenId => state.metaMap[tokenId]?.version || 0),
    ),
  );

  const { styles } = useTheme2024({ getStyle });
  const { matteredChainBalances } = useChainBalances();
  const { matteredChainBalancesAll } = useMatteredChainBalancesAll();
  const chainBalanceMap = needAllAddresses
    ? matteredChainBalancesAll
    : matteredChainBalances;

  useEffect(() => {
    useChainSelectorTokenIndexStore.getState().syncChainTokenIds({
      key: chainSelectorKey,
      tokenIds,
      chainBalanceMap,
    });
  }, [chainBalanceMap, chainSelectorKey, tokenIds, tokenVersions]);

  const chainTokenIdsByChain = useChainSelectorTokenIndexStore(
    useShallow(
      state =>
        state.chainTokenIdsByKey[chainSelectorKey] ||
        EMPTY_CHAIN_TOKEN_IDS_BY_CHAIN,
    ),
  );
  const getChainTokens = useMemo(
    () => (chainServerId: string) =>
      (chainTokenIdsByChain[chainServerId] || EMPTY_TOKEN_ENTITY_IDS)
        .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
        .filter((token): token is ITokenItem => !!token),
    [chainTokenIdsByChain],
  );

  const sections = React.useMemo(() => {
    return [
      {
        title: 'Mattered',
        data: matteredList,
      },
      {
        title: 'Unmattered',
        data: unmatteredList,
      },
    ];
  }, [matteredList, unmatteredList]);

  return (
    <BottomSheetSectionList<Chain>
      sections={sections}
      onScrollBeginDrag={onScrollBeginDrag}
      style={style}
      ListFooterComponent={<View style={{ height: 32 }} />}
      keyExtractor={(item, idx) => `${item.enum}-${idx}`}
      renderItem={({ item, index, section }) => {
        const unsupported = supportChains
          ? !supportChains.includes(item.enum)
          : false;
        if (unsupportedChainMode === 'hidden' && unsupported) {
          return null;
        }

        const isSectionFirst = index === 0;
        const isSectionLast = index === section.data.length - 1;
        return (
          <View
            style={[
              isSectionFirst && styles.sectionFirst,
              isSectionLast && styles.sectionLast,
            ]}>
            <ChainItem
              needAllAddresses={needAllAddresses}
              data={item}
              value={value}
              onPress={onChange}
              disabled={unsupported}
              disabledTips={disabledTips}
              tokens={getChainTokens(item.serverId)}
            />
          </View>
        );
      }}
    />
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(() => ({
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
}));
