import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
  BOTTOM_BUTTON_COMPACT_TITLE_STYLE,
} from '@/constant/layout';
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
  getOpenOrderEditCoveragePercent,
  getOpenOrderEditDisplayAmount,
  type PerpsProConditionalOrderEditDraft,
} from '../../model/openOrderEdit';
import { validatePositionTpSlTrigger } from '../../model/positionTpSl';
import {
  getPerpsProAmountInputDecimals,
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
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProOpenOrderEditHeader } from './PerpsProOpenOrderEditHeader';
import { PerpsProOpenOrderEditInput } from './PerpsProOpenOrderEditInput';

const MODAL_ID = 'perps-pro-conditional-order-edit';
const SHEET_HEIGHT = 534;
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
  visible: boolean;
}> = React.memo(
  ({ coveredByReview, editor, onClose, onReview, position, visible }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const dismissKeyboardThen = usePerpsProDismissKeyboard();
    const liveMarket = usePerpsProPositionMark(editor.order.coin);
    const markPrice = liveMarket.markPrice || editor.market.markPrice;
    const initialTrigger = editor.order.triggerPrice || '';
    const initialSize = editor.order.remainingSize;
    const [triggerPrice, setTriggerPrice] = useState(initialTrigger);
    const [amountSource, setAmountSource] = useState<
      'initial' | 'manual' | 'slider'
    >('initial');
    const [manualAmount, setManualAmount] = useState('');
    const initialPercent = getOpenOrderEditCoveragePercent({
      positionSize: position.baseSize,
      size: initialSize,
    });
    const [percent, setPercent] = useState(initialPercent);
    const activePercent = amountSource === 'initial' ? initialPercent : percent;
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: coveredByReview,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: activePercent,
    });
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !coveredByReview,
    });
    useRegisterBlockingModal(MODAL_ID, visible);

    useEffect(() => {
      if (visible) modalRef.current?.present();
      else modalRef.current?.close();
    }, [visible]);

    const sliderBaseSize = useMemo(() => {
      const size = new BigNumber(position.baseSize || Number.NaN);
      if (!size.isFinite() || !size.gt(0) || percent <= 0) return null;
      const normalized = size
        .multipliedBy(percent)
        .dividedBy(100)
        .decimalPlaces(editor.market.szDecimals, BigNumber.ROUND_DOWN)
        .toFixed();
      return new BigNumber(normalized).gt(0) ? normalized : null;
    }, [editor.market.szDecimals, percent, position.baseSize]);
    const manualBaseSize = resolvePerpsProTradeAmount({
      amount: manualAmount,
      amountUnit: editor.amountUnit,
      price: markPrice,
      szDecimals: editor.market.szDecimals,
    })?.baseSize;
    const baseSize =
      amountSource === 'initial'
        ? initialSize
        : amountSource === 'slider'
        ? sliderBaseSize
        : manualBaseSize || null;
    const displayAmount = getOpenOrderEditDisplayAmount({
      amountUnit: editor.amountUnit,
      baseSize: baseSize || '',
      referencePrice: markPrice,
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
            .replace(/\.0+$/u, '')}% (≈${formatPerpsProDecimal(
            displayAmount,
            displayDecimals,
          )})`;
    const positionDisplayAmount = getOpenOrderEditDisplayAmount({
      amountUnit: editor.amountUnit,
      baseSize: position.baseSize,
      referencePrice: markPrice,
    });
    const estimatedPnl = calculateOpenOrderEditEstimatedPnl({
      direction: position.direction,
      entryPrice: position.entryPrice,
      size: baseSize || '',
      triggerPrice,
    });
    const pnl = new BigNumber(estimatedPnl || 0);
    const triggerValidation = editor.order.triggerKind
      ? validatePositionTpSlTrigger({
          direction: position.direction,
          kind: editor.order.triggerKind,
          markPrice,
          triggerPrice,
        })
      : { kind: 'invalid' as const };
    const sizeValue = new BigNumber(baseSize || Number.NaN);
    const positionSize = new BigNumber(position.baseSize || Number.NaN);
    const canReview =
      triggerValidation.kind === 'valid' &&
      sizeValue.isFinite() &&
      sizeValue.gt(0) &&
      positionSize.isFinite() &&
      sizeValue.lte(positionSize) &&
      (!sizeValue.eq(initialSize) ||
        !new BigNumber(triggerPrice).eq(initialTrigger));

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
        backdropProps={{ pressBehavior: coveredByReview ? 'none' : 'close' }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!coveredByReview}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={onClose}
        snapPoints={[SHEET_HEIGHT]}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView
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
                {formatPerpsProPrice(
                  position.entryPrice,
                  editor.market.pxDecimals,
                )}
              </Text>
            </View>
            <View style={styles.form}>
              <PerpsProOpenOrderEditInput
                accessibilityLabel={t('page.perps.pro.openOrders.stopPrice')}
                currentValue={`Current ${formatPerpsProPrice(
                  initialTrigger,
                  editor.market.pxDecimals,
                )}`}
                label={t('page.perps.pro.openOrders.stopPrice')}
                maxDecimals={editor.market.pxDecimals}
                onChangeText={setTriggerPrice}
                testID="perps-pro-conditional-order-edit-trigger"
                unit={editor.market.quoteAsset}
                value={triggerPrice}
              />
              <PerpsProOpenOrderEditInput
                accessibilityLabel={t('page.perps.pro.openOrders.price')}
                disabled
                maxDecimals={0}
                onChangeText={() => undefined}
                testID="perps-pro-conditional-order-edit-market"
                value={t('page.perps.pro.openOrders.marketPrice')}
              />
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
                    const maximum = getOpenOrderEditDisplayAmount({
                      amountUnit: editor.amountUnit,
                      baseSize: position.baseSize,
                      referencePrice: markPrice,
                    });
                    const next = new BigNumber(value || Number.NaN);
                    const max = new BigNumber(maximum || Number.NaN);
                    setManualAmount(
                      next.isFinite() && max.isFinite() && next.gt(max)
                        ? max
                            .decimalPlaces(
                              displayDecimals,
                              BigNumber.ROUND_DOWN,
                            )
                            .toFixed()
                        : value,
                    );
                  }}
                  onFocus={beginManualAmount}
                  testID="perps-pro-conditional-order-edit-amount"
                  unit={displayUnit}
                  value={amountValue}
                />
                <PerpsProSlider
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
                    {formatPerpsProDecimal(
                      positionDisplayAmount,
                      displayDecimals,
                    )}{' '}
                    {displayUnit}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t('page.perps.pro.openOrders.estimatedPnl')}
                  </Text>
                  <Text
                    style={
                      pnl.gt(0)
                        ? styles.positiveValue
                        : pnl.lt(0)
                        ? styles.negativeValue
                        : styles.summaryValue
                    }>
                    {formatPerpsProSignedDecimal(estimatedPnl, 2)}{' '}
                    {editor.market.quoteAsset}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={styles.footer}
              testID="perps-pro-conditional-order-edit-footer">
              <Button
                disabled={!canReview || coveredByReview}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                onPress={() =>
                  dismissKeyboardThen(() => {
                    if (!baseSize) return;
                    onReview({ baseSize, triggerPrice });
                  })
                }
                testID="perps-pro-conditional-order-edit-confirm"
                title={t('global.confirm')}
                titleStyle={BOTTOM_BUTTON_COMPACT_TITLE_STYLE}
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
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  background: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 40,
    paddingBottom: 27,
    paddingTop: 9,
  },
  handleIndicator: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 2,
    height: 4,
    width: 40,
  },
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
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    maxWidth: '64%',
    textAlign: 'right',
  },
  positiveValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  negativeValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  footer: {
    left: 15,
    position: 'absolute',
    right: 15,
    top: 418,
  },
}));
