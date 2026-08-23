import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProOpenOrderCommand } from '../../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../../model/market';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_ISOLATED_TEXT_STYLE,
  PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET,
} from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

// Figma 80430:12847 defines a compact 36px Pro confirmation action.
const PERPS_PRO_ORDER_CONFIRM_HEIGHT = 36;

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
      execution.kind === 'limit' || execution.kind === 'conditionalLimit'
        ? `${formatPerpsProPrice(
            execution.limitPrice,
            reviewFacts.pxDecimals,
          )} ${reviewFacts.quoteAsset}`
        : t('page.perps.pro.trade.marketPrice');
    const isBuy = parent.side === 'buy';
    const triggerOperator = (kind: 'sl' | 'tp') =>
      (isBuy && kind === 'tp') || (!isBuy && kind === 'sl') ? '≥' : '≤';
    const currentMarkPrice = market.marketData.markPx;

    return (
      <AppBottomSheetModal
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
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
                  <Text numberOfLines={1} style={styles.marketTag}>
                    {reviewFacts.sourceTag}
                  </Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.marketTag,
                    reviewFacts.marginMode === 'isolated'
                      ? PERPS_PRO_ISOLATED_TEXT_STYLE
                      : null,
                  ]}>
                  {reviewFacts.marginMode === 'cross' ? 'Cross' : 'Isolated'}{' '}
                  {reviewFacts.leverage}x
                </Text>
              </View>
              <View style={styles.directionRow}>
                <View style={isBuy ? styles.buyTag : styles.sellTag}>
                  <Text style={isBuy ? styles.buyTagText : styles.sellTagText}>
                    {t(
                      isBuy
                        ? 'page.perps.pro.trade.buy'
                        : 'page.perps.pro.trade.sell',
                    )}
                  </Text>
                </View>
                <View style={isBuy ? styles.buyTag : styles.sellTag}>
                  <Text style={isBuy ? styles.buyTagText : styles.sellTagText}>
                    {t(
                      isBuy
                        ? 'page.perps.pro.trade.long'
                        : 'page.perps.pro.trade.short',
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={styles.details}
              testID="perps-pro-order-confirmation-details">
              {isConditional ? (
                <DetailRow
                  label={t('page.perps.pro.trade.triggerPrice')}
                  value={`${formatPerpsProPrice(
                    execution.triggerPrice,
                    reviewFacts.pxDecimals,
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
                    : '-'
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
                      )} ${triggerOperator('tp')} ${formatPerpsProPrice(
                        attachedCommand.attached.tp.triggerPrice,
                        reviewFacts.pxDecimals,
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
                      )} ${triggerOperator('sl')} ${formatPerpsProPrice(
                        attachedCommand.attached.sl.triggerPrice,
                        reviewFacts.pxDecimals,
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
                  color={colors2024['neutral-secondary']}
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
                disabled={pending}
                height={PERPS_PRO_ORDER_CONFIRM_HEIGHT}
                loading={pending}
                onPress={onConfirm}
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

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024, {
    handlePlacement: 'centered',
  }),
  container: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  header: { gap: 8 },
  assetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  symbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: 160,
  },
  marketTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 2,
    borderWidth: 0.5,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
    maxWidth: 100,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  directionRow: { flexDirection: 'row', gap: 4 },
  buyTag: {
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sellTag: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  buyTagText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  sellTagText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
  details: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingBottom: 12,
  },
  tpSlDetails: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    paddingBottom: 12,
    paddingTop: 12,
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
    marginLeft: 12,
    textAlign: 'right',
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  checkboxText: {
    color: colors2024['neutral-body'],
    flex: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingBottom: Math.max(40, safeAreaInsets.bottom),
    paddingTop: PERPS_PRO_ORDER_CONFIRMATION_FOOTER_TOP_OFFSET,
  },
}));
