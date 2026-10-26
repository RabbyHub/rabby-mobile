import React, { memo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';

export const ItemLoader = memo(
  ({ style }: { style?: StyleProp<ViewStyle> }) => {
    const { styles } = useTheme2024({ getStyle });
    return (
      <View style={[styles.positionLoader, style]}>
        <Skeleton width={40} height={40} circle />
        <View style={styles.loaderList}>
          <Skeleton height={20} circle />
          <Skeleton width={144} height={18} circle />
        </View>
      </View>
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  positionLoader: {
    height: 60,
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
}));
