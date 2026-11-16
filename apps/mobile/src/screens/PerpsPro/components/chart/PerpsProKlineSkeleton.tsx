import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PerpsChartLoadingGif } from '@/screens/PerpsShared/components/PerpsChartLoadingGif';

// MA band (22) + plot + time axis; the panel adds header and bottom padding.
export const PERPS_PRO_KLINE_CHART_HEIGHT = 228;

export const PerpsProKlineSkeleton: React.FC<{ overlay?: boolean }> =
  React.memo(({ overlay = false }) => {
    const { styles } = useTheme2024({ getStyle });

    return (
      <View
        pointerEvents="none"
        style={[styles.container, overlay ? styles.overlay : null]}
        testID="perps-pro-kline-skeleton">
        {/* The shared loading GIF is the only loading indicator. */}
        <PerpsChartLoadingGif />
      </View>
    );
  });

PerpsProKlineSkeleton.displayName = 'PerpsProKlineSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    height: PERPS_PRO_KLINE_CHART_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  overlay: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
}));
