import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useShowPerpsPortfolioBreakdown } from '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsAccountViewModel } from '../../model/account';
import { formatPerpsProUsdValue } from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { PerpsProAccountValue } from './PerpsProAccountValue';

// Approved Account-only colors, matching Simple Account in both themes.
const ACCOUNT_ACTION_COLOR = '#23C0B0';
const ACCOUNT_ACTION_BACKGROUND = 'rgba(80, 210, 193, 0.1)';

interface PerpsProAccountSummaryProps {
  account: PerpsAccountViewModel;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export const PerpsProAccountSummary: React.FC<PerpsProAccountSummaryProps> =
  React.memo(({ account, onDeposit, onWithdraw }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const { hasNonPerpsAssets, showPortfolioBreakdown } =
      useShowPerpsPortfolioBreakdown();
    const pnl = Number(account.unrealizedPnl);
    const portfolioValueLabel = t('page.perps.PerpsCard.portfolioValue');

    return (
      <View style={styles.container} testID="perps-pro-account-summary">
        <View style={styles.summary}>
          <View
            style={styles.summaryColumn}
            testID="perps-pro-account-portfolio-column">
            {hasNonPerpsAssets ? (
              <PerpsProDottedUnderlineText
                accessibilityLabel={portfolioValueLabel}
                onPress={() =>
                  showPortfolioBreakdown(Number(account.primaryValue))
                }
                style={styles.label}
                testID="perps-pro-portfolio-value-breakdown">
                {portfolioValueLabel}
              </PerpsProDottedUnderlineText>
            ) : (
              <Text style={styles.label}>{portfolioValueLabel}</Text>
            )}
            <PerpsProAccountValue
              testID="perps-pro-account-portfolio-value"
              style={styles.primaryValue}
              value={formatPerpsProUsdValue(account.primaryValue)}
            />
          </View>
          <View
            style={[styles.summaryColumn, styles.pnlColumn]}
            testID="perps-pro-account-pnl-column">
            <Text style={styles.label}>
              {t('page.perps.pro.account.unrealizedPnl')}
            </Text>
            <PerpsProAccountValue
              testID="perps-pro-account-pnl-value"
              align="right"
              style={
                pnl > 0
                  ? styles.positiveValue
                  : pnl < 0
                  ? styles.negativeValue
                  : styles.value
              }
              value={formatPerpsProUsdValue(account.unrealizedPnl, {
                signed: true,
              })}
            />
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDeposit}
            style={styles.action}>
            <Text style={styles.actionText}>
              {t('page.perps.pro.account.deposit')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onWithdraw}
            style={styles.action}>
            <Text style={styles.actionText}>
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
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingBottom: 16,
  },
  summary: {
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  summaryColumn: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  pnlColumn: {
    alignItems: 'flex-end',
  },
  label: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  primaryValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  value: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  positiveValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  negativeValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    alignItems: 'center',
    backgroundColor: ACCOUNT_ACTION_BACKGROUND,
    borderRadius: 8,
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  actionText: {
    color: ACCOUNT_ACTION_COLOR,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
}));
