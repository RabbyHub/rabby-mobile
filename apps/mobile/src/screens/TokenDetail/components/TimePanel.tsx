import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { CandlePeriod } from '@/components2024/TradingViewCandleChart/type';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const TIME_INTERVALS = [
  {
    label: '1M',
    value: CandlePeriod.ONE_MINUTE,
  },
  {
    label: '30M',
    value: CandlePeriod.THIRTY_MINUTES,
  },
  {
    label: '1H',
    value: CandlePeriod.ONE_HOUR,
  },
  {
    label: '4H',
    value: CandlePeriod.FOUR_HOURS,
  },
  {
    label: '1D',
    value: CandlePeriod.ONE_DAY,
  },
  {
    label: '1W',
    value: CandlePeriod.ONE_WEEK,
  },
];

interface Props {
  currentInterval: CandlePeriod;
  onSelect: (value: CandlePeriod) => void;
}
const TimePanel = ({ currentInterval, onSelect }: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

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
    height: 24,
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 19,
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
