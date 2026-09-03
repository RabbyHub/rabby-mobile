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
import { Keyboard, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  calculateOpenOrderEditEstimatedPnl,
  getOpenOrderEditDisplayAmount,
  type PerpsProConditionalOrderEditDraft,
} from '../../model/openOrderEdit';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from '../common/perpsProVisual';
import {
  getPerpsProAmountInputDecimals,
  getPerpsProPriceInputMaxDecimals,
  isPerpsProPriceProtocolValid,
  resolvePerpsProTradeAmount,
} from '../../model/trade';
import type { PerpsProOpenOrderEditEditorState } from '../../scene/usePerpsProOpenOrderEdit';
import { usePerpsProPositionMark } from '../../scene/usePerpsProPositionMark';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';
import { PerpsProSlider } from '../common/PerpsProSlider';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProOpenOrderEditHeader } from './PerpsProOpenOrderEditHeader';
import { PerpsProOpenOrderEditInput } from './PerpsProOpenOrderEditInput';

const MODAL_ID = 'perps-pro-conditional-order-edit';
const SHEET_HEIGHT = 542;
const CONTENT_HEIGHT = SHEET_HEIGHT - 40;

export const PerpsProConditionalOrderEditSheet: React.FC<{
  coveredByReview: boolean;
  editor: Extract<
    PerpsProOpenOrderEditEditorState,
    { category: 'conditional' }
  >;
  onClose: () => void;
  onReview: (draft: PerpsProConditionalOrderEditDraft) => void;
  position: Extract<
    PerpsProOpenOrderEditEditorState,
    { category: 'conditional' }
  >['position'];
  reviewRequesting?: boolean;
  visible: boolean;
}> = React.memo(
  ({
    coveredByReview,
    editor,
    onClose,
    onReview,
    position,
    reviewRequesting = false,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const dismissKeyboardThen = usePerpsProDismissKeyboard();
    const liveMarket = usePerpsProPositionMark(editor.order.coin);
    const markPrice = liveMarket.markPrice || editor.market.markPrice;
    const initialTrigger = editor.order.triggerPrice || '';
    const initialLimit = editor.order.limitPrice || '';
    const initialSize = editor.order.remainingSize;
    const isTriggerLimit = editor.order.editKind === 'triggerLimit';
    const isPositionSize =
      editor.order.isPositionTpsl && new BigNumber(initialSize).isZero();
    const [triggerPrice, setTriggerPrice] = useState(initialTrigger);
    const [limitPrice, setLimitPrice] = useState(initialLimit);
    const [amountSource, setAmountSource] = useState<
      'initial' | 'manual' | 'slider'
    >('initial');
    const [manualAmount, setManualAmount] = useState('');
    const interactionLocked = coveredByReview || reviewRequesting;
    const sliderSizeBasis = isPositionSize
      ? position?.baseSize || ''
      : initialSize;
    const initialPercent = sliderSizeBasis ? 100 : 0;
    const [percent, setPercent] = useState(initialPercent);
    const activePercent = amountSource === 'initial' ? initialPercent : percent;
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: interactionLocked || !sliderSizeBasis,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: activePercent,
    });
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

    const sliderBaseSize = useMemo(() => {
      const size = new BigNumber(sliderSizeBasis || Number.NaN);
      if (!size.isFinite() || !size.gt(0) || percent <= 0) return null;
      const normalized = size
        .multipliedBy(percent)
        .dividedBy(100)
        .decimalPlaces(editor.market.szDecimals, BigNumber.ROUND_DOWN)
        .toFixed();
      return new BigNumber(normalized).gt(0) ? normalized : null;
    }, [editor.market.szDecimals, percent, sliderSizeBasis]);
    const amountReferencePrice =
      markPrice || limitPrice || triggerPrice || initialLimit || initialTrigger;
    const manualBaseSize = resolvePerpsProTradeAmount({
      amount: manualAmount,
      amountUnit: editor.amountUnit,
      price: amountReferencePrice,
      szDecimals: editor.market.szDecimals,
    })?.baseSize;
    const baseSize =
      amountSource === 'initial'
        ? initialSize
        : amountSource === 'slider'
        ? sliderBaseSize
        : manualBaseSize || null;
    const displayBaseSize =
      isPositionSize && amountSource === 'initial'
        ? position?.baseSize || ''
        : baseSize || '';
    const displayAmount = getOpenOrderEditDisplayAmount({
      amountUnit: editor.amountUnit,
      baseSize: displayBaseSize,
      referencePrice: amountReferencePrice,
    });
    const displayUnit =
      editor.amountUnit === 'base'
        ? editor.market.displayBase
        : editor.market.quoteAsset;
    const displayDecimals =
      editor.amountUnit === 'base' ? editor.market.szDecimals : 2;
    const amountValue =
      amountSource === 'manual'
        ? manualAmount
        : `${new BigNumber(activePercent)
            .decimalPlaces(2, BigNumber.ROUND_DOWN)
            .toFixed()
            .replace(/\.0+$/u, '')}% (≈${
            displayAmount
              ? formatPerpsProDecimal(displayAmount, displayDecimals)
              : '--'
          })`;
    const positionDisplayAmount = position
      ? getOpenOrderEditDisplayAmount({
          amountUnit: editor.amountUnit,
          baseSize: position.baseSize,
          referencePrice: amountReferencePrice,
        })
      : null;
    const estimatedPnl = position
      ? calculateOpenOrderEditEstimatedPnl({
          direction: position.direction,
          entryPrice: position.entryPrice,
          size: isPositionSize ? position.baseSize : baseSize || '',
          triggerPrice,
        })
      : null;
    const pnl = new BigNumber(estimatedPnl || 0);
    const triggerValue = new BigNumber(triggerPrice || Number.NaN);
    const limitValue = new BigNumber(limitPrice || Number.NaN);
    const sizeValue = new BigNumber(baseSize || Number.NaN);
    const canReview =
      triggerValue.isFinite() &&
      triggerValue.gt(0) &&
      isPerpsProPriceProtocolValid(triggerPrice, editor.market.szDecimals) &&
      (!isTriggerLimit || (limitValue.isFinite() && limitValue.gt(0))) &&
      (!isTriggerLimit ||
        isPerpsProPriceProtocolValid(limitPrice, editor.market.szDecimals)) &&
      sizeValue.isFinite() &&
      (sizeValue.gt(0) || (isPositionSize && sizeValue.isZero())) &&
      (!sizeValue.eq(initialSize) ||
        !triggerValue.eq(initialTrigger) ||
        (isTriggerLimit && !limitValue.eq(initialLimit)));

    const beginManualAmount = () => {
      if (amountSource === 'manual') return;
      setAmountSource('manual');
      setManualAmount('');
    };

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
            testID="perps-pro-conditional-order-edit-content">
            <PerpsProOpenOrderEditHeader
              market={editor.market}
              order={editor.order}
            />
            <View style={styles.entryRow}>
              <Text style={styles.summaryLabel}>
                {t('page.perps.pro.openOrders.entryPrice')} (
                {editor.market.quoteAsset})
              </Text>
              <Text style={styles.summaryValue}>
                {position
                  ? formatPerpsProPrice(
                      position.entryPrice,
                      editor.market.pxDecimals,
                    )
                  : '--'}
              </Text>
            </View>
            <View style={styles.form}>
              <PerpsProOpenOrderEditInput
                accessibilityLabel={t('page.perps.pro.openOrders.triggerPrice')}
                currentValue={`Current ${formatPerpsProPrice(
                  initialTrigger,
                  editor.market.pxDecimals,
                )}`}
                label={t('page.perps.pro.openOrders.triggerPrice')}
                maxDecimals={getPerpsProPriceInputMaxDecimals(
                  editor.market.szDecimals,
                )}
                onChangeText={setTriggerPrice}
                priceSzDecimals={editor.market.szDecimals}
                testID="perps-pro-conditional-order-edit-trigger"
                unit={editor.market.quoteAsset}
                value={triggerPrice}
              />
              {isTriggerLimit ? (
                <PerpsProOpenOrderEditInput
                  accessibilityLabel={t('page.perps.pro.openOrders.limitPrice')}
                  currentValue={`Current ${formatPerpsProPrice(
                    initialLimit,
                    editor.market.pxDecimals,
                  )}`}
                  label={t('page.perps.pro.openOrders.limitPrice')}
                  maxDecimals={getPerpsProPriceInputMaxDecimals(
                    editor.market.szDecimals,
                  )}
                  onChangeText={setLimitPrice}
                  priceSzDecimals={editor.market.szDecimals}
                  testID="perps-pro-conditional-order-edit-limit"
                  unit={editor.market.quoteAsset}
                  value={limitPrice}
                />
              ) : (
                <PerpsProOpenOrderEditInput
                  accessibilityLabel={t('page.perps.pro.openOrders.price')}
                  disabled
                  maxDecimals={0}
                  onChangeText={() => undefined}
                  testID="perps-pro-conditional-order-edit-market"
                  value={t('page.perps.pro.openOrders.marketPrice')}
                />
              )}
              <View style={styles.amountGroup}>
                <PerpsProOpenOrderEditInput
                  accessibilityLabel={t('page.perps.pro.openOrders.amount')}
                  label={t('page.perps.pro.openOrders.amount')}
                  maxDecimals={getPerpsProAmountInputDecimals({
                    amountUnit: editor.amountUnit,
                    szDecimals: editor.market.szDecimals,
                  })}
                  onChangeText={value => {
                    setAmountSource('manual');
                    setManualAmount(value);
                  }}
                  onFocus={beginManualAmount}
                  testID="perps-pro-conditional-order-edit-amount"
                  unit={displayUnit}
                  value={amountValue}
                />
                <PerpsProSlider
                  dimWhenDisabled={false}
                  disabled={interactionLocked || !sliderSizeBasis}
                  maximumValue={100}
                  minimumValue={0}
                  onSlidingComplete={sliderHaptics.onSlidingComplete}
                  onSlidingStart={value => {
                    Keyboard.dismiss();
                    sliderHaptics.onSlidingStart(value);
                  }}
                  onValueChange={value => {
                    const rounded = Math.round(value);
                    sliderHaptics.onValueChange(rounded);
                    setAmountSource('slider');
                    setPercent(rounded);
                  }}
                  pointCount={5}
                  step={1}
                  tone="neutral"
                  value={activePercent}
                />
              </View>
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t('page.perps.pro.openOrders.positionAmount')}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {positionDisplayAmount
                      ? formatPerpsProDecimal(
                          positionDisplayAmount,
                          displayDecimals,
                        )
                      : '--'}
                    {positionDisplayAmount ? ` ${displayUnit}` : ''}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <PerpsProDottedUnderlineText
                    accessibilityLabel={t(
                      'page.perps.pro.openOrders.estimatedPnl',
                    )}
                    onPress={() => openFieldExplanation('estimatedPnl')}
                    style={styles.summaryLabel}>
                    {t('page.perps.pro.openOrders.estimatedPnl')}
                  </PerpsProDottedUnderlineText>
                  <Text
                    style={
                      pnl.gt(0)
                        ? styles.positiveValue
                        : pnl.lt(0)
                        ? styles.negativeValue
                        : styles.summaryValue
                    }>
                    {estimatedPnl
                      ? `${formatPerpsProSignedDecimal(estimatedPnl, 2)} ${
                          editor.market.quoteAsset
                        }`
                      : '--'}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={styles.footer}
              testID="perps-pro-conditional-order-edit-footer">
              <Button
                buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
                disabled={!canReview || interactionLocked}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                onPress={() =>
                  dismissKeyboardThen(() => {
                    if (!baseSize) return;
                    onReview({
                      baseSize,
                      limitPrice: isTriggerLimit ? limitPrice : null,
                      triggerPrice,
                    });
                  })
                }
                testID="perps-pro-conditional-order-edit-confirm"
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

PerpsProConditionalOrderEditSheet.displayName =
  'PerpsProConditionalOrderEditSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  container: {
    height: CONTENT_HEIGHT,
    paddingHorizontal: 15,
    paddingTop: 8,
    position: 'relative',
  },
  entryRow: {
    alignItems: 'center',
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingBottom: 12,
  },
  form: { gap: 24, marginTop: 16 },
  amountGroup: { gap: 8 },
  summary: { gap: 8, paddingBottom: 12 },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    maxWidth: '64%',
    textAlign: 'right',
  },
  positiveValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  negativeValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  footer: {
    left: 15,
    position: 'absolute',
    right: 15,
    top: 426,
  },
}));
