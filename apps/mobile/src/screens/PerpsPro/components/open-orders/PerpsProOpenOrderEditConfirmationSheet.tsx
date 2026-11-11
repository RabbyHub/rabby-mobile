import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
  getPerpsProDialogCheckboxStyles,
} from '../common/perpsProDialogVisual';
import {
  getPerpsProListRowStyles,
  PERPS_PRO_DIALOG_LIST_CARD_PADDING,
} from '../common/perpsProListVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRegisterBlockingModal } from '@/utils/modalGate';
import {
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getOpenOrderEditDisplayAmount } from '../../model/openOrderEdit';
import type {
  PerpsProOpenOrderEditEditorState,
  PerpsProOpenOrderEditReviewState,
} from '../../scene/usePerpsProOpenOrderEdit';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import {
  PerpsProOpenOrderEditHeader,
  PerpsProOpenOrderEditDirection,
} from './PerpsProOpenOrderEditHeader';

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
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <PerpsProDialogBackdrop
          {...props}
          pressBehavior={pending ? 'none' : 'close'}
        />
      ),
      [pending],
    );
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
    const triggerLimit = !basic && editor.order.editKind === 'triggerLimit';
    const sheetHeight =
      // Stacked basic header and 30pt list rows (Figma 86609:343138).
      (basic ? 368 : 376) +
      styles.content.paddingBottom -
      BOTTOM_BUTTON_BOTTOM_OFFSET;
    const baseSize = basic
      ? review.command.replacement.baseSize
      : review.command.replacement.baseSize;
    const referencePrice = basic
      ? review.command.replacement.limitPrice
      : review.referencePrice;
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
          linearGradientType: 'bg0',
        })}
        backdropComponent={renderBackdrop}
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
              leverageConfiguration={
                editor.category === 'basic'
                  ? editor.leverageConfiguration
                  : null
              }
            />
            <View style={styles.details}>
              <PerpsProOpenOrderEditDirection
                order={editor.order}
                style={styles.detailRow}
              />
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
                    label={t('page.perps.pro.openOrders.triggerPrice')}
                    value={`${formatPerpsProPrice(
                      review.command.replacement.triggerPrice,
                      editor.market.pxDecimals,
                    )} ${editor.market.quoteAsset}`}
                  />
                  <DetailRow
                    label={t(
                      triggerLimit
                        ? 'page.perps.pro.openOrders.limitPrice'
                        : 'page.perps.pro.openOrders.price',
                    )}
                    value={
                      triggerLimit
                        ? `${formatPerpsProPrice(
                            review.command.replacement.limitPrice,
                            editor.market.pxDecimals,
                          )} ${editor.market.quoteAsset}`
                        : t('page.perps.pro.openOrders.marketPrice')
                    }
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
              <PerpsProCheckboxIcon
                checked={skipConfirmation}
                checkColor={colors2024['neutral-InvertHighlight']}
              />
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
                buttonStyle={[styles.button, pending && styles.buttonDisabled]}
                disabledTitleStyle={styles.buttonDisabledTitle}
                disabled={pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                loadingProps={{ color: styles.buttonDisabledTitle.color }}
                onPress={onConfirm}
                testID="perps-pro-open-order-edit-final-confirm"
                title={t('global.confirm')}
                titleStyle={styles.buttonTitle}
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

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      position: 'relative',
    },
    details: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      ...PERPS_PRO_DIALOG_LIST_CARD_PADDING,
      marginTop: 24,
    },
    detailRow: getPerpsProListRowStyles(colors2024).listRow,
    detailLabel: getPerpsProListRowStyles(colors2024).listLabel,
    detailValue: {
      ...getPerpsProListRowStyles(colors2024).listValue,
      flexShrink: 1,
      marginLeft: 16,
      textAlign: 'right',
    },
    ...getPerpsProDialogCheckboxStyles(colors2024),
    footer: {
      left: 20,
      position: 'absolute',
      right: 20,
    },
    basicFooter: {
      top: 240,
    },
    conditionalFooter: {
      top: 248,
    },
  }),
);
