import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';

import { CandlePeriod } from '@/components2024/TradingViewCandleChart/type';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

interface Props {
  currentInterval: CandlePeriod;
  onSelect: (value: CandlePeriod) => void;
}
const TimePanel = ({ currentInterval, onSelect }: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const TIME_INTERVALS = useMemo(
    () => [
      {
        label: t('page.tokenDetail.interval.1M'),
        value: CandlePeriod.ONE_MINUTE,
      },
      {
        label: t('page.tokenDetail.interval.5M'),
        value: CandlePeriod.FIVE_MINUTES,
      },
      {
        label: t('page.tokenDetail.interval.15M'),
        value: CandlePeriod.FIFTEEN_MINUTES,
      },
      {
        label: t('page.tokenDetail.interval.30M'),
        value: CandlePeriod.THIRTY_MINUTES,
      },
      {
        label: t('page.tokenDetail.interval.1H'),
        value: CandlePeriod.ONE_HOUR,
      },
      {
        label: t('page.tokenDetail.interval.4H'),
        value: CandlePeriod.FOUR_HOURS,
      },
      {
        label: t('page.tokenDetail.interval.1D'),
        value: CandlePeriod.ONE_DAY,
      },
      {
        label: t('page.tokenDetail.interval.1W'),
        value: CandlePeriod.ONE_WEEK,
      },
    ],
    [t],
  );
  return (
    <View style={styles.container}>
      {TIME_INTERVALS.map(item => (
        <Pressable
          key={item.value}
          onPress={() => onSelect(item.value)}
          style={styles.textContainer}>
          <Text
            style={[
              styles.text,
              currentInterval === item.value && styles.activeText,
            ]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default TimePanel;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
    height: 24,
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 30,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  activeText: {
    backgroundColor: colors2024['neutral-line'],
    color: colors2024['neutral-body'],
    height: 24,
    lineHeight: 24,
    borderRadius: 6,
    overflow: 'hidden',
  },
}));
