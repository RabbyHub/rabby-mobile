import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { ApprovalsLayouts } from './Layout';
import { getCardStyles } from './ApprovalContractCard';
import { useThemeStyles } from '@/hooks/theme';

export const SkeletonListByContracts = memo(() => {
  const { styles: cardStyles } = useThemeStyles(getCardStyles);
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
              i > 0 && {
                marginTop: 10,
              },
            ]}>
            <View style={{ flexDirection: 'row' }}>
              <Skeleton
                animation="pulse"
                style={{ width: '70%', flexShrink: 0, height: '100%' }}
              />
              <View
                style={{
                  width: '100%',
                  flexShrink: 1,
                  marginLeft: 6,
                  flexDirection: 'column',
                }}>
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[{ flexShrink: 1, height: '40%' }]}
                />
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[{ flexShrink: 1, height: '30%', paddingTop: 5 }]}
                />
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[{ flexShrink: 1, height: '30%', paddingTop: 4 }]}
                />
              </View>
            </View>
          </View>
        ))}
    </View>
  );
});
