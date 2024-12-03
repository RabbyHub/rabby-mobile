import React from 'react';
import { View, StyleSheet } from 'react-native';

import { CHAINS_ENUM, Chain } from '@/constant/chains';
import ChainItem from './ChainItem';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

export default function ChainList({
  style,
  value,
  onChange,
  data,
}: RNViewProps & {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  data: Chain[];
}) {
  const { styles } = useThemeStyles(getStyles);

  return (
    <View style={[styles.chainListContainer, style]}>
      {data.map((item, index, arr) => {
        const key = `${item.enum}-${index}`;

        return (
          <View key={key} style={[styles.chainItemWrapper]}>
            <ChainItem data={item} value={value} onPress={onChange} />
          </View>
        );
      })}
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    chainListContainer: {
      paddingHorizontal: 16,
      backgroundColor: colors['neutral-card2'],
      borderRadius: 6,
    },
    chainItemWrapper: {
      borderBottomColor: colors['neutral-line'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomStyle: 'solid',
      // ...makeDebugBorder()
    },
  };
});
