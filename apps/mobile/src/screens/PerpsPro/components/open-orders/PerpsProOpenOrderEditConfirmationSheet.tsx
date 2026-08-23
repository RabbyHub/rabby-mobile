import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
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
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getOpenOrderEditDisplayAmount } from '../../model/openOrderEdit';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from '../common/perpsProVisual';
import type {
  PerpsProOpenOrderEditEditorState,
  PerpsProOpenOrderEditReviewState,
} from '../../scene/usePerpsProOpenOrderEdit';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProOpenOrderEditHeader } from './PerpsProOpenOrderEditHeader';

const MODAL_ID = 'perps-pro-open-order-edit-confirmation';

export const PerpsProOpenOrderEditConfirmationSheet: React.FC<{
  editor: PerpsProOpenOrderEditEditorState;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipConfirmation: () => void;
  pending: boolean;
  review: PerpsProOpenOrderEditReviewState | null;
  skipConfirmation: boolean;
}> = React.memo(
  ({
    editor,
    onClose,
    onConfirm,
    onToggleSkipConfirmation,
    pending,
    review,
    skipConfirmation,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: !!review,
      dismiss: onClose,
      dismissible: !pending,
    });
    useRegisterBlockingModal(MODAL_ID, !!review);

    useEffect(() => {
      if (review) modalRef.current?.present();
      else modalRef.current?.close();
    }, [review]);

    if (!review || review.category !== editor.category) return null;
    const basic = review.category === 'basic';
    const sheetHeight = basic ? 302 : 326;
    const baseSize = basic
      ? review.command.replacement.baseSize
      : review.command.legs[0]?.size || '0';
    const referencePrice = basic
      ? review.command.replacement.limitPrice
      : review.markPrice;
    const displayAmount = getOpenOrderEditDisplayAmount({
      amountUnit: editor.amountUnit,
      baseSize,
      referencePrice,
    });
    const amountDecimals =
      editor.amountUnit === 'base' ? editor.market.szDecimals : 2;
    const amountUnit =
      editor.amountUnit === 'base'
        ? editor.market.displayBase
        : editor.market.quoteAsset;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropProps={{ pressBehavior: pending ? 'none' : 'close' }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        snapPoints={[sheetHeight]}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView
            style={[styles.container, { height: sheetHeight - 40 }]}
            testID="perps-pro-open-order-edit-confirmation-content">
            <PerpsProOpenOrderEditHeader
              market={editor.market}
              order={editor.order}
            />
            <View style={styles.details}>
              {basic ? (
                <>
                  <DetailRow
                    label={t('page.perps.pro.openOrders.price')}
                    value={`${formatPerpsProPrice(
                      review.command.replacement.limitPrice,
                      editor.market.pxDecimals,
                    )} ${editor.market.quoteAsset}`}
                  />
                  <DetailRow
                    label={t('page.perps.pro.openOrders.amountAdjusted')}
                    value={`${formatPerpsProDecimal(
                      displayAmount,
                      amountDecimals,
                    )} ${amountUnit}`}
                  />
                </>
              ) : (
                <>
                  <DetailRow
                    label={t('page.perps.pro.openOrders.stopPrice')}
                    value={`${formatPerpsProPrice(
                      review.command.legs[0]?.triggerPrice,
                      editor.market.pxDecimals,
                    )} ${editor.market.quoteAsset}`}
                  />
                  <DetailRow
                    label={t('page.perps.pro.openOrders.price')}
                    value={t('page.perps.pro.openOrders.marketPrice')}
                  />
                  <DetailRow
                    label={t('page.perps.pro.openOrders.amount')}
                    value={`${formatPerpsProDecimal(
                      displayAmount,
                      amountDecimals,
                    )} ${amountUnit}`}
                  />
                </>
              )}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: skipConfirmation,
                disabled: pending,
              }}
              disabled={pending}
              onPress={onToggleSkipConfirmation}
              style={styles.checkboxRow}
              testID="perps-pro-open-order-edit-skip-confirmation">
              {skipConfirmation ? (
                <RcCheckboxFilledBrand height={20} width={20} />
              ) : (
                <RcCheckboxEmptyCC
                  color={colors2024['neutral-secondary']}
                  height={20}
                  width={20}
                />
              )}
              <Text style={styles.checkboxText}>
                {t('page.perps.pro.openOrders.dontShowAgain')}
              </Text>
            </Pressable>
            <View
              style={[
                styles.footer,
                basic ? styles.basicFooter : styles.conditionalFooter,
              ]}
              testID="perps-pro-open-order-edit-confirmation-footer">
              <Button
                buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
                disabled={pending}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                testID="perps-pro-open-order-edit-final-confirm"
                title={t('global.confirm')}
                titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
                type="primary"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProOpenOrderEditConfirmationSheet.displayName =
  'PerpsProOpenOrderEditConfirmationSheet';

const DetailRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  container: {
    paddingHorizontal: 15,
    paddingTop: 8,
    position: 'relative',
  },
  details: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingBottom: 12,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  detailValue: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 16,
    textAlign: 'right',
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    minHeight: 20,
  },
  checkboxText: {
    color: colors2024['neutral-body'],
    flex: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    left: 15,
    position: 'absolute',
    right: 15,
  },
  basicFooter: {
    top: 186,
  },
  conditionalFooter: {
    top: 210,
  },
}));
