import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsAccountViewModel } from '../../model/account';
import { formatPerpsProUsdValue } from '../../utils/format';

interface PerpsProAccountSummaryProps {
  account: PerpsAccountViewModel;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export const PerpsProAccountSummary: React.FC<PerpsProAccountSummaryProps> =
  React.memo(({ account, onDeposit, onWithdraw }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const pnl = Number(account.unrealizedPnl);

    return (
      <View style={styles.container} testID="perps-pro-account-summary">
        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>
              {t('page.perps.pro.account.totalValue')}
            </Text>
            <Text style={styles.primaryValue}>
              {formatPerpsProUsdValue(account.primaryValue)}
            </Text>
          </View>
          <View style={styles.pnlColumn}>
            <Text style={styles.label}>
              {t('page.perps.pro.account.unrealizedPnl')}
            </Text>
            <Text
              style={
                pnl > 0
                  ? styles.positiveValue
                  : pnl < 0
                  ? styles.negativeValue
                  : styles.value
              }>
              {formatPerpsProUsdValue(account.unrealizedPnl, {
                signed: true,
              })}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDeposit}
            style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>
              {t('page.perps.pro.account.deposit')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onWithdraw}
            style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>
              {t('page.perps.pro.account.withdraw')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  });

PerpsProAccountSummary.displayName = 'PerpsProAccountSummary';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-bg-5'],
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    marginHorizontal: 15,
    marginTop: 16,
    padding: 12,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlColumn: {
    alignItems: 'flex-end',
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  primaryValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  positiveValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  negativeValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 6,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  primaryActionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 6,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
