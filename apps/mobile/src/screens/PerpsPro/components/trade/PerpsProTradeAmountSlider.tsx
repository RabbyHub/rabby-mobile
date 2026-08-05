import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

const TRADE_SLIDER_POINT_COUNT = 5;

export const PerpsProTradeAmountSlider: React.FC = React.memo(() => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      accessibilityState={{ disabled: true }}
      style={styles.container}
      testID="perps-pro-trade-amount-slider">
      <View pointerEvents="none" style={styles.track} />
      <View pointerEvents="none" style={styles.points}>
        {Array.from({ length: TRADE_SLIDER_POINT_COUNT }, (_, index) => (
          <View
            key={index}
            style={styles.point}
            testID="perps-pro-trade-amount-slider-point"
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={styles.thumb}
        testID="perps-pro-trade-amount-slider-thumb"
      />
    </View>
  );
});

PerpsProTradeAmountSlider.displayName = 'PerpsProTradeAmountSlider';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 24,
    position: 'relative',
    width: '100%',
  },
  track: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 1,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 13,
  },
  points: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 10,
  },
  point: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 3.5,
    borderWidth: 1,
    height: 7,
    width: 7,
  },
  thumb: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-title-1'],
    borderRadius: 6.5,
    borderWidth: 1,
    height: 13,
    left: 0,
    position: 'absolute',
    top: 7,
    width: 13,
  },
}));
