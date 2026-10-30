import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  MAX_PRICE_IMPACT_OPTIONS,
  type MaxPriceImpactPct,
} from '../ui/helpers';

export const MaxPriceImpactSelector = ({
  value,
  onChange,
}: {
  value: MaxPriceImpactPct;
  onChange: (value: MaxPriceImpactPct) => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t('page.memeCoin.maxPriceImpact')}</Text>
      <View style={styles.control}>
        {MAX_PRICE_IMPACT_OPTIONS.map(option => {
          const active = option === value;
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.8}
              onPress={() => onChange(option)}
              style={[styles.segment, active && styles.segmentActive]}>
              <Text style={active ? styles.textActive : styles.text}>
                {option}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  control: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  segment: {
    width: 60,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    borderColor: colors2024['brand-light-2'],
    backgroundColor: colors2024['brand-light-1'],
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  textActive: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
