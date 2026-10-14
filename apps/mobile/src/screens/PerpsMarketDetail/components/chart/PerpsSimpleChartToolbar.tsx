import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import {
  SIMPLE_CHART_RANGES,
  SIMPLE_RANGE_INTERVAL,
  type SimpleChartPreference,
} from '@/constant/perpsSimpleChart';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { touchedFeedback } from '@/utils/touch';
import Interval from '@/assets2024/icons/perps/PerpsSimpleChart/interval.svg';
import Chevron from '@/assets2024/icons/perps/PerpsSimpleChart/chevron.svg';
import Area from '@/assets2024/icons/perps/PerpsSimpleChart/area.svg';
import Candle from '@/assets2024/icons/perps/PerpsSimpleChart/candle.svg';
import { SIMPLE_CHART_COLORS } from './visual';

export const PerpsSimpleChartToolbar = React.memo(
  function PerpsSimpleChartToolbar({
    preference,
    onChange,
    onInterval,
    onPrefetch,
  }: {
    preference: SimpleChartPreference;
    onChange: (value: SimpleChartPreference) => void;
    onInterval: () => void;
    onPrefetch: (interval: SimpleChartPreference['interval']) => void;
  }) {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    return (
      <View style={styles.toolbar}>
        {preference.style === 'candle' && (
          <Pressable
            style={({ pressed }) => [
              styles.interval,
              preference.range === null && styles.selected,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityState={{ selected: preference.range === null }}
            accessibilityRole="button"
            accessibilityLabel={t('page.perpsDetail.simpleChart.intervalTitle')}
            onPress={() => {
              touchedFeedback();
              onInterval();
            }}>
            <Interval
              color={colors2024['green-default']}
              fill={colors2024['red-default']}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                styles.intervalLabel,
                preference.range === null && styles.manualLabel,
              ]}>
              {preference.interval.endsWith('d') ||
              preference.interval.endsWith('w')
                ? preference.interval.toUpperCase()
                : preference.interval}
            </Text>
            <Chevron color={colors2024['neutral-secondary']} />
          </Pressable>
        )}
        <View style={styles.ranges}>
          {SIMPLE_CHART_RANGES.map(range => (
            <Pressable
              key={range}
              style={({ pressed }) => [
                styles.range,
                preference.range === range && styles.selected,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityState={{ selected: preference.range === range }}
              onPressIn={() => onPrefetch(SIMPLE_RANGE_INTERVAL[range])}
              onPress={() => {
                touchedFeedback();
                onChange({
                  ...preference,
                  range,
                  interval: SIMPLE_RANGE_INTERVAL[range],
                });
              }}>
              <Text
                style={[
                  styles.label,
                  preference.range === range && styles.selectedLabel,
                ]}>
                {range}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t(
            `page.perpsDetail.simpleChart.${
              preference.style === 'candle' ? 'switchToArea' : 'switchToCandle'
            }`,
          )}
          onPress={() => {
            touchedFeedback();
            onChange({
              ...preference,
              style: preference.style === 'candle' ? 'area' : 'candle',
            });
          }}>
          {preference.style === 'candle' ? (
            <Area color={colors2024['green-default']} />
          ) : (
            <Candle
              color={colors2024['green-default']}
              fill={colors2024['red-default']}
            />
          )}
        </Pressable>
      </View>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  toolbar: {
    minHeight: 24,
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ranges: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  range: {
    flex: 1,
    alignItems: 'center',
    minHeight: 24,
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selected: {
    backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
  },
  selectedLabel: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: SIMPLE_CHART_COLORS.accent,
  },
  manualLabel: { fontFamily: 'SF Pro Rounded', fontWeight: '700' },
  // At 12pt, "30m" is wider than 24pt in both Medium and Bold.
  intervalLabel: { width: 32, flexShrink: 0 },
  pressed: { opacity: 0.6 },
  interval: {
    width: 84,
    flexShrink: 0,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
    paddingHorizontal: 8,
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
