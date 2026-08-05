import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsAccountMetric,
  PerpsAccountViewModel,
} from '../../model/account';
import {
  formatPerpsProPercent,
  formatPerpsProUsdValue,
} from '../../utils/format';

interface PerpsProAccountSummaryProps {
  account: PerpsAccountViewModel;
  onDeposit: () => void;
  onWithdraw: () => void;
}

const metricTranslationKey: Record<PerpsAccountMetric['key'], string> = {
  borrowCapUsed: 'page.perps.pro.account.borrowCapUsed',
  crossMarginRatio: 'page.perps.pro.account.crossMarginRatio',
  ltvAdjustedPortfolioValue: 'page.perps.pro.account.ltvAdjustedPortfolioValue',
  maintenanceMargin: 'page.perps.pro.account.maintenanceMargin',
  marginBalance: 'page.perps.pro.account.marginBalance',
  portfolioMarginRatio: 'page.perps.pro.account.portfolioMarginRatio',
  totalCollateralBalance: 'page.perps.pro.account.totalCollateralBalance',
  unifiedAccountRatio: 'page.perps.pro.account.unifiedAccountRatio',
};

const titleTranslationKey: Record<PerpsAccountViewModel['titleKey'], string> = {
  perpsAccountSummary: 'page.perps.pro.account.perpsAccountSummary',
  portfolioMarginSummary: 'page.perps.pro.account.portfolioMarginSummary',
  unifiedAccountSummary: 'page.perps.pro.account.unifiedAccountSummary',
};

export const PerpsProAccountSummary: React.FC<PerpsProAccountSummaryProps> =
  React.memo(({ account, onDeposit, onWithdraw }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const pnl = Number(account.unrealizedPnl);
    const primaryLabel =
      account.primaryKey === 'balance'
        ? t('page.perps.pro.account.balance')
        : t('page.perps.pro.account.portfolioValue');

    return (
      <View style={styles.container} testID="perps-pro-account-summary">
        <Text style={styles.title}>
          {t(titleTranslationKey[account.titleKey])}
        </Text>
        <View style={styles.summary}>
          <View>
            <Text style={styles.label}>{primaryLabel}</Text>
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
        <View style={styles.metrics}>
          {account.metrics.map(metric => (
            <View key={metric.key} style={styles.metric}>
              <Text numberOfLines={2} style={styles.metricLabel}>
                {t(metricTranslationKey[metric.key])}
              </Text>
              <Text style={styles.metricValue}>
                {metric.kind === 'ratio'
                  ? formatPerpsProPercent(
                      metric.value == null ? null : Number(metric.value),
                      2,
                      false,
                    )
                  : formatPerpsProUsdValue(metric.value)}
              </Text>
            </View>
          ))}
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
    borderColor: colors2024['neutral-line'],
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
    marginHorizontal: 15,
    marginTop: 16,
    padding: 12,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
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
  metrics: {
    borderTopColor: colors2024['neutral-line'],
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    rowGap: 12,
  },
  metric: {
    paddingRight: 8,
    width: '50%',
  },
  metricLabel: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  metricValue: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
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
    borderColor: colors2024['neutral-line'],
    borderRadius: 6,
    borderWidth: 1,
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
