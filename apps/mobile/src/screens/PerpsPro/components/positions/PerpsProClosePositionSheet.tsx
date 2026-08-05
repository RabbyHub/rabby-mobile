import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { PerpsProSlider } from '../common/PerpsProSlider';

const calculateEstimatedPnl = (
  position: PerpsPositionViewModel,
  exitPrice: string,
  size: string,
) => {
  const entry = new BigNumber(position.entryPrice ?? NaN);
  const exit = new BigNumber(exitPrice);
  const amount = new BigNumber(size);
  if (!entry.isFinite() || !exit.isFinite() || !amount.isFinite()) return null;
  const delta =
    position.direction === 'long' ? exit.minus(entry) : entry.minus(exit);
  return delta.multipliedBy(amount).toString();
};

export const PerpsProClosePositionSheet: React.FC<{
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onReview: (draft: PerpsProCloseDraft) => void;
  position: PerpsPositionViewModel;
  visible: boolean;
}> = React.memo(({ market, onClose, onReview, position, visible }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [percent, setPercent] = useState(100);
  const [limitPrice, setLimitPrice] = useState(market.markPrice);

  useEffect(() => {
    if (visible) {
      setOrderType('market');
      setPercent(100);
      setLimitPrice(market.markPrice);
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [market.markPrice, visible]);

  const size = useMemo(
    () =>
      new BigNumber(position.baseSize)
        .multipliedBy(percent)
        .dividedBy(100)
        .decimalPlaces(market.szDecimals, BigNumber.ROUND_DOWN)
        .toFixed(),
    [market.szDecimals, percent, position.baseSize],
  );
  const exitPrice = orderType === 'market' ? market.markPrice : limitPrice;
  const estimatedPnl = calculateEstimatedPnl(position, exitPrice, size);
  const valid =
    new BigNumber(size).gt(0) &&
    (orderType === 'market' || new BigNumber(limitPrice).gt(0));

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onClose}
      snapPoints={[500]}>
      <BottomSheetView style={styles.sheetView}>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>
            {t('page.perps.pro.positions.closePosition')}
          </Text>
          <View style={styles.segmented}>
            {(['market', 'limit'] as const).map(type => (
              <Pressable
                key={type}
                onPress={() => setOrderType(type)}
                style={[
                  styles.segment,
                  orderType === type ? styles.segmentActive : null,
                ]}>
                <Text
                  style={
                    orderType === type
                      ? styles.segmentTextActive
                      : styles.segmentText
                  }>
                  {t(`page.perps.pro.positions.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {t('page.perps.pro.positions.amount')}
            </Text>
            <View style={styles.fieldValueRow}>
              <Text style={styles.fieldValue}>
                {formatPerpsProDecimal(size, market.szDecimals)}
              </Text>
              <Text style={styles.fieldUnit}>{market.displayBase}</Text>
            </View>
          </View>
          {orderType === 'limit' ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {t('page.perps.pro.positions.limitPrice')}
              </Text>
              <View style={styles.fieldValueRow}>
                <BottomSheetTextInput
                  keyboardType="decimal-pad"
                  onChangeText={setLimitPrice}
                  style={styles.priceInput}
                  value={limitPrice}
                />
                <Text style={styles.fieldUnit}>{market.quoteAsset}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.sliderRow}>
            <PerpsProSlider
              maximumValue={100}
              minimumValue={1}
              onValueChange={next => setPercent(Math.round(next))}
              step={1}
              value={percent}
            />
            <Text style={styles.percent}>{percent}%</Text>
          </View>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t('page.perps.pro.positions.positionAmount')}
              </Text>
              <Text style={styles.summaryValue}>
                {formatPerpsProDecimal(position.baseSize, market.szDecimals)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {t('page.perps.pro.positions.estimatedPnl')}
              </Text>
              <Text style={styles.summaryValue}>
                {formatPerpsProDecimal(estimatedPnl, 2)} {market.quoteAsset}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Button
              disabled={!valid}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              onPress={() =>
                onReview({
                  limitPrice: orderType === 'limit' ? limitPrice : null,
                  orderType,
                  percent,
                  size,
                })
              }
              title={t('global.confirm')}
              titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
              type="hyperliquid"
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProClosePositionSheet.displayName = 'PerpsProClosePositionSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  sheetView: { height: '100%' },
  container: { height: '100%', paddingHorizontal: 20, paddingTop: 8 },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  segmented: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    flexDirection: 'row',
    marginTop: 20,
    padding: 2,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors2024['neutral-bg-1'] },
  segmentText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  segmentTextActive: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  field: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  fieldValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  fieldValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
  },
  priceInput: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    marginRight: 8,
    padding: 0,
  },
  fieldUnit: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  sliderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  percent: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    minWidth: 40,
    textAlign: 'right',
  },
  summary: { gap: 8, marginTop: 16 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  summaryValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
