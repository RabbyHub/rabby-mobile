import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PerpsProSkeletonBlock } from '../loading/PerpsProSkeletonBlock';

export const PERPS_PRO_KLINE_CHART_HEIGHT = 184;

export const PerpsProKlineSkeleton: React.FC<{ overlay?: boolean }> =
  React.memo(({ overlay = false }) => {
    const { styles } = useTheme2024({ getStyle });

    return (
      <View
        pointerEvents="none"
        style={[styles.container, overlay ? styles.overlay : null]}
        testID="perps-pro-kline-skeleton">
        <View style={styles.legend}>
          <PerpsProSkeletonBlock height={8} style={styles.rounded} width={52} />
          <PerpsProSkeletonBlock height={8} style={styles.rounded} width={52} />
          <PerpsProSkeletonBlock height={8} style={styles.rounded} width={52} />
        </View>
        <View style={styles.chart}>
          {[40, 70, 52, 82, 62, 96, 72, 54, 78, 46].map((height, index) => (
            <PerpsProSkeletonBlock
              key={`${height}:${index}`}
              height={height}
              style={styles.candle}
              width={6}
            />
          ))}
        </View>
      </View>
    );
  });

PerpsProKlineSkeleton.displayName = 'PerpsProKlineSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KLINE_CHART_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 8,
    width: '100%',
  },
  overlay: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 8,
  },
  rounded: {
    borderRadius: 4,
  },
  chart: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-around',
    paddingBottom: 18,
    paddingHorizontal: 8,
  },
  candle: {
    borderRadius: 2,
  },
}));
