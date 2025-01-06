import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';

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
