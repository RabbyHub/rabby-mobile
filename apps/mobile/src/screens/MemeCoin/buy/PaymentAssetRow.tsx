import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { SelectedBadge } from '../components/SelectedBadge';

export const PaymentAssetRow = React.memo(function PaymentAssetRow({
  itemKey,
  logoUrl,
  chain,
  symbol,
  usdValue,
  estPaymentUsd,
  selected,
  onPress,
}: {
  itemKey: string;
  logoUrl: string;
  chain: string;
  symbol: string;
  usdValue: number;
  /** only for selected rows */
  estPaymentUsd?: number;
  selected: boolean;
  onPress: (itemKey: string) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const handlePress = useCallback(() => onPress(itemKey), [onPress, itemKey]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.row, selected && styles.rowSelected]}>
      <AssetAvatar logo={logoUrl} chain={chain} size={44} chainSize={18} />
      <Text style={styles.symbol} numberOfLines={1}>
        {symbol}
      </Text>
      <View style={styles.right}>
        <Text style={styles.value}>{formatUsdValue(usdValue)}</Text>
        {estPaymentUsd !== undefined ? (
          <Text style={styles.estPayment}>
            {t('page.memeCoin.buy.estPayment', {
              amount: formatUsdValue(estPaymentUsd),
            })}
          </Text>
        ) : null}
      </View>
      {selected ? <SelectedBadge /> : null}
    </TouchableOpacity>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    height: 70,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-card-1'],
  },
  rowSelected: {
    borderColor: colors2024['brand-disable'],
  },
  symbol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  right: {
    marginLeft: 8,
    alignItems: 'flex-end',
    gap: 2,
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  estPayment: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['brand-default'],
  },
}));
