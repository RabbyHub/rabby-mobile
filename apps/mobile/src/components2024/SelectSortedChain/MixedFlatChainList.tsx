import React from 'react';
import { View, SectionList } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ChainItem from './ChainItem';

export default function MixedFlatChainList({
  style,
  value,
  onChange,
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
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
}) {
  const { styles } = useTheme2024({ getStyle });

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
      style={[styles.chainListContainer, style]}
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
            />
          </View>
        );
      }}
    />
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  chainListContainer: {
    borderRadius: RADIUS_VALUE,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },

  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
}));
