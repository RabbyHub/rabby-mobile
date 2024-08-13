import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';

export const PositionLoader = ({ space }: { space: number }) => {
  const colors = useThemeColors();

  return (
    <>
      {[...Array(6)].map((_, i) => (
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
          <Skeleton width={26} height={26} style={{ borderRadius: 13 }} />
          <View
            style={{
              marginLeft: 8,
              justifyContent: 'center',
              gap: 4,
            }}>
            <Skeleton width={51} height={17} style={{ borderRadius: 2 }} />
            <Skeleton width={144} height={17} style={{ borderRadius: 2 }} />
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
    height: 60,
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
});
