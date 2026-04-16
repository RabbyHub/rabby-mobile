import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Dimensions, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';

const ScreenWidth = Dimensions.get('window').width;
const DetailLoadingSkeleton = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Skeleton
          circle
          width={100}
          height={24}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
      <View style={styles.overview}>
        <Skeleton
          width={ScreenWidth - 32}
          height={124}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
      <View style={styles.main}>
        <Skeleton
          width={ScreenWidth - 32}
          height={239}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
      <View style={styles.btns}>
        <Skeleton
          width={(ScreenWidth - 42) / 2}
          height={50}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
        <Skeleton
          width={(ScreenWidth - 42) / 2}
          height={50}
          style={styles.skeleton}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
    </View>
  );
};

export default DetailLoadingSkeleton;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  skeleton: {
    borderRadius: 16,
  },
  header: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overview: {
    marginTop: 16,
  },
  main: {
    marginTop: 12,
  },
  btns: {
    height: 116,
    paddingTop: 12,
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
