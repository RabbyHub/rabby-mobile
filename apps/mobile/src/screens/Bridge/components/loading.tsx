import React from 'react';
import { Skeleton } from '@rneui/themed';
import { StyleSheet, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  dexLoading: {
    flexDirection: 'column',
    width: '100%',
    height: 80,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    borderColor: colors2024['neutral-line'],
  },
  column: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dexNameColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeleton3: {
    borderRadius: 2,
    width: 132,
    height: 20,
  },
  skeleton4: {
    borderRadius: 2,
    width: 90,
    height: 16,
  },
}));

export const QuoteLoading = ({}: {}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.dexLoading}>
      <View style={styles.column}>
        <View style={styles.dexNameColumn}>
          <Skeleton circle width={32} height={32} />
          <Skeleton style={styles.skeleton4} />
        </View>
        <Skeleton style={styles.skeleton3} />
      </View>
      <View style={styles.column}>
        <Skeleton style={styles.skeleton4} />
        <Skeleton style={styles.skeleton4} />
      </View>
    </View>
  );
};
