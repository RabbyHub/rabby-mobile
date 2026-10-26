import { memo } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { ASSETS_ITEM_HEIGHT_NEW, DEFI_ITEM_HEIGHT } from '@/constant/layout';

export const ItemLoader = memo(
  ({ style }: { style?: StyleProp<ViewStyle> }) => {
    const { styles } = useTheme2024({ getStyle });
    return (
      <View style={[styles.positionLoader, style]}>
        <Skeleton style={styles.loading} width={40} height={40} circle />
        <View style={styles.loaderList}>
          <Skeleton style={styles.loading} height={20} circle />
          <Skeleton style={styles.loading} width={144} height={18} circle />
        </View>
      </View>
    );
  },
);

export const DefiItemLoader = memo(
  ({ style }: { style?: StyleProp<ViewStyle> }) => {
    const { styles } = useTheme2024({ getStyle });
    return (
      <View style={[styles.defiLoaderGroup, style]}>
        <View style={styles.defiLoader}>
          <View style={styles.defiLoaderHeader}>
            <View style={styles.defiLoaderHeaderLeft}>
              <Skeleton style={styles.defiLogo} width={40} height={40} />
              <Skeleton style={styles.loading} width={50} height={18} circle />
            </View>
            <Skeleton style={styles.loading} width={50} height={20} circle />
          </View>
          <View style={styles.defiLoaderList}>
            <Skeleton style={styles.loading} height={120} />
          </View>
        </View>
      </View>
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  positionLoader: {
    width: '100%',
    height: ASSETS_ITEM_HEIGHT_NEW,
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginLeft: 16,
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
    backgroundColor: ctx.colors2024['neutral-bg-4'],
    borderRadius: 12,
  },
  defiLoaderGroup: {
    height: DEFI_ITEM_HEIGHT,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  defiLoaderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  defiLoaderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  defiLoader: {
    width: '100%',
    height: DEFI_ITEM_HEIGHT,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 14,
    gap: 10,
  },
  defiLogo: {
    backgroundColor: ctx.colors2024['neutral-bg-4'],
    borderRadius: 12,
  },
  defiLoaderList: {
    flexDirection: 'column',
    gap: 4,
  },
}));
