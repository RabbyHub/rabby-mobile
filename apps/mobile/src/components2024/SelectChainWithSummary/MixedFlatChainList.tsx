import React, { useEffect, useMemo } from 'react';
import { View, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import orderBy from 'lodash/orderBy';

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
  EMPTY_TOKEN_LIST,
  getChainSelectorCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';

export default function MixedFlatChainList({
  style,
  value,
  onChange,
  needAllAddresses,
  onScrollBeginDrag,
  matteredList = [],
  unmatteredList = [],
  supportChains,
  disabledTips = 'Not supported',
  account: currentAccount,
}: RNViewProps & {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  matteredList?: Chain[];
  unmatteredList?: Chain[];
  needAllAddresses?: boolean;
  supportChains?: CHAINS_ENUM[];
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
  const registerChainSelector = useTokenListComputedStore(
    state => state.registerChainSelector,
  );
  const chainSelectorKey = useMemo(
    () => getChainSelectorCacheKey(selectedAddresses),
    [selectedAddresses],
  );
  useEffect(() => {
    registerChainSelector(selectedAddresses);
  }, [selectedAddresses, registerChainSelector]);

  const tokens = useTokenListComputedStore(state => {
    return state.chainSelectorCache[chainSelectorKey] || EMPTY_TOKEN_LIST;
  });

  const { styles } = useTheme2024({ getStyle });
  const { matteredChainBalances } = useChainBalances();
  const { matteredChainBalancesAll } = useMatteredChainBalancesAll();

  const tokenListMap = useMemo(() => {
    if (!tokens) {
      return {};
    }
    const res = tokens.reduce((map, item) => {
      if (item.price * item.amount < 10) {
        return map;
      }
      const c = map[item.chain];
      if (c) {
        return {
          ...map,
          [item.chain]: [...c, item],
        };
      } else {
        return {
          ...map,
          [item.chain]: [item],
        };
      }
    }, {} as Record<string, ITokenItem[]>);
    for (const key in res) {
      const list = res[key]!;
      const chainUsdValue = needAllAddresses
        ? matteredChainBalancesAll[key]?.usd_value || 0
        : matteredChainBalances[key]?.usd_value || 0;
      res[key] = list.filter(item => {
        return item.price * item.amount > chainUsdValue * 0.1;
      });
    }
    return res;
  }, [
    tokens,
    matteredChainBalances,
    needAllAddresses,
    matteredChainBalancesAll,
  ]);

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
        const isSectionFirst = index === 0;
        const isSectionLast = index === section.data.length - 1;
        const disabled = supportChains
          ? !supportChains.includes(item.enum)
          : false;
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
              disabled={disabled}
              disabledTips={disabledTips}
              tokens={orderBy(
                tokenListMap[item.serverId],
                a => a.price * a.amount,
                'desc',
              )
                .filter(t => t.is_core)
                .slice(0, 5)}
            />
          </View>
        );
      }}
    />
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
}));
