import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { IS_IOS } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProOpenOrderCommand } from '../../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../../model/market';
import { getPerpsProBboStrategyLabel } from '../../model/bbo';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  formatPerpsProVariableDecimal,
} from '../../utils/format';
import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
  PERPS_PRO_DIALOG_TOKENS,
  PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
} from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProTintedTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

type OrderReview = PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand;

export const PerpsProOrderConfirmationSheet: React.FC<{
  command: OrderReview | null;
  estimatedLiquidation: { gap: number; price: string } | null;
  market: PerpsProMarket | null;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkip: () => void;
  pending: boolean;
  skipConfirmation: boolean;
}> = React.memo(
  ({
    command,
    estimatedLiquidation,
    market,
    onClose,
    onConfirm,
    onToggleSkip,
    pending,
    skipConfirmation,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: !!command,
      dismiss: onClose,
      dismissible: !pending,
    });

    useEffect(() => {
      if (command) modalRef.current?.present();
      else modalRef.current?.close();
    }, [command]);

    if (!command || !market) return null;
    const attachedCommand =
      command.type === 'openOrderWithAttachedTpSl' ? command : null;
    const parent: PerpsProOpenOrderCommand = attachedCommand
      ? attachedCommand.parent
      : (command as PerpsProOpenOrderCommand);
    const reviewFacts = attachedCommand?.reviewFacts ?? parent.reviewFacts;
    if (!reviewFacts || market.marketKey !== parent.marketKey) return null;

    const execution = parent.execution;
    const isConditional =
      execution.kind === 'conditionalLimit' ||
      execution.kind === 'conditionalMarket';
    const amount =
      reviewFacts.amountUnit === 'base' ? parent.baseSize : parent.quoteAmount;
    const amountUnit =
      reviewFacts.amountUnit === 'base'
        ? reviewFacts.displayBase
        : reviewFacts.quoteAsset;
    const price =
      execution.kind === 'bboLimit'
        ? getPerpsProBboStrategyLabel(execution.strategy)
        : execution.kind === 'limit' || execution.kind === 'conditionalLimit'
        ? `${formatPerpsProVariableDecimal(execution.limitPrice)} ${
            reviewFacts.quoteAsset
          }`
        : t('page.perps.pro.trade.marketPrice');
    const isBuy = parent.side === 'buy';
    const triggerOperator = (kind: 'sl' | 'tp') =>
      (isBuy && kind === 'tp') || (!isBuy && kind === 'sl') ? '≥' : '≤';
    const currentMarkPrice = market.marketData.markPx;

    return (
      <AppBottomSheetModal
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        enableDynamicSizing
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        ref={modalRef}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView style={styles.container}>
            <View style={styles.header}>
              <View style={styles.assetRow}>
                <Text numberOfLines={1} style={styles.symbol}>
                  {reviewFacts.displayPair}
                </Text>
                {reviewFacts.sourceTag ? (
                  <Text
                    numberOfLines={1}
                    style={styles.marketTag}
                    testID="perps-pro-order-confirmation-source-tag">
                    {reviewFacts.sourceTag}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={styles.marketTag}
                  testID="perps-pro-order-confirmation-margin-mode-tag">
                  {reviewFacts.marginMode === 'cross' ? 'Cross' : 'Isolated'}{' '}
                  {reviewFacts.leverage}x
                </Text>
              </View>
            </View>

            <View
              style={styles.details}
              testID="perps-pro-order-confirmation-details">
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t('page.perps.pro.trade.direction')}
                </Text>
                <Text
                  style={isBuy ? styles.buyDirection : styles.sellDirection}
                  testID="perps-pro-order-confirmation-direction">
                  {t(
                    isBuy
                      ? 'page.perps.pro.trade.buy'
                      : 'page.perps.pro.trade.sell',
                  )}
                  {' / '}
                  {t(
                    isBuy
                      ? 'page.perps.pro.trade.long'
                      : 'page.perps.pro.trade.short',
                  )}
                </Text>
              </View>
              {isConditional ? (
                <DetailRow
                  label={t('page.perps.pro.trade.triggerPrice')}
                  value={`${formatPerpsProVariableDecimal(
                    execution.triggerPrice,
                  )} ${reviewFacts.quoteAsset}`}
                />
              ) : null}
              <DetailRow
                label={t('page.perps.pro.trade.price')}
                value={price}
              />
              <DetailRow
                label={t('page.perps.pro.trade.amount')}
                value={`${formatPerpsProDecimal(
                  amount,
                  reviewFacts.amountUnit === 'base'
                    ? reviewFacts.szDecimals
                    : 2,
                )} ${amountUnit}`}
              />
              <DetailRow
                label={t('page.perps.pro.trade.markPrice')}
                value={`${formatPerpsProPrice(
                  currentMarkPrice,
                  reviewFacts.pxDecimals,
                )} ${reviewFacts.quoteAsset}`}
              />
              <DetailRow
                label={t('page.perps.pro.trade.estimatedLiquidationPrice')}
                value={
                  estimatedLiquidation
                    ? `${formatPerpsProPrice(
                        estimatedLiquidation.price,
                        reviewFacts.pxDecimals,
                      )} ${reviewFacts.quoteAsset} (${(
                        estimatedLiquidation.gap * 100
                      ).toFixed(2)}%)`
                    : '--'
                }
              />
              <DetailRow
                label={t('page.perps.pro.trade.confirmationReduceOnly')}
                value={t(
                  parent.reduceOnly
                    ? 'page.perps.pro.trade.yes'
                    : 'page.perps.pro.trade.no',
                )}
              />
            </View>

            {attachedCommand?.attached.tp || attachedCommand?.attached.sl ? (
              <View style={styles.tpSlDetails}>
                {attachedCommand.attached.tp ? (
                  <>
                    <DetailRow
                      label={`${t('page.perps.pro.trade.takeProfit')} ${t(
                        'page.perps.pro.trade.market',
                      )}`}
                      value={t('page.perps.pro.trade.marketPrice')}
                    />
                    <DetailRow
                      label={t('page.perps.pro.trade.trigger')}
                      value={`${t(
                        'page.perps.pro.trade.markPrice',
                      )} ${triggerOperator(
                        'tp',
                      )} ${formatPerpsProVariableDecimal(
                        attachedCommand.attached.tp.triggerPrice,
                      )} ${reviewFacts.quoteAsset}`}
                    />
                  </>
                ) : null}
                {attachedCommand.attached.sl ? (
                  <>
                    <DetailRow
                      label={`${t('page.perps.pro.trade.stopLoss')} ${t(
                        'page.perps.pro.trade.market',
                      )}`}
                      value={t('page.perps.pro.trade.marketPrice')}
                    />
                    <DetailRow
                      label={t('page.perps.pro.trade.trigger')}
                      value={`${t(
                        'page.perps.pro.trade.markPrice',
                      )} ${triggerOperator(
                        'sl',
                      )} ${formatPerpsProVariableDecimal(
                        attachedCommand.attached.sl.triggerPrice,
                      )} ${reviewFacts.quoteAsset}`}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              onPress={onToggleSkip}
              style={styles.checkboxRow}>
              {skipConfirmation ? (
                <RcCheckboxFilledBrand height={20} width={20} />
              ) : (
                <RcCheckboxEmptyCC
                  color={PERPS_PRO_DIALOG_TOKENS.checkboxBorder}
                  height={20}
                  width={20}
                />
              )}
              <Text style={styles.checkboxText}>
                {t('page.perps.pro.trade.skipConfirmation')}
              </Text>
            </Pressable>

            <View
              style={styles.footer}
              testID="perps-pro-order-confirmation-footer">
              <Button
                buttonStyle={[styles.button, pending && styles.buttonDisabled]}
                disabled={pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                loadingProps={{ color: styles.buttonDisabledTitle.color }}
                onPress={onConfirm}
                title={t('global.confirm')}
                titleStyle={styles.buttonTitle}
                disabledTitleStyle={styles.buttonDisabledTitle}
                type="primary"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

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

PerpsProOrderConfirmationSheet.displayName = 'PerpsProOrderConfirmationSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    header: { alignItems: 'center' },
    assetRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    symbol: {
      ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      maxWidth: 160,
    },
    marketTag: {
      ...getPerpsProMetadataTagContainerStyle(colors2024),
      ...getPerpsProMetadataTagTextStyle(colors2024),
      maxWidth: 100,
      ...(IS_IOS ? { overflow: 'hidden' as const } : {}),
    },
    buyDirection: {
      ...getPerpsProTintedTagTextStyle(colors2024, 'positive'),
      fontWeight: '700',
    },
    sellDirection: {
      ...getPerpsProTintedTagTextStyle(colors2024, 'negative'),
      fontWeight: '700',
    },
    details: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      padding: 16,
      gap: 10,
      marginTop: 24,
    },
    tpSlDetails: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      padding: 16,
      gap: 10,
      marginTop: 8,
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
      color: colors2024['neutral-title-1'],
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
      marginLeft: 12,
      textAlign: 'right',
    },
    checkboxRow: {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginTop: 8,
    },
    checkboxText: {
      color: colors2024['neutral-foot'],
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
    },
    footer: {
      paddingHorizontal: 4,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
    },
  }),
);
