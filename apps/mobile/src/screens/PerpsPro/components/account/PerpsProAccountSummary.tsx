import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { useShowPerpsPortfolioBreakdown } from '@/screens/PerpsShared/components/PerpsPortfolioBreakdownExplanation';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsAccountAssetRow,
  PerpsAccountViewModel,
} from '../../model/account';
import { formatPerpsProUsdValue } from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { PerpsProAccountAssetRow } from './PerpsProAccountAssetRow';
import { PerpsProAccountValue } from './PerpsProAccountValue';

// Figma 86609:327475: one card holds the summary, actions and asset rows.
const ACCOUNT_CARD_SHADOW = '0px 5px 20px 0px rgba(0, 0, 0, 0.06)';

interface PerpsProAccountSummaryProps {
  account: Pick<PerpsAccountViewModel, 'primaryValue' | 'unrealizedPnl'> & {
    assets?: PerpsAccountAssetRow[];
  };
  onDeposit: () => void;
  onSwap?: (coin: PerpsAccountAssetRow['coin']) => void;
  onTransfer?: (asset: PerpsAccountAssetRow) => void;
  onWithdraw: () => void;
}

export const PerpsProAccountSummary: React.FC<PerpsProAccountSummaryProps> =
  React.memo(({ account, onDeposit, onSwap, onTransfer, onWithdraw }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const { showPortfolioBreakdown } = useShowPerpsPortfolioBreakdown();
    const pnl = Number(account.unrealizedPnl);
    const portfolioValueLabel = t('page.perps.PerpsCard.portfolioValue');

    return (
      <View style={styles.container} testID="perps-pro-account-summary">
        <View style={styles.summary}>
          <View
            style={styles.summaryColumn}
            testID="perps-pro-account-portfolio-column">
            {/* Hidden only when every asset is zero. */}
            {Number(account.primaryValue) > 0 ? (
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
        <View style={styles.divider} />
        {account.assets?.length && onSwap && onTransfer ? (
          <View>
            {account.assets?.map(asset => (
              <PerpsProAccountAssetRow
                asset={asset}
                key={asset.key}
                onSwap={onSwap}
                onTransfer={onTransfer}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  });

PerpsProAccountSummary.displayName = 'PerpsProAccountSummary';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    backgroundColor:
      colors2024[isLight === false ? 'neutral-bg-2' : 'neutral-bg-1'],
    borderRadius: 14,
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    ...(isLight === false ? null : { boxShadow: ACCOUNT_CARD_SHADOW }),
  },
  summary: {
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  primaryValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  value: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  positiveValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  negativeValue: {
    ...PERPS_PRO_NUMBER_STYLE,
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
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 8,
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  actionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  divider: {
    backgroundColor: colors2024['neutral-bg-5'],
    height: 1,
    marginTop: 8,
  },
}));
