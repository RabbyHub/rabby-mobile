import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { ApprovalsLayouts } from '../layout';
import { getCardStyles } from './ApprovalCardContract';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

const getSkeletonStyles = createGetStyles(colors => {
  return {
    skeletonFloor: {
      height: '33%',
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
    },
    skeletonBg: {
      backgroundColor: colors['neutral-card2'],
      height: 14,
    },
  };
});

export const SkeletonListByContracts = memo(() => {
  const { styles: cardStyles, colors } = useThemeStyles(getCardStyles);
  const { styles: skeletonStyles } = useThemeStyles(getSkeletonStyles);
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
              { height: 96 },
              i > 0 && {
                marginTop: 10,
              },
            ]}>
            <View
              style={{
                width: '100%',
                flexShrink: 1,
                flexDirection: 'column',
                justifyContent: 'space-evenly',
              }}>
              <View style={[skeletonStyles.skeletonFloor, { width: '50%' }]}>
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[
                    skeletonStyles.skeletonBg,
                    { borderRadius: 20, width: 20, height: 20 },
                  ]}
                />
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[
                    skeletonStyles.skeletonBg,
                    { flexShrink: 1, marginLeft: 8 },
                  ]}
                />
              </View>
              <View style={[skeletonStyles.skeletonFloor]}>
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[skeletonStyles.skeletonBg]}
                />
              </View>
              <View style={[skeletonStyles.skeletonFloor]}>
                <Skeleton animation="pulse" width={'100%'} style={[{}]} />
              </View>
            </View>
          </View>
        ))}
    </View>
  );
});

export const SkeletonListByAssets = memo(() => {
  const { styles: cardStyles } = useThemeStyles(getCardStyles);
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
