import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import BigNumber from 'bignumber.js';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  calculatePartialTpSlCoverage,
  calculatePositionTpSlEstimatedPnl,
  sortPartialPositionTpSlOrders,
  type PerpsPositionTpSlKind,
  type PerpsPositionTpSlMarketSnapshot,
  type PerpsPositionTpSlOrderViewModel,
} from '../../model/positionTpSl';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';

export const PerpsProPositionTpSlOrderList: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  cancelingOids: readonly number[];
  markPrice: string | null;
  market: PerpsPositionTpSlMarketSnapshot;
  onAdd: () => void;
  onCancelOrder: (order: PerpsPositionTpSlOrderViewModel) => void;
  onModify: (order: PerpsPositionTpSlOrderViewModel) => void;
  pending: boolean;
  position: PerpsPositionViewModel;
}> = React.memo(
  ({
    amountUnit,
    cancelingOids,
    markPrice,
    market,
    onAdd,
    onCancelOrder,
    onModify,
    pending,
    position,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const orders = useMemo(
      () =>
        sortPartialPositionTpSlOrders(position.tpslOrders, position.direction),
      [position.direction, position.tpslOrders],
    );

    return (
      <View style={styles.list}>
        <View style={styles.addRow}>
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={onAdd}
            style={styles.addButton}
            testID="perps-pro-position-tpsl-add">
            <Text style={styles.addButtonText}>
              {t('page.perps.pro.positionTpsl.addButton')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.groups}>
          {(['takeProfit', 'stopLoss'] as const).map(kind => {
            const group = orders.filter(order => order.kind === kind);
            if (group.length === 0) {
              return null;
            }
            const coverage = calculatePartialTpSlCoverage(
              group,
              position.baseSize,
            );
            return (
              <View key={kind} style={styles.group}>
                <View style={styles.groupHeading}>
                  <View style={styles.groupTitle}>
                    <View
                      style={
                        kind === 'takeProfit'
                          ? styles.takeProfitBar
                          : styles.stopLossBar
                      }
                    />
                    <Text style={styles.groupTitleText}>
                      {t(
                        kind === 'takeProfit'
                          ? 'page.perps.pro.positionTpsl.takeProfit'
                          : 'page.perps.pro.positionTpsl.stopLoss',
                      )}
                    </Text>
                  </View>
                  <Text style={styles.coverage}>
                    {t('page.perps.pro.positionTpsl.positionSizeCoverage', {
                      percent: formatPerpsProPercent(
                        coverage == null ? null : Number(coverage),
                        2,
                        false,
                      ),
                    })}
                  </Text>
                </View>
                <View style={styles.orderRows}>
                  {group.map(order => (
                    <PartialOrderRow
                      amountUnit={amountUnit}
                      canceling={cancelingOids.includes(order.oid)}
                      key={order.key}
                      kind={kind}
                      markPrice={markPrice}
                      market={market}
                      onCancel={() => onCancelOrder(order)}
                      onModify={() => onModify(order)}
                      order={order}
                      pending={pending}
                      position={position}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  },
);

PerpsProPositionTpSlOrderList.displayName = 'PerpsProPositionTpSlOrderList';

const PartialOrderRow: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  canceling: boolean;
  kind: PerpsPositionTpSlKind;
  markPrice: string | null;
  market: PerpsPositionTpSlMarketSnapshot;
  onCancel: () => void;
  onModify: () => void;
  order: PerpsPositionTpSlOrderViewModel;
  pending: boolean;
  position: PerpsPositionViewModel;
}> = ({
  amountUnit,
  canceling,
  kind,
  markPrice,
  market,
  onCancel,
  onModify,
  order,
  pending,
  position,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const coverage = new BigNumber(order.remainingSize).dividedBy(
    position.baseSize,
  );
  const displayAmount =
    amountUnit === 'base'
      ? order.remainingSize
      : markPrice
      ? new BigNumber(order.remainingSize).multipliedBy(markPrice).toString()
      : null;
  const amountAsset =
    amountUnit === 'base' ? market.displayBase : market.quoteAsset;
  const pnl = calculatePositionTpSlEstimatedPnl({
    direction: position.direction,
    entryPrice: position.entryPrice,
    size: order.remainingSize,
    triggerPrice: order.triggerPrice,
  });

  return (
    <View
      style={styles.orderRow}
      testID={`perps-pro-position-tpsl-order-${order.oid}`}>
      <View style={styles.triggerRow}>
        <Text style={styles.triggerLabel}>
          {t('page.perps.pro.positionTpsl.triggerPrice')}
        </Text>
        <Text
          style={
            kind === 'takeProfit'
              ? styles.takeProfitValue
              : styles.stopLossValue
          }>
          {formatPerpsProPrice(order.triggerPrice, market.pxDecimals)}
        </Text>
      </View>
      <View style={styles.orderMetrics}>
        <OrderMetric
          flex={128}
          label={`${t('page.perps.pro.positionTpsl.estimatedPnl')} (${
            market.quoteAsset
          })`}
          tone={kind === 'takeProfit' ? 'positive' : 'negative'}
          value={pnl == null ? '-' : formatPerpsProSignedDecimal(pnl, 2)}
        />
        <OrderMetric
          flex={116}
          label={t('page.perps.pro.positions.price')}
          value={t('page.perps.pro.positions.market')}
        />
        <OrderMetric
          flex={103}
          label={`${t(
            'page.perps.pro.positionTpsl.unfilledAmount',
          )} (${amountAsset})`}
          textAlign="right"
          testID={`perps-pro-position-tpsl-order-${order.oid}-unfilled`}
          value={`${formatPerpsProDecimal(
            displayAmount,
            amountUnit === 'base' ? market.szDecimals : 2,
          )}(${formatPerpsProPercent(Number(coverage), 2, false)})`}
        />
      </View>
      <View style={styles.orderActions}>
        <Pressable
          accessibilityRole="button"
          disabled={pending || canceling}
          onPress={onModify}
          style={styles.orderAction}>
          <Text style={styles.orderActionText}>
            {t('page.perps.pro.positionTpsl.modify')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={pending || canceling}
          onPress={onCancel}
          style={styles.orderAction}>
          <Text style={styles.orderActionText}>{t('global.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const OrderMetric: React.FC<{
  flex: number;
  label: string;
  testID?: string;
  textAlign?: 'left' | 'right';
  tone?: 'negative' | 'neutral' | 'positive';
  value: string;
}> = ({ flex, label, testID, textAlign = 'left', tone = 'neutral', value }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View
      style={[
        styles.orderMetric,
        textAlign === 'right' && styles.orderMetricRight,
        { flex },
      ]}
      testID={testID}>
      <Text
        numberOfLines={1}
        style={[
          styles.orderMetricLabel,
          textAlign === 'right' && styles.orderMetricRightLabel,
        ]}
        testID={testID ? `${testID}-label` : undefined}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          tone === 'positive'
            ? styles.positiveMetricValue
            : tone === 'negative'
            ? styles.negativeMetricValue
            : styles.orderMetricValue,
          textAlign === 'right' && styles.orderMetricRightValue,
        ]}
        testID={testID ? `${testID}-value` : undefined}>
        {value}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: { paddingBottom: 40, paddingHorizontal: 15 },
  addRow: { alignItems: 'flex-end', height: 42, paddingTop: 8 },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  addButtonText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  groups: { gap: 24, paddingTop: 8 },
  group: {},
  groupHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 18,
    justifyContent: 'space-between',
  },
  groupTitle: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  takeProfitBar: {
    backgroundColor: colors2024['green-default'],
    borderRadius: 2,
    height: 18,
    width: 4,
  },
  stopLossBar: {
    backgroundColor: colors2024['red-default'],
    borderRadius: 2,
    height: 18,
    width: 4,
  },
  groupTitleText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  coverage: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  orderRows: { gap: 12, paddingTop: 12 },
  orderRow: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  triggerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 18,
  },
  triggerLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  orderMetrics: { flexDirection: 'row', gap: 8, marginTop: 8 },
  orderMetric: { height: 36, minWidth: 0 },
  orderMetricRight: {
    alignItems: 'flex-end',
    // Keep auto-width absolute Text in Yoga's MaxContent measurement mode.
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  orderMetricRightLabel: {
    flexShrink: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    top: 0,
  },
  orderMetricRightValue: {
    flexShrink: 0,
    marginTop: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'right',
    top: 20,
  },
  orderMetricLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  orderMetricValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
  },
  positiveMetricValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
  },
  negativeMetricValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
  },
  takeProfitValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  stopLossValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  orderActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  orderAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    flex: 1,
    height: 26,
    justifyContent: 'center',
  },
  orderActionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
