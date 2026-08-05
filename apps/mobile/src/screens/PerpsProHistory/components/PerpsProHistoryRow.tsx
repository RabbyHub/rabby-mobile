import BigNumber from 'bignumber.js';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  formatPerpsProTime,
  formatPerpsProUsdValue,
} from '@/screens/PerpsPro/utils/format';
import { createGetStyles2024 } from '@/utils/styles';

import type {
  PerpsProFundingHistoryRow,
  PerpsProHistoryRow,
  PerpsProOrderHistoryRow,
  PerpsProTradeHistoryRow,
  PerpsProTransactionHistoryRow,
} from '../types';

type Tone = 'negative' | 'neutral' | 'positive';

type Detail = {
  label: string;
  tone?: Tone;
  value: string;
};

const titleCase = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .replace(/\b\w/gu, character => character.toUpperCase());

const getSignedTone = (value: string): Tone => {
  const decimal = new BigNumber(value || 0);
  if (!decimal.isFinite() || decimal.isZero()) {
    return 'neutral';
  }
  return decimal.gt(0) ? 'positive' : 'negative';
};

const HistoryRowLayout: React.FC<{
  badge: string;
  badgeTone: Tone;
  details: Detail[];
  sourceTag?: string | null;
  testID: string;
  time: number;
  title: string;
}> = ({ badge, badgeTone, details, sourceTag, testID, time, title }) => {
  const { styles } = useTheme2024({ getStyle });
  const badgeStyle =
    badgeTone === 'positive'
      ? styles.positiveBadge
      : badgeTone === 'negative'
      ? styles.negativeBadge
      : styles.neutralBadge;
  const badgeTextStyle =
    badgeTone === 'positive'
      ? styles.positiveText
      : badgeTone === 'negative'
      ? styles.negativeText
      : styles.neutralBadgeText;

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {sourceTag ? (
              <View style={styles.sourceTag}>
                <Text style={styles.sourceText}>{sourceTag.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.time}>{formatPerpsProTime(time)}</Text>
        </View>
        <View style={badgeStyle}>
          <Text style={badgeTextStyle}>{badge}</Text>
        </View>
      </View>
      <View style={styles.details}>
        {details.map(detail => {
          const valueStyle =
            detail.tone === 'positive'
              ? styles.positiveValue
              : detail.tone === 'negative'
              ? styles.negativeValue
              : styles.value;
          return (
            <View key={detail.label} style={styles.detailRow}>
              <Text style={styles.label}>{detail.label}</Text>
              <Text numberOfLines={2} style={valueStyle}>
                {detail.value}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const OrderHistoryRow: React.FC<{ row: PerpsProOrderHistoryRow }> = ({
  row,
}) => {
  const { t } = useTranslation();
  const isBuy = row.side === 'buy';
  const formatAmount = (
    baseValue: string | null,
    quoteValue: string | null,
  ) => {
    const isBase = row.displayAmountUnit === 'base';
    const value = isBase ? baseValue : quoteValue;
    if (value == null) {
      return '-';
    }
    const formatted = formatPerpsProDecimal(
      value,
      isBase
        ? row.market.szDecimals ?? new BigNumber(value).decimalPlaces() ?? 2
        : 2,
    );
    return formatted === '-'
      ? '-'
      : `${formatted} ${
          isBase ? row.market.displayBase : row.market.quoteAsset
        }`;
  };
  return (
    <HistoryRowLayout
      badge={titleCase(row.status)}
      badgeTone={isBuy ? 'positive' : 'negative'}
      details={[
        {
          label: t('page.perps.pro.history.fields.type'),
          value: `${row.orderType} · ${
            isBuy
              ? t('page.perps.pro.history.buy')
              : t('page.perps.pro.history.sell')
          }`,
        },
        {
          label: t('page.perps.pro.history.fields.amount'),
          value: formatAmount(row.amountBase, row.amountQuote),
        },
        {
          label: t('page.perps.pro.history.fields.filled'),
          value: formatAmount(row.filledBase, row.filledQuote),
        },
        {
          label: t('page.perps.pro.history.fields.price'),
          value:
            row.priceKind === 'market'
              ? t('page.perps.pro.history.market')
              : `$${formatPerpsProPrice(
                  row.price,
                  row.market.pxDecimals ?? undefined,
                )}`,
        },
      ]}
      sourceTag={row.market.sourceTag}
      testID={`perps-pro-history-order-${row.key}`}
      time={row.time}
      title={row.market.displayPair}
    />
  );
};

const TradeHistoryRow: React.FC<{ row: PerpsProTradeHistoryRow }> = ({
  row,
}) => {
  const { t } = useTranslation();
  const isBuy = row.side === 'buy';
  const pnlTone = getSignedTone(row.netRealizedPnl);
  return (
    <HistoryRowLayout
      badge={row.direction}
      badgeTone={isBuy ? 'positive' : 'negative'}
      details={[
        {
          label: t('page.perps.pro.history.fields.price'),
          value: `$${formatPerpsProPrice(
            row.price,
            row.market.pxDecimals ?? undefined,
          )}`,
        },
        {
          label: t('page.perps.pro.history.fields.filled'),
          value: `${formatPerpsProDecimal(row.filledQuote, 2)} ${
            row.market.quoteAsset
          }`,
        },
        {
          label: t('page.perps.pro.history.fields.fee'),
          value: `${formatPerpsProDecimal(row.fee, 4)} ${row.feeToken}`,
        },
        {
          label: t('page.perps.pro.history.fields.netRealizedPnl'),
          tone: pnlTone,
          value: formatPerpsProUsdValue(row.netRealizedPnl, {
            decimals: 2,
            signed: true,
          }),
        },
      ]}
      sourceTag={row.market.sourceTag}
      testID={`perps-pro-history-trade-${row.key}`}
      time={row.time}
      title={row.market.displayPair}
    />
  );
};

const TransactionHistoryRow: React.FC<{
  row: PerpsProTransactionHistoryRow;
}> = ({ row }) => {
  const { t } = useTranslation();
  const isDeposit = row.direction === 'deposit';
  return (
    <HistoryRowLayout
      badge={
        isDeposit
          ? t('page.perps.pro.history.deposit')
          : t('page.perps.pro.history.withdraw')
      }
      badgeTone={isDeposit ? 'positive' : 'negative'}
      details={[
        {
          label: t('page.perps.pro.history.fields.amount'),
          value: `${formatPerpsProDecimal(row.amount, 4)} ${row.asset}`,
        },
      ]}
      testID={`perps-pro-history-transaction-${row.key}`}
      time={row.time}
      title={row.asset}
    />
  );
};

const FundingHistoryRow: React.FC<{ row: PerpsProFundingHistoryRow }> = ({
  row,
}) => {
  const { t } = useTranslation();
  const amountTone = getSignedTone(row.amount);
  return (
    <HistoryRowLayout
      badge={
        row.positionSide === 'long'
          ? t('page.perps.pro.history.long')
          : t('page.perps.pro.history.short')
      }
      badgeTone={row.positionSide === 'long' ? 'positive' : 'negative'}
      details={[
        {
          label: t('page.perps.pro.history.fields.funding'),
          tone: amountTone,
          value: formatPerpsProUsdValue(row.amount, {
            decimals: 4,
            signed: true,
          }),
        },
      ]}
      sourceTag={row.market.sourceTag}
      testID={`perps-pro-history-funding-${row.key}`}
      time={row.time}
      title={row.market.displayPair}
    />
  );
};

export const PerpsProHistoryRowView: React.FC<{
  row: PerpsProHistoryRow;
}> = React.memo(({ row }) => {
  switch (row.kind) {
    case 'orders':
      return <OrderHistoryRow row={row} />;
    case 'trade':
      return <TradeHistoryRow row={row} />;
    case 'transaction':
      return <TransactionHistoryRow row={row} />;
    case 'funding':
      return <FundingHistoryRow row={row} />;
  }
});

PerpsProHistoryRowView.displayName = 'PerpsProHistoryRowView';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  title: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sourceText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  time: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  positiveBadge: {
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 4,
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  negativeBadge: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 4,
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  neutralBadge: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  positiveText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  negativeText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  neutralBadgeText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  value: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 16,
    textAlign: 'right',
  },
  positiveValue: {
    color: colors2024['green-default'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 16,
    textAlign: 'right',
  },
  negativeValue: {
    color: colors2024['red-default'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 16,
    textAlign: 'right',
  },
}));
