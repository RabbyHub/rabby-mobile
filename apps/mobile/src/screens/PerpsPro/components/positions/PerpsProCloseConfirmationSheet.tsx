import {
  getPerpsProDialogStyles,
  getPerpsProDialogCheckboxStyles,
  PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS, useRegisterBlockingModal } from '@/utils/modalGate';
import {
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import {
  resolvePerpsProDisplayAmount,
  type PerpsProTradeAmountUnit,
} from '../../model/trade';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProCloseMarketTag } from './PerpsProCloseMarketTag';

export const PerpsProCloseConfirmationSheet: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  draft: PerpsProCloseDraft;
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipConfirmation: () => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  skipConfirmation: boolean;
  visible: boolean;
}> = React.memo(
  ({
    draft,
    amountUnit = 'quote',
    market,
    onClose,
    onConfirm,
    onToggleSkipConfirmation,
    pending,
    position,
    skipConfirmation,
    visible,
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
      active: visible,
      dismiss: onClose,
      dismissible: !pending,
    });
    useRegisterBlockingModal(MODAL_GATE_IDS.perpsProCloseConfirmation, visible);

    useEffect(() => {
      if (visible) {
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [visible]);

    const isSell = position.direction === 'long';
    const displayAmount = resolvePerpsProDisplayAmount({
      amountUnit,
      baseAmount: draft.size,
      price: draft.referencePrice,
    });
    const displayUnit =
      amountUnit === 'base' ? market.displayBase : market.quoteAsset;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        snapPoints={[
          336 + styles.footer.paddingBottom - BOTTOM_BUTTON_BOTTOM_OFFSET,
        ]}
        style={styles.modal}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <View style={styles.heading}>
              <View style={styles.pairRow}>
                <Text style={styles.pair}>{market.displayPair}</Text>
                <PerpsProCloseMarketTag sourceTag={market.sourceTag} />
              </View>
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.trade.direction')}
                </Text>
                <Text
                  style={[
                    styles.direction,
                    isSell ? styles.sellText : styles.buyText,
                  ]}>
                  {t(
                    isSell
                      ? 'page.perps.pro.trade.sellShort'
                      : 'page.perps.pro.trade.buyLong',
                  )}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.positions.price')}
                </Text>
                <Text style={styles.detailValue}>
                  {draft.orderType === 'market'
                    ? t('page.perps.pro.positions.marketPrice')
                    : `${formatPerpsProPrice(
                        draft.limitPrice,
                        market.pxDecimals,
                      )} ${market.quoteAsset}`}
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

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              onPress={onToggleSkipConfirmation}
              style={styles.checkboxRow}>
              <PerpsProCheckboxIcon
                checked={skipConfirmation}
                checkColor={colors2024['neutral-InvertHighlight']}
              />
              <Text style={styles.checkboxText}>
                {t(
                  draft.orderType === 'market'
                    ? 'page.perps.pro.positions.skipMarketCloseConfirmation'
                    : 'page.perps.pro.positions.skipLimitConfirmation',
                )}
              </Text>
            </Pressable>

            <View style={styles.footer}>
              <Button
                buttonStyle={[styles.button, pending && styles.buttonDisabled]}
                disabledTitleStyle={styles.buttonDisabledTitle}
                disabled={pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                loadingProps={{ color: styles.buttonDisabledTitle.color }}
                onPress={onConfirm}
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

PerpsProCloseConfirmationSheet.displayName = 'PerpsProCloseConfirmationSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sheetView: { height: '100%' },
    container: { height: '100%', paddingHorizontal: 16, paddingTop: 8 },
    heading: { gap: 8 },
    pairRow: {
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    pair: {
      ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
      color: colors2024['neutral-title-1'],
      flexShrink: 1,
      fontSize: 20,
      lineHeight: 24,
    },
    direction: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 16,
    },
    buyText: { color: colors2024['green-default'] },
    sellText: { color: colors2024['red-default'] },
    details: {
      marginTop: 24,
      gap: 10,
      padding: 16,
      borderRadius: 12,
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
    },
    detailRow: {
      alignItems: 'center',
      flexDirection: 'row',

      justifyContent: 'space-between',
    },
    detailLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
    },
    detailValue: {
      ...PERPS_PRO_NUMBER_STYLE,
      flexShrink: 1,
      minWidth: 0,
      marginLeft: 12,
      textAlign: 'right',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
    },
    ...getPerpsProDialogCheckboxStyles(colors2024),
    footer: {
      paddingHorizontal: 4,
      marginTop: 'auto',
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
