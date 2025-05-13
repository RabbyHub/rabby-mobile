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
        paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
      }}>
      {Array(8)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              cardStyles.container,
              { height: 74 },
              i > 0 && {
                marginTop: 8,
              },
            ]}>
            <View
              style={{
                width: '100%',
                flexShrink: 1,
                flexDirection: 'column',
                justifyContent: 'space-evenly',
              }}>
              <View style={[skeletonStyles.skeletonFloor]}>
                <Skeleton
                  width={46}
                  animation="wave"
                  height={46}
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
      {Array(8)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              cardStyles.container,
              { height: 74 },
              i > 0 && {
                marginTop: 8,
              },
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
