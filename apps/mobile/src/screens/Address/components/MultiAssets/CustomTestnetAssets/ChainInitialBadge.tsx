import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const ChainInitialBadge = memo(
  ({ name, size = 18 }: { name: string; size?: number }) => {
    const { styles } = useTheme2024({ getStyle });
    const label = name.substring(0, 3).replace(/\s/g, '').toUpperCase();

    return (
      <View
        style={[
          styles.chainInitialBadge,
          { width: size, height: size, borderRadius: size / 3 },
        ]}>
        <Text style={styles.chainInitialText}>{label}</Text>
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) =>
  StyleSheet.create({
    chainInitialBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-foot'],
      overflow: 'hidden',
    },
    chainInitialText: {
      color: isLight ? colors2024['neutral-InvertHighlight'] : 'black',
      fontFamily: 'SF Pro Rounded',
      fontSize: 6.8,
      lineHeight: 9,
      fontWeight: '700',
    },
  }),
);
