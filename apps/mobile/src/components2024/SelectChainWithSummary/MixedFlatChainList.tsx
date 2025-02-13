import React, { useMemo } from 'react';
import {
  View,
  SectionList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import orderBy from 'lodash/orderBy';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ChainItem from './ChainItem';
import { useLocalTokens } from '@/screens/Home/hooks/token';
import { useCurrentAccount } from '@/hooks/account';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export default function MixedFlatChainList({
  style,
  value,
  onChange,
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
  supportChains?: CHAINS_ENUM[];
  onScrollBeginDrag?:
    | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
    | undefined;
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
}) {
  const { currentAccount } = useCurrentAccount();
  const { styles } = useTheme2024({ getStyle });
  const { tokenList } = useLocalTokens(currentAccount?.address);
  const tokenListMap = useMemo(() => {
    if (!tokenList) {
      return {};
    }
    const res = tokenList.reduce((map, item) => {
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
    return res;
  }, [tokenList]);

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
    <SectionList<Chain>
      sections={sections}
      onScrollBeginDrag={onScrollBeginDrag}
      style={style}
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
