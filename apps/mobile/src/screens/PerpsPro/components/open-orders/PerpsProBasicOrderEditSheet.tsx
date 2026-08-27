import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BOTTOM_BUTTON_COMPACT_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getOpenOrderEditDisplayAmount,
  resolveBasicOrderEditBaseSize,
  type PerpsProBasicOrderEditDraft,
} from '../../model/openOrderEdit';
import {
  getPerpsProAmountInputDecimals,
  getPerpsProPriceInputMaxDecimals,
  isPerpsProPriceProtocolValid,
} from '../../model/trade';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from '../common/perpsProVisual';
import type { PerpsProOpenOrderEditEditorState } from '../../scene/usePerpsProOpenOrderEdit';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { PerpsProOpenOrderEditHeader } from './PerpsProOpenOrderEditHeader';
import { PerpsProOpenOrderEditInput } from './PerpsProOpenOrderEditInput';

const MODAL_ID = 'perps-pro-basic-order-edit';
const SHEET_HEIGHT = 326;
const CONTENT_HEIGHT = SHEET_HEIGHT - 40;

export const PerpsProBasicOrderEditSheet: React.FC<{
  coveredByReview: boolean;
  editor: Extract<PerpsProOpenOrderEditEditorState, { category: 'basic' }>;
  onClose: () => void;
  onReview: (draft: PerpsProBasicOrderEditDraft) => void;
  reviewRequesting?: boolean;
  visible: boolean;
}> = React.memo(props => {
  const {
    coveredByReview,
    editor,
    onClose,
    onReview,
    reviewRequesting = false,
    visible,
  } = props;
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const dismissKeyboardThen = usePerpsProDismissKeyboard();
  const initialPrice = editor.order.executionPrice || '';
  const [price, setPrice] = useState(initialPrice);
  const [manualAmount, setManualAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const interactionLocked = coveredByReview || reviewRequesting;
  usePerpsProSheetNavigationRegistration({
    active: visible,
    dismiss: onClose,
    dismissible: !interactionLocked,
  });
  useRegisterBlockingModal(MODAL_ID, visible);

  useEffect(() => {
    if (visible) modalRef.current?.present();
    else modalRef.current?.close();
  }, [visible]);

  const untouchedAmount = getOpenOrderEditDisplayAmount({
    amountUnit: editor.amountUnit,
    baseSize: editor.order.remainingSize,
    referencePrice: price,
  });
  const amountDecimals =
    editor.amountUnit === 'base' ? editor.market.szDecimals : 2;
  const amount = amountTouched
    ? manualAmount
    : untouchedAmount
    ? new BigNumber(untouchedAmount)
        .decimalPlaces(amountDecimals, BigNumber.ROUND_DOWN)
        .toFixed(amountDecimals)
    : '';
  const currentAmount = getOpenOrderEditDisplayAmount({
    amountUnit: editor.amountUnit,
    baseSize: editor.order.remainingSize,
    referencePrice: initialPrice,
  });
  const baseSize = resolveBasicOrderEditBaseSize({
    amountUnit: editor.amountUnit,
    draft: { amount, amountTouched, price },
    remainingSize: editor.order.remainingSize,
    szDecimals: editor.market.szDecimals,
  });
  const oppositeAmount = getOpenOrderEditDisplayAmount({
    amountUnit: editor.amountUnit === 'base' ? 'quote' : 'base',
    baseSize: baseSize || '',
    referencePrice: price,
  });
  const displayUnit =
    editor.amountUnit === 'base'
      ? editor.market.displayBase
      : editor.market.quoteAsset;
  const oppositeUnit =
    editor.amountUnit === 'base'
      ? editor.market.quoteAsset
      : editor.market.displayBase;
  const oppositeDecimals =
    editor.amountUnit === 'base' ? 2 : editor.market.szDecimals;
  const canReview = useMemo(() => {
    const nextPrice = new BigNumber(price || Number.NaN);
    const nextSize = new BigNumber(baseSize || Number.NaN);
    if (
      !nextPrice.isFinite() ||
      !nextPrice.gt(0) ||
      !nextSize.gt(0) ||
      !isPerpsProPriceProtocolValid(price, editor.market.szDecimals)
    ) {
      return false;
    }
    return (
      !nextPrice.eq(initialPrice) || !nextSize.eq(editor.order.remainingSize)
    );
  }, [
    baseSize,
    editor.market.szDecimals,
    editor.order.remainingSize,
    initialPrice,
    price,
  ]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      android_keyboardInputMode="adjustPan"
      backdropProps={{ pressBehavior: interactionLocked ? 'none' : 'close' }}
      backgroundStyle={styles.background}
      enableDynamicSizing={false}
      enablePanDownToClose={!interactionLocked}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onClose}
      snapPoints={[SHEET_HEIGHT]}
      style={styles.modal}>
      <BottomSheetView>
        <AutoLockView
          pointerEvents={interactionLocked ? 'none' : 'auto'}
          style={styles.container}
          testID="perps-pro-basic-order-edit-content">
          <PerpsProOpenOrderEditHeader
            market={editor.market}
            order={editor.order}
          />
          <View style={styles.form}>
            <PerpsProOpenOrderEditInput
              accessibilityLabel={t('page.perps.pro.openOrders.price')}
              currentValue={`Current ${formatPerpsProPrice(
                initialPrice,
                editor.market.pxDecimals,
              )}`}
              label={t('page.perps.pro.openOrders.price')}
              maxDecimals={getPerpsProPriceInputMaxDecimals(
                editor.market.szDecimals,
              )}
              onChangeText={setPrice}
              priceSzDecimals={editor.market.szDecimals}
              testID="perps-pro-basic-order-edit-price"
              unit={editor.market.quoteAsset}
              value={price}
            />
            <View style={styles.amountGroup}>
              <PerpsProOpenOrderEditInput
                accessibilityLabel={t('page.perps.pro.openOrders.amount')}
                currentValue={`Current ${formatPerpsProDecimal(
                  currentAmount,
                  amountDecimals,
                )}`}
                label={t('page.perps.pro.openOrders.amount')}
                maxDecimals={getPerpsProAmountInputDecimals({
                  amountUnit: editor.amountUnit,
                  szDecimals: editor.market.szDecimals,
                })}
                onChangeText={value => {
                  setAmountTouched(true);
                  setManualAmount(value);
                }}
                testID="perps-pro-basic-order-edit-amount"
                unit={displayUnit}
                value={amount}
              />
              <Text style={styles.conversion}>
                ≈{formatPerpsProDecimal(oppositeAmount, oppositeDecimals)}{' '}
                {oppositeUnit}
              </Text>
            </View>
          </View>
          <View
            style={styles.footer}
            testID="perps-pro-basic-order-edit-footer">
            <Button
              buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
              disabled={!canReview || interactionLocked}
              height={BOTTOM_BUTTON_COMPACT_HEIGHT}
              onPress={() =>
                dismissKeyboardThen(() =>
                  onReview({ amount, amountTouched, price }),
                )
              }
              testID="perps-pro-basic-order-edit-confirm"
              title={t('global.confirm')}
              titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
              type="primary"
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProBasicOrderEditSheet.displayName = 'PerpsProBasicOrderEditSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  container: {
    height: CONTENT_HEIGHT,
    paddingHorizontal: 15,
    paddingTop: 8,
    position: 'relative',
  },
  form: { gap: 24, marginTop: 16 },
  amountGroup: { gap: 4 },
  conversion: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    left: 15,
    position: 'absolute',
    right: 15,
    top: 210,
  },
}));
