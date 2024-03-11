import React from 'react';
import { View, StyleSheet, SectionList, Text } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
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
  const { styles } = useThemeStyles(getStyles);

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
        const isFirstSection = section === sections[0];
        const isSectionFirst = index === 0;
        const isSectionLast = index === section.data.length - 1;
        const disabled = supportChains
          ? !supportChains.includes(item.enum)
          : false;
        return (
          <View
            style={[
              styles.chainItemWrapper,
              !isFirstSection && isSectionFirst && styles.notFirstSection,

              isSectionFirst && styles.sectionFirst,
              isSectionLast && styles.sectionLast,
            ]}>
            <View
              style={[
                styles.chainItemInner,
                isSectionFirst && styles.sectionFirstInner,
              ]}>
              <ChainItem
                data={item}
                value={value}
                onPress={onChange}
                disabled={disabled}
                disabledTips={disabledTips}
              />
            </View>
          </View>
        );
      }}
    />
  );
}

const Divider = () => <View className="h-[0.5] bg-r-neutral-line" />;

const RADIUS_VALUE = 6;

const getStyles = createGetStyles(colors => {
  return {
    chainListContainer: {
      borderRadius: RADIUS_VALUE,
    },
    chainItemWrapper: {
      backgroundColor: colors['neutral-card2'],
      paddingHorizontal: 16,
      // ...makeDebugBorder()
    },
    notFirstSection: {
      marginTop: 12,
    },
    chainItemInner: {
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopStyle: 'solid',
    },
    sectionFirstInner: {
      borderTopWidth: 0,
    },

    sectionFirst: {
      borderTopLeftRadius: RADIUS_VALUE,
      borderTopRightRadius: RADIUS_VALUE,
    },
    sectionLast: {
      borderBottomLeftRadius: RADIUS_VALUE,
      borderBottomRightRadius: RADIUS_VALUE,
    },
  };
});
