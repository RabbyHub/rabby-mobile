import { useTheme2024 } from '@/hooks/theme';
import { formatPerpsNumber, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { SWAP_REQUIRED_QUOTE_ASSETS, PerpsQuoteAsset } from '@/constant/perps';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';

export const PerpsDepositCard: React.FC<{
  accountValue: number;
  availableBalance: number;
  quoteAsset?: PerpsQuoteAsset;
  onDepositPress?(): void;
  onSwapPress?(): void;
}> = ({
  accountValue,
  availableBalance,
  quoteAsset = 'USDC',
  onDepositPress,
  onSwapPress,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const isSwapRequired =
    SWAP_REQUIRED_QUOTE_ASSETS.includes(quoteAsset) && !!accountValue;
  const actionLabel = isSwapRequired
    ? t('page.perps.PerpsDepositCard.swap')
    : t('page.perps.PerpsDepositCard.deposit');
  const handlePress = isSwapRequired ? onSwapPress : onDepositPress;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        {t('page.perps.PerpsDepositCard.availableToTrade')}
        <Text style={styles.balance}>
          {Number(formatPerpsNumber(availableBalance))} {quoteAsset}
        </Text>
      </Text>
      <TouchableOpacity onPress={handlePress}>
        <View style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    flex: 1,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(80, 210, 193, 0.12)',
  },
  btnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: isLight ? colors2024['neutral-title-1'] : '#50D2C1',
  },
  balance: {
    fontWeight: '700',
  },
}));
