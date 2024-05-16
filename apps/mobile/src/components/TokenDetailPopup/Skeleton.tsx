import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { getHistoryItemStyles } from './HistoryItem';
import { TOKEN_DETAIL_HISTORY_SIZES } from './layout';

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

const SIZES = TOKEN_DETAIL_HISTORY_SIZES;
const getHeaderSkeletonStyles = createGetStyles(colors => {
  return {
    skeletonBg: {
      backgroundColor: colors['neutral-card2'],
    },
    tokenDetailHeaderWrap: {
      height: SIZES.headerHeight,
      width: '100%',
      paddingVertical: 4,
      alignItems: 'flex-start',
    },
    tokenDetailHeaderF1: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 0,
    },
    tokenDetailHeaderLogo: {
      width: SIZES.headerTokenLogo,
      height: SIZES.headerTokenLogo,
      borderRadius: SIZES.headerTokenLogo,
      marginRight: 8,
    },
    tokenSymbolPlaceholder: {
      width: 32,
    },
    tokenAddrInfoPlaceholder: {
      width: 100,
      marginLeft: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 4,
      height: 20,

      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderF2: {
      flexDirection: 'column',
      // alignItems: 'center',
      marginTop: 16,
      marginBottom: 0,
    },
    balanceTitlePlaceholder: {
      width: 60,
      marginBottom: 4,
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderF2Inner: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderUsdValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 80,
      height: 24,
    },
  };
});
export const SkeletonTokenDetailHeader = memo(() => {
  const { styles } = useThemeStyles(getHeaderSkeletonStyles);

  return (
    <View style={[styles.tokenDetailHeaderWrap]}>
      <View style={styles.tokenDetailHeaderF1}>
        <Skeleton
          animation="pulse"
          style={[styles.skeletonBg, styles.tokenDetailHeaderLogo]}
        />
        <Skeleton
          animation="pulse"
          style={[styles.skeletonBg, styles.tokenSymbolPlaceholder]}
        />
        <Skeleton animation="pulse" style={[styles.tokenAddrInfoPlaceholder]} />
      </View>

      <View style={styles.tokenDetailHeaderF2}>
        <Skeleton
          animation="pulse"
          style={[styles.skeletonBg, styles.balanceTitlePlaceholder]}
        />

        <View style={styles.tokenDetailHeaderF2Inner}>
          <Skeleton
            animation="pulse"
            style={[styles.skeletonBg, styles.tokenDetailHeaderUsdValueWrap]}
          />
        </View>
      </View>
    </View>
  );
});
