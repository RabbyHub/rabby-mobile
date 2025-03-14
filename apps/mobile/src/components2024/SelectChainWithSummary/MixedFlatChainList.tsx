import React, { useEffect, useMemo } from 'react';
import { View, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import orderBy from 'lodash/orderBy';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ChainItem from './ChainItem';
import { useLocalTokens } from '@/screens/Home/hooks/token';
import { useChainBalances, useCurrentAccount } from '@/hooks/account';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { useAssets } from '@/screens/Search/useAssets';
import { CombineTokensItem } from '@/screens/Home/hooks/store';

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
}) {
  const { currentAccount } = useCurrentAccount();
  const { tokens: cacheAssets, getCacheTop10Assets } = useAssets();
  const { styles } = useTheme2024({ getStyle });
  const { tokenList } = useLocalTokens(currentAccount?.address);
  const { matteredChainBalances, matteredChainBalancesAll } =
    useChainBalances();
  const tokenListMap = useMemo(() => {
    if (!tokenList || needAllAddresses) {
      return {};
    }
    const res = tokenList.reduce((map, item) => {
      if (item.price * item.amount < 10) {
        return map;
      }
      if (map[item.chain]) {
        return {
          ...map,
          [item.chain]: [...map[item.chain], item],
        };
      } else {
        return {
          ...map,
          [item.chain]: [item],
        };
      }
    }, {} as Record<string, TokenItem[]>);
    for (const key in res) {
      const list = res[key];
      const chainUsdValue = matteredChainBalances[key]?.usd_value || 0;
      res[key] = list.filter(item => {
        return item.price * item.amount > chainUsdValue * 0.1;
      });
    }
    return res;
  }, [tokenList, matteredChainBalances, needAllAddresses]);

  const cacheAssetsMap = useMemo(() => {
    if (!cacheAssets || cacheAssets[0]?._unHold || !needAllAddresses) {
      return {};
    }
    const res = cacheAssets.reduce((map, item) => {
      console.log('item', item);
      if (item.totalUsdValue < 10) {
        return map;
      }
      if (map[item.chain]) {
        return {
          ...map,
          [item.chain]: [...map[item.chain], item],
        };
      } else {
        return {
          ...map,
          [item.chain]: [item],
        };
      }
    }, {} as Record<string, CombineTokensItem[]>);
    for (const key in res) {
      const list = res[key];
      const chainUsdValue = matteredChainBalancesAll[key]?.usd_value || 0;
      res[key] = list.filter(item => {
        return item.totalUsdValue > chainUsdValue * 0.1;
      });
    }
    return res;
  }, [cacheAssets, matteredChainBalancesAll, needAllAddresses]);
  console.log('cacheAssetsMap', cacheAssetsMap[0]);

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

  useEffect(() => {
    needAllAddresses &&
      getCacheTop10Assets({
        disableNFT: true,
        disableDefi: true,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needAllAddresses]);

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
              tokens={
                needAllAddresses
                  ? orderBy(
                      cacheAssetsMap[item.serverId],
                      a => a.totalUsdValue,
                      'desc',
                    )
                      .filter(t => t.is_core)
                      .slice(0, 5)
                  : orderBy(
                      tokenListMap[item.serverId],
                      a => a.price * a.amount,
                      'desc',
                    )
                      .filter(t => t.is_core)
                      .slice(0, 5)
              }
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
