import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

export const PerpsDepositCard: React.FC<{
  availableBalance: number;
  onDepositPress?(): void;
}> = ({ availableBalance, onDepositPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Available to trade: {formatUsdValue(availableBalance)}
      </Text>
      <TouchableOpacity onPress={onDepositPress}>
        <View style={styles.btn}>
          <Text style={styles.btnText}>Deposit</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors2024['brand-light-1'],
  },
  btnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
