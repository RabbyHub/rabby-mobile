import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useFittingFontSize } from '@/components/AutoShrinkAmountTextSizing';
import type { CandleStick } from '@/components2024/TradingViewCandleChart/type';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { simplePriceText } from './model';

/** Equal columns and one measured size for the loaded data, not each pointer move. */
export const PerpsSimpleOhlc = React.memo(function PerpsSimpleOhlc({
  candle,
  decimals,
  measureText,
}: {
  candle: CandleStick;
  decimals: number;
  measureText: string;
}) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { fittingFontSize, setInputWidth, handleMeasureTextLayout } =
    useFittingFontSize({
      style: styles.value,
      maxFontSize: 14,
      minFontSize: 6,
      fontSizeStep: 0.5,
    });
  return (
    <View style={styles.row}>
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text
          style={styles.value}
          numberOfLines={1}
          onTextLayout={handleMeasureTextLayout}>
          {measureText}
        </Text>
      </View>
      {(['open', 'low', 'high', 'close'] as const).map((key, index) => (
        <View
          key={key}
          style={styles.field}
          onLayout={
            index === 0
              ? event => setInputWidth(event.nativeEvent.layout.width)
              : undefined
          }>
          <Text style={styles.description} numberOfLines={1}>
            {t(`page.perpsDetail.simpleChart.${key}`)}
          </Text>
          <Text
            style={[styles.value, { fontSize: fittingFontSize }]}
            numberOfLines={1}>
            ${simplePriceText(candle[key], decimals)}
          </Text>
        </View>
      ))}
    </View>
  );
});
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, minWidth: 0, gap: 2 },
  measure: { position: 'absolute', width: 10000, opacity: 0 },
  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
