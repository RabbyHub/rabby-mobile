import { formatPositionTpSlSignedValue } from '../../utils/positionTpSlFormatting';
import {
  getPerpsProDialogCheckboxStyles,
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRegisterBlockingModal } from '@/utils/modalGate';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  calculatePositionTpSlEstimatedPnl,
  getPositionTpSlValueTone,
  type PerpsPositionTpSlMarketSnapshot,
} from '../../model/positionTpSl';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import type { PerpsProPositionTpSlReviewState } from '../../scene/usePerpsProPositionTpSl';
import {
  formatPerpsProPrice,
  formatPerpsProVariableDecimal,
} from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';

const MODAL_ID = 'perps-pro-position-tpsl-confirmation';

const formatPartialVolume = (
  amount: string,
  decimals: number,
  size: string,
  expectedPositionSize: string,
) => {
  const coverage = new BigNumber(size).dividedBy(expectedPositionSize);
  const percentage = coverage.isFinite()
    ? `${coverage.multipliedBy(100).toFixed(2, BigNumber.ROUND_HALF_UP)}%`
    : '-';
  const quantity = new BigNumber(amount).decimalPlaces(
    decimals,
    BigNumber.ROUND_HALF_UP,
  );
  return `${formatPerpsProVariableDecimal(quantity.toFixed())}(${percentage})`;
};

export const PerpsProPositionTpSlConfirmationSheet: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  market: PerpsPositionTpSlMarketSnapshot;
  onClose: () => void;
  onPresented?: () => void;
  onDismissed?: () => void;
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
    onPresented,
    onDismissed,
    onConfirm,
    onToggleSkipConfirmation,
    pending,
    position,
    review,
    skipConfirmation,
  }) => {
    const [retainedReview, setRetainedReview] =
      useState<PerpsProPositionTpSlReviewState | null>(review);
    const retainedDetails = useRef<{
      amountUnit: PerpsProTradeAmountUnit;
      market: PerpsPositionTpSlMarketSnapshot;
      position: PerpsPositionViewModel;
      skipConfirmation: boolean;
    } | null>(null);
    if (review)
      retainedDetails.current = {
        amountUnit,
        market,
        position,
        skipConfirmation,
      };
    const displayedDetails = retainedDetails.current;
    const displayedReview = review ?? retainedReview;
    const closing = !review;
    const interactionLocked = pending || closing;
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof PerpsProDialogBackdrop>) => (
        <PerpsProDialogBackdrop
          {...props}
          pressBehavior={interactionLocked ? 'none' : 'close'}
        />
      ),
      [interactionLocked],
    );
    usePerpsProSheetNavigationRegistration({
      active: !!displayedReview,
      dismiss: onClose,
      dismissible: !interactionLocked,
    });
    useRegisterBlockingModal(MODAL_ID, !!displayedReview);

    useLayoutEffect(() => {
      if (review) {
        setRetainedReview(review);
        onPresented?.();
      }
    }, [onPresented, review]);
    useEffect(() => {
      if (review) modalRef.current?.present();
      else modalRef.current?.close();
    }, [review]);
    const handleDismiss = useCallback(() => {
      setRetainedReview(null);
      retainedDetails.current = null;
      // Programmatic close has already updated the controller. A native
      // backdrop/pan dismissal still needs to close its current review.
      if (review === displayedReview && review) onClose();
      onDismissed?.();
    }, [displayedReview, onClose, onDismissed, review]);

    if (!displayedReview || !displayedDetails) return null;
    const isPosition = displayedReview.command.scope === 'position';

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        enableDynamicSizing
        enablePanDownToClose={!interactionLocked}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={handleDismiss}
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
                value={displayedDetails.market.displayPair}
              />
              <DetailRow
                label={t('page.perps.pro.positions.entry')}
                value={`${formatPerpsProPrice(
                  displayedDetails.position.entryPrice,
                  displayedDetails.market.pxDecimals,
                )} ${displayedDetails.market.quoteAsset}`}
              />
            </View>

            {displayedReview.command.legs.map(leg => {
              const shouldBeAbove =
                (displayedDetails.position.direction === 'long' &&
                  leg.kind === 'takeProfit') ||
                (displayedDetails.position.direction === 'short' &&
                  leg.kind === 'stopLoss');
              const size = isPosition
                ? displayedReview.command.expectedPositionSize
                : leg.size || '0';
              const estimatedPnl = calculatePositionTpSlEstimatedPnl({
                direction: displayedDetails.position.direction,
                entryPrice: displayedDetails.position.entryPrice,
                size,
                triggerPrice: leg.triggerPrice,
              });
              const displayAmount =
                displayedDetails.amountUnit === 'base'
                  ? size
                  : new BigNumber(size)
                      .multipliedBy(displayedReview.markPrice)
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
                      displayedDetails.market.pxDecimals,
                    )} ${displayedDetails.market.quoteAsset}`}
                  />
                  {!isPosition ? (
                    <DetailRow
                      label={`${t('page.perps.pro.positionTpsl.volume')} (${
                        displayedDetails.amountUnit === 'base'
                          ? displayedDetails.market.displayBase
                          : displayedDetails.market.quoteAsset
                      })`}
                      value={formatPartialVolume(
                        displayAmount,
                        displayedDetails.amountUnit === 'base'
                          ? displayedDetails.market.szDecimals
                          : 2,
                        size,
                        displayedReview.command.expectedPositionSize,
                      )}
                    />
                  ) : null}
                  <DetailRow
                    label={
                      <PerpsProDottedUnderlineText
                        accessibilityLabel={t(
                          'page.perps.pro.positionTpsl.estimatedPnl',
                        )}
                        onPress={() => openFieldExplanation('estimatedPnl')}
                        style={styles.detailLabel}>
                        {t('page.perps.pro.positionTpsl.estimatedPnl')}
                      </PerpsProDottedUnderlineText>
                    }
                    tone={getPositionTpSlValueTone(estimatedPnl)}
                    value={`${
                      estimatedPnl == null
                        ? '-'
                        : formatPositionTpSlSignedValue(estimatedPnl)
                    } ${displayedDetails.market.quoteAsset}`}
                  />
                </View>
              );
            })}

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              disabled={interactionLocked}
              onPress={interactionLocked ? undefined : onToggleSkipConfirmation}
              style={styles.checkboxRow}
              testID="perps-pro-position-tpsl-skip-confirmation">
              <PerpsProCheckboxIcon
                checked={displayedDetails.skipConfirmation}
                checkColor={colors2024['neutral-InvertHighlight']}
              />
              <Text style={styles.checkboxText}>
                {t('page.perps.pro.positionTpsl.skipConfirmation')}
              </Text>
            </Pressable>

            <View
              style={styles.footer}
              testID="perps-pro-position-tpsl-confirmation-footer">
              <Button
                buttonStyle={[styles.button, pending && styles.buttonDisabled]}
                disabledTitleStyle={styles.buttonDisabledTitle}
                disabled={interactionLocked}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                loadingProps={{ color: styles.buttonDisabledTitle.color }}
                onPress={interactionLocked ? undefined : onConfirm}
                testID="perps-pro-position-tpsl-confirm"
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

PerpsProPositionTpSlConfirmationSheet.displayName =
  'PerpsProPositionTpSlConfirmationSheet';

const DetailRow: React.FC<{
  label: React.ReactNode;
  tone?: 'negative' | 'neutral' | 'positive';
  value: string;
}> = ({ label, tone = 'neutral', value }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.detailRow}>
      {typeof label === 'string' ? (
        <Text style={styles.detailLabel}>{label}</Text>
      ) : (
        label
      )}
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

const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => {
    const dialog = getPerpsProDialogStyles(
      colors2024,
      safeAreaInsets.bottom,
      isLight,
    );
    return {
      ...dialog,
      container: { paddingHorizontal: 16, paddingTop: 8 },
      summary: {
        backgroundColor: resolvePerpsProDialogCardBackground(
          colors2024,
          isLight,
        ),
        borderRadius: 12,
        padding: 16,
        gap: 10,
        marginTop: 24,
      },
      leg: {
        backgroundColor: resolvePerpsProDialogCardBackground(
          colors2024,
          isLight,
        ),
        borderRadius: 12,
        padding: 16,
        gap: 10,
        marginTop: 8,
      },
      takeProfit: {
        color: colors2024['neutral-title-1'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
      },
      stopLoss: {
        color: colors2024['neutral-title-1'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
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
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        maxWidth: '64%',
        textAlign: 'right',
      },
      positiveValue: {
        ...PERPS_PRO_NUMBER_STYLE,
        color: colors2024['green-default'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      },
      negativeValue: {
        ...PERPS_PRO_NUMBER_STYLE,
        color: colors2024['red-default'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      },
      ...getPerpsProDialogCheckboxStyles(colors2024),
      footer: {
        paddingHorizontal: 4,
        paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
        paddingTop: 24,
      },
    };
  },
);
