import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
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
import { MODAL_GATE_IDS, useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  resolvePerpsProDisplayAmount,
  type PerpsProTradeAmountUnit,
} from '../../model/trade';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';

export const PerpsProCloseConfirmationSheet: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  draft: PerpsProCloseDraft;
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipLimit: () => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  skipLimitConfirmation: boolean;
  visible: boolean;
}> = React.memo(
  ({
    draft,
    amountUnit = 'quote',
    market,
    onClose,
    onConfirm,
    onToggleSkipLimit,
    pending,
    position,
    skipLimitConfirmation,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    useRegisterBlockingModal(MODAL_GATE_IDS.perpsProCloseConfirmation, visible);

    useEffect(() => {
      if (visible) modalRef.current?.present();
      else modalRef.current?.close();
    }, [visible]);

    const isSell = position.direction === 'long';
    const price =
      draft.orderType === 'market' ? market.markPrice : draft.limitPrice;
    const displayAmount = resolvePerpsProDisplayAmount({
      amountUnit,
      baseAmount: draft.size,
      price,
    });
    const displayUnit =
      amountUnit === 'base' ? market.displayBase : market.quoteAsset;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        snapPoints={[430]}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>
              {t('page.perps.pro.positions.confirmClose')}
            </Text>
            <Text style={styles.symbol}>{market.displayPair}</Text>
            <View style={styles.sideRow}>
              <Text style={isSell ? styles.sell : styles.buy}>
                {isSell
                  ? t('page.perps.pro.openOrders.sell')
                  : t('page.perps.pro.openOrders.buy')}
              </Text>
              <Text style={styles.direction}>
                / {t(`page.perps.pro.positions.${position.direction}`)}
              </Text>
            </View>
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.positions.price')}
                </Text>
                <Text style={styles.detailValue}>
                  {draft.orderType === 'market'
                    ? t('page.perps.pro.positions.market')
                    : formatPerpsProPrice(price, market.pxDecimals)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.positions.amount')}
                </Text>
                <Text style={styles.detailValue}>
                  {formatPerpsProDecimal(
                    displayAmount,
                    amountUnit === 'base' ? market.szDecimals : 2,
                  )}{' '}
                  {displayUnit}
                </Text>
              </View>
            </View>
            {draft.orderType === 'limit' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: skipLimitConfirmation }}
                onPress={onToggleSkipLimit}
                style={styles.checkboxRow}>
                {skipLimitConfirmation ? (
                  <RcCheckboxFilledBrand height={20} width={20} />
                ) : (
                  <RcCheckboxEmptyCC
                    color={colors2024['neutral-secondary']}
                    height={20}
                    width={20}
                  />
                )}
                <Text style={styles.checkboxText}>
                  {t('page.perps.pro.positions.skipLimitConfirmation')}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.footer}>
              <Button
                disabled={pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                title={t('page.perps.pro.positions.confirmClose')}
                titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
                type="hyperliquid"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProCloseConfirmationSheet.displayName = 'PerpsProCloseConfirmationSheet';

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
  symbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 24,
    textAlign: 'center',
  },
  sideRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  sell: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  buy: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  direction: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  details: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    gap: 12,
    marginTop: 20,
    padding: 12,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  detailValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  checkboxText: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
