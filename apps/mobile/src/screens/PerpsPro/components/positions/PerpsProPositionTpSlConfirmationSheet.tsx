import RcCheckboxEmptyCC from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
} from '../common/perpsProVisual';
import {
  calculatePositionTpSlEstimatedPnl,
  type PerpsPositionTpSlMarketSnapshot,
} from '../../model/positionTpSl';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import type { PerpsProPositionTpSlReviewState } from '../../scene/usePerpsProPositionTpSl';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

const MODAL_ID = 'perps-pro-position-tpsl-confirmation';

export const PerpsProPositionTpSlConfirmationSheet: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  market: PerpsPositionTpSlMarketSnapshot;
  onClose: () => void;
  onConfirm: () => void;
  onToggleSkipConfirmation: () => void;
  pending: boolean;
  position: PerpsPositionViewModel;
  review: PerpsProPositionTpSlReviewState | null;
  skipConfirmation: boolean;
}> = React.memo(
  ({
    amountUnit,
    market,
    onClose,
    onConfirm,
    onToggleSkipConfirmation,
    pending,
    position,
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
      if (review) {
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [review]);

    if (!review) {
      return null;
    }
    const isPosition = review.command.scope === 'position';

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropProps={{ pressBehavior: pending ? 'none' : 'close' }}
        backgroundStyle={styles.background}
        enableDynamicSizing
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>
              {t(
                isPosition
                  ? 'page.perps.pro.positionTpsl.confirmPositionTitle'
                  : 'page.perps.pro.positionTpsl.confirmTitle',
              )}
            </Text>
            <View style={styles.summary}>
              <DetailRow
                label={t('page.perps.pro.positionTpsl.symbol')}
                value={market.displayPair}
              />
              <DetailRow
                label={`${t('page.perps.pro.positions.entry')} (${
                  market.quoteAsset
                })`}
                value={formatPerpsProPrice(
                  position.entryPrice,
                  market.pxDecimals,
                )}
              />
            </View>

            {review.command.legs.map(leg => {
              const shouldBeAbove =
                (position.direction === 'long' && leg.kind === 'takeProfit') ||
                (position.direction === 'short' && leg.kind === 'stopLoss');
              const size = isPosition
                ? review.command.expectedPositionSize
                : leg.size || '0';
              const estimatedPnl = calculatePositionTpSlEstimatedPnl({
                direction: position.direction,
                entryPrice: position.entryPrice,
                size,
                triggerPrice: leg.triggerPrice,
              });
              const displayAmount =
                amountUnit === 'base'
                  ? size
                  : new BigNumber(size)
                      .multipliedBy(review.markPrice)
                      .toString();
              return (
                <View key={leg.kind} style={styles.leg}>
                  <Text
                    style={
                      leg.kind === 'takeProfit'
                        ? styles.takeProfit
                        : styles.stopLoss
                    }>
                    {t(
                      leg.kind === 'takeProfit'
                        ? 'page.perps.pro.positionTpsl.takeProfit'
                        : 'page.perps.pro.positionTpsl.stopLoss',
                    )}
                  </Text>
                  <DetailRow
                    label={t('page.perps.pro.positionTpsl.triggerPrice')}
                    value={`Mark ${
                      shouldBeAbove ? '≥' : '≤'
                    } ${formatPerpsProPrice(
                      leg.triggerPrice,
                      market.pxDecimals,
                    )} ${market.quoteAsset}`}
                  />
                  {!isPosition ? (
                    <DetailRow
                      label={t('page.perps.pro.positionTpsl.volume')}
                      value={`${formatPerpsProDecimal(
                        displayAmount,
                        amountUnit === 'base' ? market.szDecimals : 2,
                      )} ${
                        amountUnit === 'base'
                          ? market.displayBase
                          : market.quoteAsset
                      }`}
                    />
                  ) : null}
                  <DetailRow
                    label={t('page.perps.pro.positionTpsl.totalEstimatedPnl')}
                    tone={leg.kind === 'takeProfit' ? 'positive' : 'negative'}
                    value={`${formatPerpsProDecimal(estimatedPnl, 2)} ${
                      market.quoteAsset
                    }`}
                  />
                </View>
              );
            })}

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              disabled={pending}
              onPress={onToggleSkipConfirmation}
              style={styles.checkboxRow}
              testID="perps-pro-position-tpsl-skip-confirmation">
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
                {t('page.perps.pro.positions.skipLimitConfirmation')}
              </Text>
            </Pressable>

            <View
              style={styles.footer}
              testID="perps-pro-position-tpsl-confirmation-footer">
              <Button
                disabled={pending}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={onConfirm}
                testID="perps-pro-position-tpsl-confirm"
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

PerpsProPositionTpSlConfirmationSheet.displayName =
  'PerpsProPositionTpSlConfirmationSheet';

const DetailRow: React.FC<{
  label: string;
  tone?: 'negative' | 'neutral' | 'positive';
  value: string;
}> = ({ label, tone = 'neutral', value }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={
          tone === 'positive'
            ? styles.positiveValue
            : tone === 'negative'
            ? styles.negativeValue
            : styles.detailValue
        }>
        {value}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  container: { paddingHorizontal: 15, paddingTop: 8 },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  summary: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingBottom: 12,
  },
  leg: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingBottom: 12,
  },
  takeProfit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  stopLoss: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
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
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '64%',
    textAlign: 'right',
  },
  positiveValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  negativeValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
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
    paddingBottom: Math.max(
      40,
      getBottomButtonBottomOffset(safeAreaInsets.bottom),
    ),
    paddingTop: 24,
  },
}));
