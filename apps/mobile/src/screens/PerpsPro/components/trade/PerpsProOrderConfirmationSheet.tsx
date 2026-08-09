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
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProOpenOrderCommand } from '../../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../../model/market';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';

export const PerpsProOrderConfirmationSheet: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  command: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand | null;
  estimatedLiquidation: { gap: number; price: string } | null;
  leverage: number;
  marginMode: 'cross' | 'isolated';
  market: PerpsProMarket | null;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkip: () => void;
  pending: boolean;
  skipConfirmation: boolean;
}> = React.memo(
  ({
    amountUnit,
    command,
    estimatedLiquidation,
    leverage,
    marginMode,
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

    useEffect(() => {
      if (command) modalRef.current?.present();
      else modalRef.current?.close();
    }, [command]);

    if (!command) return null;
    const attachedCommand =
      command.type === 'openOrderWithAttachedTpSl' ? command : null;
    if (!attachedCommand && !market) return null;
    const attached = attachedCommand?.attached ?? null;
    const parent =
      command.type === 'openOrderWithAttachedTpSl' ? command.parent : command;
    const reviewFacts = attachedCommand?.reviewFacts;
    const displayPair = reviewFacts?.displayPair ?? market!.displayPair;
    const displayBase = reviewFacts?.displayBase ?? market!.displayBase;
    const quoteAsset = reviewFacts?.quoteAsset ?? market!.quoteAsset;
    const pxDecimals = reviewFacts?.pxDecimals ?? market!.marketData.pxDecimals;
    const szDecimals = reviewFacts?.szDecimals ?? market!.marketData.szDecimals;
    const frozenAmountUnit = reviewFacts?.amountUnit ?? amountUnit;
    const frozenLeverage = reviewFacts?.leverage ?? leverage;
    const frozenMarginMode = reviewFacts?.marginMode ?? marginMode;
    const frozenMarkPrice = reviewFacts?.markPrice ?? market!.marketData.markPx;
    const frozenLiquidation = reviewFacts
      ? reviewFacts.liquidationPrice != null &&
        reviewFacts.liquidationGap != null
        ? {
            gap: reviewFacts.liquidationGap,
            price: reviewFacts.liquidationPrice,
          }
        : null
      : estimatedLiquidation;
    const execution = parent.execution;
    const isMarket = execution.kind === 'market';
    const isConditional =
      execution.kind === 'conditionalLimit' ||
      execution.kind === 'conditionalMarket';
    const price =
      execution.kind === 'limit' || execution.kind === 'conditionalLimit'
        ? execution.limitPrice
        : null;
    const amount =
      frozenAmountUnit === 'base' ? parent.baseSize : parent.quoteAmount;
    const unit = frozenAmountUnit === 'base' ? displayBase : quoteAsset;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        snapPoints={[attached ? 690 : 510]}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>
              {t(
                attached
                  ? 'page.perps.pro.trade.confirmAttachedTpSl'
                  : 'page.perps.pro.trade.confirmOrder',
              )}
            </Text>
            <View style={styles.headerRow}>
              <Text style={styles.symbol}>{displayPair}</Text>
              <View style={styles.tags}>
                <Text style={styles.tag}>
                  {frozenMarginMode === 'cross' ? 'Cross' : 'Isolated'}
                </Text>
                <Text style={styles.tag}>{frozenLeverage}x</Text>
              </View>
            </View>
            <Text style={parent.side === 'buy' ? styles.buy : styles.sell}>
              {parent.side === 'buy'
                ? t('page.perps.pro.trade.buyLong')
                : t('page.perps.pro.trade.sellShort')}
            </Text>
            <View style={styles.details}>
              <DetailRow
                label={t('page.perps.pro.trade.orderType')}
                value={
                  isConditional
                    ? t('page.perps.pro.trade.conditional')
                    : isMarket
                    ? t('page.perps.pro.trade.market')
                    : t('page.perps.pro.trade.limit')
                }
              />
              {isConditional ? (
                <DetailRow
                  label={t('page.perps.pro.trade.stopPrice')}
                  value={`${formatPerpsProPrice(
                    execution.triggerPrice,
                    pxDecimals,
                  )} ${quoteAsset}`}
                />
              ) : null}
              <DetailRow
                label={t('page.perps.pro.trade.price')}
                value={
                  isMarket || execution.kind === 'conditionalMarket'
                    ? t('page.perps.pro.trade.marketPrice')
                    : `${formatPerpsProPrice(price, pxDecimals)} ${quoteAsset}`
                }
              />
              {attached ? (
                <DetailRow
                  label={t('page.perps.pro.trade.estimatedEntryPrice')}
                  value={`${formatPerpsProPrice(
                    attached.expectedEntryPrice,
                    pxDecimals,
                  )} ${quoteAsset}`}
                />
              ) : null}
              <DetailRow
                label={t('page.perps.pro.trade.amount')}
                value={`${formatPerpsProDecimal(
                  amount,
                  frozenAmountUnit === 'base' ? szDecimals : 2,
                )} ${unit}`}
              />
              <DetailRow
                label={t('page.perps.pro.trade.markPrice')}
                value={`${formatPerpsProPrice(
                  frozenMarkPrice,
                  pxDecimals,
                )} ${quoteAsset}`}
              />
              <DetailRow
                label={t('page.perps.pro.trade.estimatedLiquidationPrice')}
                value={
                  frozenLiquidation
                    ? `${formatPerpsProPrice(
                        frozenLiquidation.price,
                        pxDecimals,
                      )} ${quoteAsset} (${(frozenLiquidation.gap * 100).toFixed(
                        2,
                      )}%)`
                    : '-'
                }
              />
              {attached?.tp ? (
                <DetailRow
                  label={t('page.perps.pro.trade.takeProfit')}
                  value={`${formatPerpsProPrice(
                    attached.tp.triggerPrice,
                    pxDecimals,
                  )} ${quoteAsset}`}
                />
              ) : null}
              {attached?.tp ? (
                <DetailRow
                  label={t('page.perps.pro.trade.estimatedTpPnlRoi')}
                  value={formatPnlRoi(
                    attached.tp.estimatedPnl,
                    attached.tp.estimatedRoi,
                    quoteAsset,
                  )}
                />
              ) : null}
              {attached?.sl ? (
                <DetailRow
                  label={t('page.perps.pro.trade.stopLoss')}
                  value={`${formatPerpsProPrice(
                    attached.sl.triggerPrice,
                    pxDecimals,
                  )} ${quoteAsset}`}
                />
              ) : null}
              {attached?.sl ? (
                <DetailRow
                  label={t('page.perps.pro.trade.estimatedSlPnlRoi')}
                  value={formatPnlRoi(
                    attached.sl.estimatedPnl,
                    attached.sl.estimatedRoi,
                    quoteAsset,
                  )}
                />
              ) : null}
            </View>
            {attached && parent.execution.kind === 'limit' ? (
              <View style={styles.warningGroup}>
                <Text style={styles.warning}>
                  {t('page.perps.pro.trade.tpSlFullFillWarning')}
                </Text>
              </View>
            ) : !attached ? (
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
            ) : null}
            <View style={styles.footer}>
              <Button
                disabled={pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                title={
                  attached
                    ? t('page.perps.pro.trade.submitAttachedTpSl')
                    : t('global.confirm')
                }
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

const formatSigned = (value: string) => {
  const number = new BigNumber(value);
  if (!number.isFinite()) return '-';
  const formatted = formatPerpsProDecimal(number.abs().toFixed(), 2);
  return `${
    number.isPositive() ? '+' : number.isNegative() ? '-' : ''
  }${formatted}`;
};

const formatPnlRoi = (pnl: string, roi: string, quoteAsset: string) =>
  `${formatSigned(pnl)} ${quoteAsset} / ${formatSigned(roi)}%`;

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
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  symbol: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  tags: { flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 4,
    color: colors2024['neutral-secondary'],
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 5,
  },
  buy: {
    color: colors2024['green-default'],
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  sell: {
    color: colors2024['red-default'],
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  details: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    gap: 12,
    marginTop: 20,
    padding: 12,
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors2024['neutral-secondary'],
    fontSize: 13,
    lineHeight: 18,
  },
  detailValue: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: 12,
    textAlign: 'right',
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
    fontSize: 13,
    lineHeight: 18,
  },
  warningGroup: { gap: 4, marginTop: 16 },
  warning: {
    color: colors2024['neutral-secondary'],
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
