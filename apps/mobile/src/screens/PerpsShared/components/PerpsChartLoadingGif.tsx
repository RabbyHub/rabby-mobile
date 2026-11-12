import React from 'react';
import type { ImageRequireSource } from 'react-native';
import FastImage from 'react-native-fast-image';

// Transparent 200px source, ~3.8s loop; FastImage animates GIFs on both
// platforms (RN Image does not on Android).
const PERPS_LOADING_GIF =
  require('@/assets2024/images/perps/perps-loading.gif') as ImageRequireSource;

export const PERPS_CHART_LOADING_GIF_SIZE = 40;

export const PerpsChartLoadingGif = React.memo(function PerpsChartLoadingGif() {
  return (
    <FastImage
      resizeMode={FastImage.resizeMode.contain}
      source={PERPS_LOADING_GIF}
      style={styles.gif}
      testID="perps-chart-loading-gif"
    />
  );
});

const styles = {
  gif: {
    height: PERPS_CHART_LOADING_GIF_SIZE,
    width: PERPS_CHART_LOADING_GIF_SIZE,
  },
};
