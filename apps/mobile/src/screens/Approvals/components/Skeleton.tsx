import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { ApprovalsLayouts } from '../layout';
import { getCardStyles } from './ApprovalCardContract';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import LinearGradient from 'react-native-linear-gradient';

// FIXME: error when use
const Linear = () => {
  const { colors2024, styles } = useTheme2024({ getStyle: getSkeletonStyles });

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.linear}
      colors={[colors2024['neutral-bg-2'], 'neutral-bg-1']}
    />
  );
};

const getSkeletonStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    skeletonFloor: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
    },
    skeletonBg: {
      backgroundColor: colors2024['neutral-bg-2'],
    },
    linear: {
      height: '100%',
    },
  };
});

export const SkeletonListByContracts = memo(() => {
  const { styles: cardStyles } = useTheme2024({
    getStyle: getCardStyles,
  });
  const { styles: skeletonStyles } = useTheme2024({
    getStyle: getSkeletonStyles,
  });
  return (
    <View
      style={{
        paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
      }}>
      {Array(5)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              cardStyles.container,
              { height: 122 },
              i > 0 && {
                marginTop: 12,
              },
            ]}>
            <View
              style={{
                width: '100%',
                flexShrink: 1,
                flexDirection: 'column',
                justifyContent: 'space-evenly',
              }}>
              <View
                style={[
                  skeletonStyles.skeletonFloor,
                  {
                    marginBottom: 14,
                  },
                ]}>
                <Skeleton
                  width={27}
                  animation="wave"
                  height={27}
                  circle
                  // LinearGradientComponent={Linear}
                  style={[skeletonStyles.skeletonBg]}
                />
                <Skeleton
                  // LinearGradientComponent={Linear}
                  circle
                  animation="wave"
                  height={27}
                  style={[
                    skeletonStyles.skeletonBg,
                    { flexShrink: 1, marginLeft: 8 },
                  ]}
                />
              </View>
              <View
                style={[
                  skeletonStyles.skeletonFloor,
                  {
                    marginBottom: 5,
                  },
                ]}>
                <Skeleton
                  animation="wave"
                  width={'100%'}
                  circle
                  // LinearGradientComponent={Linear}
                  height={22}
                  style={[skeletonStyles.skeletonBg]}
                />
              </View>
              <View style={[skeletonStyles.skeletonFloor]}>
                <Skeleton
                  height={22}
                  animation="wave"
                  width={'100%'}
                  // LinearGradientComponent={Linear}
                  circle
                  style={skeletonStyles.skeletonBg}
                />
              </View>
            </View>
          </View>
        ))}
    </View>
  );
});

export const SkeletonListByAssets = memo(() => {
  const { styles: cardStyles } = useTheme2024({ getStyle: getCardStyles });
  return (
    <View
      style={{
        paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
      }}>
      {Array(15)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              cardStyles.container,
              { height: ApprovalsLayouts.assetsItemHeight },
              i > 0 && {
                marginTop: 10,
              },
            ]}>
            <View style={{ flexDirection: 'row' }}>
              <Skeleton
                animation="pulse"
                style={{ width: '100%', flexShrink: 1, height: '100%' }}
              />
              <Skeleton
                animation="pulse"
                width={'100%'}
                style={[
                  { width: 54, flexShrink: 0, height: '100%', marginLeft: 6 },
                ]}
              />
            </View>
          </View>
        ))}
    </View>
  );
});
