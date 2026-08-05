import RcIconEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import { usePerpsProMarketIdentity } from '../../scene/usePerpsProMarketIdentity';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProTime,
} from '../../utils/format';

const CancelButton: React.FC<{
  onPress: () => void;
  pending: boolean;
}> = ({ onPress, pending }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: pending }}
      disabled={pending}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cancelButton,
        pressed && styles.cancelButtonPressed,
      ]}>
      <Text style={styles.cancelText}>
        {t('page.perps.pro.openOrders.cancel')}
      </Text>
    </Pressable>
  );
};

const DisabledEdit: React.FC<{ label: string }> = ({ label }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      disabled
      style={styles.editIcon}>
      <RcIconEdit
        color={colors2024['neutral-secondary']}
        height={16}
        width={16}
      />
    </Pressable>
  );
};

export const PerpsProOpenOrderCard: React.FC<{
  cancelPending: boolean;
  onCancel: (order: PerpsOpenOrderViewModel) => void;
  order: PerpsOpenOrderViewModel;
}> = React.memo(({ cancelPending, onCancel, order }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const market = usePerpsProMarketIdentity(order.coin);
  const isBuy = order.side === 'buy';
  const displayBaseAmount = (value: string) =>
    formatPerpsProDecimal(value, market.szDecimals);
  const displayQuoteAmount = (value: string | null) =>
    formatPerpsProDecimal(value, 2);
  const executionPrice =
    order.executionPriceKind === 'market'
      ? t('page.perps.pro.openOrders.market')
      : formatPerpsProPrice(order.executionPrice, market.pxDecimals);
  const numericFilledRatio = Number(order.filledRatio);
  const filledRatio = Number.isFinite(numericFilledRatio)
    ? Math.max(0, Math.min(numericFilledRatio, 1))
    : 0;
  const progressWidth = `${filledRatio * 100}%` as `${number}%`;

  return (
    <View style={styles.row} testID={`perps-pro-order-${order.key}`}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.coin}>
              {market.displayPair}
            </Text>
            {market.sourceTag ? (
              <View style={styles.sourceTag}>
                <Text style={styles.sourceText}>
                  {market.sourceTag.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <View style={isBuy ? styles.buyTag : styles.sellTag}>
              <Text style={isBuy ? styles.buyText : styles.sellText}>
                {order.orderType}
              </Text>
            </View>
            <View style={isBuy ? styles.buyTag : styles.sellTag}>
              <Text style={isBuy ? styles.buyText : styles.sellText}>
                {isBuy
                  ? t('page.perps.pro.openOrders.buy')
                  : t('page.perps.pro.openOrders.sell')}
              </Text>
            </View>
            <Text style={styles.time}>
              {formatPerpsProTime(order.timestamp)}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {order.category === 'basic' ? (
            <View
              style={styles.progress}
              testID={`perps-pro-order-progress-${order.key}`}>
              <Text style={styles.progressText}>
                {formatPerpsProPercent(filledRatio, 0, false)}
              </Text>
              <View
                style={styles.progressTrack}
                testID={`perps-pro-order-progress-track-${order.key}`}>
                <View
                  style={[
                    isBuy ? styles.buyProgress : styles.sellProgress,
                    { width: progressWidth },
                  ]}
                  testID={`perps-pro-order-progress-fill-${order.key}`}
                />
              </View>
            </View>
          ) : null}
          <CancelButton
            onPress={() => onCancel(order)}
            pending={cancelPending}
          />
        </View>
      </View>

      <View style={styles.details}>
        {order.category === 'basic' ? (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.filled')} /{' '}
                {t('page.perps.pro.openOrders.amount')} ({market.displayBase})
              </Text>
              <Text style={styles.detailValue}>
                {displayBaseAmount(order.filledSize)} /{' '}
                {displayBaseAmount(order.amountBase)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.price')}
              </Text>
              <View style={styles.editableValue}>
                <Text style={styles.detailValue}>{executionPrice}</Text>
                <DisabledEdit label={t('page.perps.pro.openOrders.edit')} />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.amount')} ({market.quoteAsset})
              </Text>
              <Text style={styles.detailValue}>
                {displayQuoteAmount(order.displayAmountQuote)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.price')}
              </Text>
              <Text style={styles.detailValue}>{executionPrice}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.conditions')}
              </Text>
              <View style={styles.editableValue}>
                <Text style={styles.detailValue}>
                  {order.triggerCondition || '-'}
                </Text>
                <DisabledEdit label={t('page.perps.pro.openOrders.edit')} />
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>
                {t('page.perps.pro.openOrders.reduceOnly')}
              </Text>
              <Text style={styles.detailValue}>
                {order.reduceOnly
                  ? t('page.perps.pro.openOrders.yes')
                  : t('page.perps.pro.openOrders.no')}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
});

PerpsProOpenOrderCard.displayName = 'PerpsProOpenOrderCard';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    gap: 12,
    marginHorizontal: 15,
    paddingVertical: 8,
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
  coin: {
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
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  buyTag: {
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sellTag: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  buyText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  sellText: {
    color: colors2024['red-default'],
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
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  progress: {
    alignItems: 'center',
    gap: 2,
    height: 16,
    justifyContent: 'center',
    width: 32,
  },
  progressText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  progressTrack: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 1,
    height: 2,
    overflow: 'hidden',
    width: 32,
  },
  buyProgress: {
    backgroundColor: colors2024['green-default'],
    height: 2,
  },
  sellProgress: {
    backgroundColor: colors2024['red-default'],
    height: 2,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    width: 64,
  },
  cancelButtonPressed: {
    opacity: 0.6,
  },
  cancelText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    alignItems: 'center',
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
  detailValue: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 12,
    textAlign: 'right',
  },
  editableValue: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
  },
  editIcon: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
}));
