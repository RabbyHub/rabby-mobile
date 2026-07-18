import { RcIconGasBalanceBadgeBg } from '@/assets2024/icons/gas-account';
import { Text } from '@/components/Typography';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, TextStyle, View, ViewStyle } from 'react-native';

export interface GasAccountBalanceCardProps {
  balance?: number | string | null;
  label?: string;
  style?: StyleProp<ViewStyle>;
  amountStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const GasAccountBalanceCard: React.FC<GasAccountBalanceCardProps> = ({
  balance,
  label,
  style,
  amountStyle,
  labelStyle,
}) => {
  const renderStartedAt = Date.now();
  const renderSeqRef = React.useRef(0);
  const { t } = useTranslation();
  const defaultLabel = t('page.gasAccount.gasBalance');
  const { styles } = useTheme2024({ getStyle });
  const amount = formatUsdValue(Number(balance || 0));

  React.useEffect(() => {
    renderSeqRef.current += 1;
    traceStartupDiagnostic('gas-account', 'balance_card_render_commit', {
      seq: renderSeqRef.current,
      renderCommitMs: Date.now() - renderStartedAt,
      hasBalance: Number(balance || 0) > 0,
      amount,
    });
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textBlock}>
        <Text style={[styles.amount, amountStyle]}>{amount}</Text>
        <Text style={[styles.label, labelStyle]}>{label || defaultLabel}</Text>
      </View>

      <RcIconGasBalanceBadgeBg />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    height: 106,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors2024['neutral-bg-1'],
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 1,
    },
  },
  textBlock: {
    alignSelf: 'flex-start',
    gap: 4,
  },
  amount: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
}));
