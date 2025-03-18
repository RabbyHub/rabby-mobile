import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { ASSETS_ITEM_HEIGHT_NEW } from '@/constant/layout';

export const PositionLoader = ({
  space,
  length = 6,
}: {
  space: number;
  length?: number;
}) => {
  const colors = useThemeColors();

  return (
    <>
      {[...Array(length)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.positionLoader,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              backgroundColor: colors['neutral-bg-1'],
              borderTopColor: colors['neutral-line'],
              marginBottom: space,
              borderTopWidth: space ? 0 : StyleSheet.hairlineWidth,
            },
          ]}>
          <Skeleton width={46} height={46} circle />
          <View
            style={{
              gap: 2,
              flex: 1,
            }}>
            <Skeleton height={20} circle />
            <Skeleton height={18} circle />
          </View>
        </View>
      ))}
    </>
  );
};

export const ItemLoader = memo(() => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.positionLoader]}>
      <Skeleton style={styles.loading} width={40} height={40} circle />
      <View style={styles.loaderList}>
        <Skeleton style={styles.loading} height={20} circle />
        <Skeleton style={styles.loading} width={144} height={18} circle />
      </View>
    </View>
  );
});

const getStyle = createGetStyles2024(ctx => ({
  positionLoader: {
    height: ASSETS_ITEM_HEIGHT_NEW,
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
    backgroundColor: ctx.colors2024['neutral-bg-4'],
  },
}));

export const NetWorthLoader = memo(() => {
  return (
    <View>
      <Skeleton width={110} height={30} style={{ borderRadius: 2 }} />
    </View>
  );
});

export const ChangeLoader = memo(() => {
  return (
    <View>
      <Skeleton width={150} height={22} style={{ borderRadius: 1 }} />
    </View>
  );
});

const styles = StyleSheet.create({
  positionLoader: {
    height: 74,
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
});
