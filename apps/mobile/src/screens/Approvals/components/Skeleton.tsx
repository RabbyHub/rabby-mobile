import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { ApprovalsLayouts, IOS_SWIPABLE_LEFT_OFFSET } from '../layout';
import { getCardStyles } from './ApprovalCardContract';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import LinearGradient from 'react-native-linear-gradient';

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
        paddingHorizontal:
          ApprovalsLayouts.innerContainerHorizontalOffset -
          IOS_SWIPABLE_LEFT_OFFSET,
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
                  LinearGradientComponent={LinearGradient}
                  style={[skeletonStyles.skeletonBg]}
                />
                <Skeleton
                  LinearGradientComponent={LinearGradient}
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
                  LinearGradientComponent={LinearGradient}
                  height={22}
                  style={[skeletonStyles.skeletonBg]}
                />
              </View>
              <View style={[skeletonStyles.skeletonFloor]}>
                <Skeleton
                  height={22}
                  animation="wave"
                  width={'100%'}
                  LinearGradientComponent={LinearGradient}
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
    <View>
      {Array(15)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              cardStyles.container,
              {
                height: ApprovalsLayouts.assetsItemHeight,
                borderWidth: 0,
              },
            ]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Skeleton
                animation="wave"
                LinearGradientComponent={LinearGradient}
                circle
                width={30}
                height={30}
                style={cardStyles.skeletonBg}
              />
              <Skeleton
                animation="wave"
                LinearGradientComponent={LinearGradient}
                circle
                height={30}
                style={[cardStyles.skeletonBg, { flexShrink: 1 }]}
              />
            </View>
          </View>
        ))}
    </View>
  );
});
