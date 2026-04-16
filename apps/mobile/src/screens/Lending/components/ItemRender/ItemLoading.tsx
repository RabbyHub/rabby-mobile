import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import { Skeleton } from '@rneui/themed';

export const ItemLoading = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <View style={styles.itemContainer}>
        <Skeleton style={styles.loading} width={40} height={40} circle />
        <View style={styles.loaderList}>
          <Skeleton style={styles.loading} width={144} height={22} circle />
        </View>
      </View>
      <Skeleton style={[styles.loading, styles.actions]} height={40} />
    </View>
  );
};

export const ItemListLoading = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 5 }).map((_, i) => (
        <ItemLoading key={i} />
      ))}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  listContainer: {
    gap: 8,
    marginTop: 8,
  },
  container: {
    width: '100%',
    height: 138,
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingVertical: 15,
    gap: 12,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderTopColor: ctx.colors2024['neutral-line'],
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loaderList: {
    gap: 4,
    flex: 1,
  },
  loading: {
    backgroundColor: ctx.colors2024['neutral-bg-5'],
  },
  actions: {
    borderRadius: 12,
  },
}));
