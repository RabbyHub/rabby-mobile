import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { useLendingIsLoading } from '../hooks';

export const PoolItemLoading = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <Skeleton style={styles.loading} width={40} height={40} circle />
      <View style={styles.loaderList}>
        <Skeleton style={styles.loading} height={20} circle />
        <Skeleton style={styles.loading} width={144} height={18} circle />
      </View>
    </View>
  );
};

export const PoolListLoading = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { loading } = useLendingIsLoading();

  if (loading) return null;

  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 8 }).map((_, i) => (
        <PoolItemLoading key={i} />
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
    height: 74,
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 15,
    gap: 12,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderTopColor: ctx.colors2024['neutral-line'],
  },
  loaderList: {
    gap: 4,
    flex: 1,
  },
  loading: {
    backgroundColor: ctx.colors2024['neutral-bg-5'],
  },
}));
