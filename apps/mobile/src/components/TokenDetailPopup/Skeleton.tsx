import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { getHistoryItemStyles } from './HistoryItem';

const getSkeletonStyles = createGetStyles(colors => {
  const historyItemStyles = getHistoryItemStyles(colors);

  return {
    card: {
      ...historyItemStyles.card,
      height: 100,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
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

export const SkeletonHistoryListOfTokenDetail = memo(() => {
  const { styles } = useThemeStyles(getSkeletonStyles);

  return (
    <View style={{}}>
      {Array(5)
        .fill(0)
        .map((e, i) => (
          <View
            key={i}
            style={[
              styles.card,
              { height: 100 },
              i > 0 && {
                marginTop: 0,
              },
            ]}>
            <View
              style={{
                width: '100%',
                flexShrink: 1,
                flexDirection: 'column',
                justifyContent: 'space-evenly',
              }}>
              <View style={[styles.skeletonFloor, { width: '50%' }]}>
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[styles.skeletonBg, { flexShrink: 1 }]}
                />
              </View>
              <View style={[styles.skeletonFloor]}>
                <Skeleton
                  animation="pulse"
                  width={'100%'}
                  style={[styles.skeletonBg]}
                />
              </View>
              <View style={[styles.skeletonFloor]}>
                <Skeleton animation="pulse" width={'100%'} style={[{}]} />
              </View>
            </View>
          </View>
        ))}
    </View>
  );
});
