import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_COMPACT_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
  resolvePerpsProFieldBackground,
} from '../common/perpsProVisual';
import type { PerpsProPositionTpSlFormPresentation } from '../../model/layout';
import {
  buildPositionTpSlSummary,
  isPositionTpSlModeTriggerUnavailable,
  validatePartialPositionTpSlAmount,
  validateFullPositionTpSlFormTrigger,
  validatePositionTpSlTrigger,
  type PerpsPositionTpSlDraft,
  type PerpsPositionTpSlKind,
  type PerpsPositionTpSlMarketSnapshot,
  type PerpsPositionTpSlOrderViewModel,
  type PerpsPositionTpSlFormTriggerValidation,
} from '../../model/positionTpSl';
import { resolvePerpsProCloseSize } from '../../model/positionAction';
import type { PerpsProTradeAmountUnit } from '../../model/trade';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PerpsProTpSlModeSheet } from '../trade/PerpsProTpSlModeSheet';
import { PerpsProSlider } from '../common/PerpsProSlider';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProPositionTpSlBottomSheetTextInput } from './PerpsProPositionTpSlBottomSheetTextInput';
import { PerpsProPositionTpSlSideInputs } from './PerpsProPositionTpSlSideInputs';
import { usePerpsProPositionTpSlFormInputs } from './usePerpsProPositionTpSlFormInputs';
import { usePerpsProTpSlModePreferences } from '../../scene/usePerpsProTpSlModePreferences';

type FormMode = 'add' | 'modify' | 'position';

export const PerpsProPositionTpSlForm: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  cancelingOids: readonly number[];
  initialOrder?: PerpsPositionTpSlOrderViewModel | null;
  markPrice: string | null;
  market: PerpsPositionTpSlMarketSnapshot;
  minimumHeight?: number;
  mode: FormMode;
  onCancelOrder: (order: PerpsPositionTpSlOrderViewModel) => void;
  onReview: (draft: PerpsPositionTpSlDraft) => void;
  pending: boolean;
  presentation?: PerpsProPositionTpSlFormPresentation;
  position: PerpsPositionViewModel;
}> = React.memo(
  ({
    amountUnit,
    cancelingOids,
    initialOrder = null,
    markPrice,
    market,
    minimumHeight,
    mode,
    onCancelOrder,
    onReview,
    pending,
    presentation,
    position,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const tpSlModePreferences = usePerpsProTpSlModePreferences();
    const dismissKeyboardThen = usePerpsProDismissKeyboard();
    const resolvedPresentation =
      presentation ?? (mode === 'position' ? 'tab' : 'subpage');
    const isInlineEmpty = resolvedPresentation === 'inline-empty';
    const summary = useMemo(
      () => buildPositionTpSlSummary(position.tpslOrders, markPrice),
      [markPrice, position.tpslOrders],
    );
    const singlePositionTakeProfit =
      summary.takeProfit.positionOrders.length === 1
        ? summary.takeProfit.positionOrders[0]
        : null;
    const singlePositionStopLoss =
      summary.stopLoss.positionOrders.length === 1
        ? summary.stopLoss.positionOrders[0]
        : null;
    const initialTakeProfit =
      mode === 'position'
        ? singlePositionTakeProfit?.triggerPrice || ''
        : initialOrder?.kind === 'takeProfit'
        ? initialOrder.triggerPrice
        : '';
    const initialStopLoss =
      mode === 'position'
        ? singlePositionStopLoss?.triggerPrice || ''
        : initialOrder?.kind === 'stopLoss'
        ? initialOrder.triggerPrice
        : '';
    const initialSideSize =
      mode === 'position'
        ? position.baseSize
        : initialOrder?.remainingSize || position.baseSize;
    const [activeModeKind, setActiveModeKind] =
      useState<PerpsPositionTpSlKind | null>(null);
    const amountInputRef = useRef<TextInput>(null);
    const displayAmountDecimals = amountUnit === 'base' ? market.szDecimals : 2;
    const maximumDisplayAmount = useMemo(() => {
      const positionSize = new BigNumber(position.baseSize || Number.NaN);
      if (!positionSize.isFinite() || !positionSize.gt(0)) {
        return '';
      }
      if (amountUnit === 'base') {
        return positionSize
          .decimalPlaces(market.szDecimals, BigNumber.ROUND_DOWN)
          .toFixed();
      }
      const referencePrice = new BigNumber(
        markPrice || market.markPrice || Number.NaN,
      );
      if (!referencePrice.isFinite() || !referencePrice.gt(0)) {
        return '';
      }
      return positionSize
        .multipliedBy(referencePrice)
        .decimalPlaces(2, BigNumber.ROUND_DOWN)
        .toFixed();
    }, [
      amountUnit,
      markPrice,
      market.markPrice,
      market.szDecimals,
      position.baseSize,
    ]);
    const [inputSource, setInputSource] = useState<'manual' | 'slider'>(
      mode === 'add' ? 'slider' : 'manual',
    );
    const initialPercent = mode === 'modify' ? 0 : 100;
    const [percent, setPercent] = useState(initialPercent);
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: pending || mode === 'position',
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: percent,
    });
    const initialAmountBase = initialOrder?.remainingSize || position.baseSize;
    const initialAmount = !initialAmountBase
      ? ''
      : amountUnit === 'base'
      ? initialAmountBase
      : new BigNumber(initialAmountBase)
          .multipliedBy(markPrice || market.markPrice)
          .decimalPlaces(2, BigNumber.ROUND_DOWN)
          .toFixed();
    const [manualAmount, setManualAmount] = useState(initialAmount);
    const [amountFocused, setAmountFocused] = useState(false);
    const normalizeAmountInput = useCallback(
      (value: string) => {
        if (!value || !maximumDisplayAmount) {
          return value;
        }
        const amount = new BigNumber(value);
        const maximum = new BigNumber(maximumDisplayAmount);
        return amount.isFinite() && maximum.isFinite() && amount.gt(maximum)
          ? maximumDisplayAmount
          : value;
      },
      [maximumDisplayAmount],
    );
    const beginManualAmountEntry = useCallback(() => {
      if (inputSource !== 'slider') {
        return;
      }
      setInputSource('manual');
      setPercent(0);
      setManualAmount('');
    }, [inputSource]);
    const handleAmountSliderTouchCapture = useCallback(() => {
      amountInputRef.current?.blur();
      Keyboard.dismiss();
      return false;
    }, []);

    const partialSize =
      mode === 'position'
        ? null
        : resolvePerpsProCloseSize({
            amountUnit,
            inputSource,
            manualAmount,
            percent,
            positionSize: position.baseSize,
            referencePrice: markPrice || '',
            szDecimals: market.szDecimals,
          });
    const displayAmount =
      inputSource === 'manual'
        ? manualAmount
        : amountUnit === 'base'
        ? partialSize
        : partialSize && markPrice
        ? new BigNumber(partialSize).multipliedBy(markPrice).toString()
        : null;
    const sideSize = mode === 'position' ? position.baseSize : partialSize;
    const {
      changeModeMagnitude,
      changeTrigger,
      selectMode,
      stopLoss: stopLossInput,
      takeProfit: takeProfitInput,
    } = usePerpsProPositionTpSlFormInputs({
      direction: position.direction,
      entryPrice: position.entryPrice,
      initialSize: initialSideSize,
      initialStopLoss,
      initialTakeProfit,
      leverage: position.leverage,
      pxDecimals: market.pxDecimals,
      preferredModes: tpSlModePreferences.position,
      sideSize,
    });
    const amountValidation =
      mode === 'position'
        ? null
        : validatePartialPositionTpSlAmount({
            amount: partialSize || '',
            positionSize: position.baseSize,
            szDecimals: market.szDecimals,
          });
    const visibleKinds: PerpsPositionTpSlKind[] =
      mode === 'modify' && initialOrder
        ? [initialOrder.kind]
        : ['takeProfit', 'stopLoss'];
    const partialAmountChanged =
      mode === 'modify' && initialOrder && partialSize
        ? !new BigNumber(partialSize).eq(initialOrder.remainingSize)
        : mode === 'add';

    const getSideInput = (kind: PerpsPositionTpSlKind) =>
      kind === 'takeProfit' ? takeProfitInput : stopLossInput;

    const getFullPositionTriggerError = (
      validation: PerpsPositionTpSlFormTriggerValidation,
    ) => {
      if (validation.kind !== 'invalid') {
        return null;
      }
      switch (validation.reason) {
        case 'takeProfitBelowMark':
          return t('page.perps.PerpsAutoCloseModal.takeProfitTipsLong');
        case 'takeProfitAboveMark':
          return t('page.perps.PerpsAutoCloseModal.takeProfitTipsShort');
        case 'stopLossAboveMark':
          return t('page.perps.PerpsAutoCloseModal.stopLossTipsLong');
        case 'stopLossBelowMark':
          return t('page.perps.PerpsAutoCloseModal.stopLossTipsShort');
        case 'stopLossBelowLiquidation':
          return t('page.perps.pro.positionTpsl.triggerHigherThanLiquidation', {
            price: `$${formatPerpsProPrice(
              validation.liquidationPrice,
              market.pxDecimals,
            )}`,
          });
        case 'stopLossAboveLiquidation':
          return t('page.perps.pro.positionTpsl.triggerLowerThanLiquidation', {
            price: `$${formatPerpsProPrice(
              validation.liquidationPrice,
              market.pxDecimals,
            )}`,
          });
        case 'takeProfitDerivedInvalid':
          return t('page.perps.pro.positionTpsl.tpTriggerInvalid');
        case 'stopLossDerivedInvalid':
          return t('page.perps.pro.positionTpsl.slTriggerInvalid');
      }
    };

    const sideFacts = (kind: PerpsPositionTpSlKind) => {
      const input = getSideInput(kind);
      const value = input.triggerPrice;
      const initial =
        kind === 'takeProfit' ? initialTakeProfit : initialStopLoss;
      const sideSummary =
        kind === 'takeProfit' ? summary.takeProfit : summary.stopLoss;
      const existing =
        mode === 'position'
          ? sideSummary.positionOrders.length === 1
            ? sideSummary.positionOrders[0]!
            : null
          : initialOrder?.kind === kind
          ? initialOrder
          : null;
      const duplicate =
        mode === 'position' && sideSummary.duplicatePositionOrders;
      const fullPositionValidation =
        mode === 'position'
          ? validateFullPositionTpSlFormTrigger({
              direction: position.direction,
              inputSource: input.source,
              kind,
              liquidationPrice: position.liquidationPrice,
              markPrice,
              rawMagnitude: input.rawMagnitude,
              triggerPrice: value,
            })
          : null;
      const modeTriggerUnavailable =
        mode !== 'position' &&
        isPositionTpSlModeTriggerUnavailable({
          inputSource: input.source,
          rawMagnitude: input.rawMagnitude,
          triggerPrice: value,
        });
      const validation =
        fullPositionValidation ??
        (modeTriggerUnavailable
          ? ({ kind: 'invalid' } as const)
          : validatePositionTpSlTrigger({
              direction: position.direction,
              kind,
              markPrice,
              triggerPrice: value,
            }));
      return {
        changed: value !== initial,
        duplicate,
        errorMessage: fullPositionValidation
          ? getFullPositionTriggerError(fullPositionValidation)
          : modeTriggerUnavailable
          ? t(
              kind === 'takeProfit'
                ? 'page.perps.pro.positionTpsl.tpTriggerInvalid'
                : 'page.perps.pro.positionTpsl.slTriggerInvalid',
            )
          : null,
        existing,
        modeTriggerUnavailable,
        sideSummary,
        validation,
        value,
      };
    };
    const factsByKind = visibleKinds.map(kind => ({
      facts: sideFacts(kind),
      kind,
    }));
    const changedLegs = factsByKind
      .filter(({ facts }) =>
        mode === 'position'
          ? !facts.duplicate &&
            facts.changed &&
            facts.validation.kind === 'valid'
          : facts.validation.kind === 'valid' &&
            (mode === 'add' || facts.changed || partialAmountChanged),
      )
      .map(({ facts, kind }) => ({
        kind,
        replaceOid: facts.existing?.oid ?? null,
        size: mode === 'position' ? null : partialSize,
        triggerPrice:
          facts.validation.kind === 'valid' ? facts.validation.normalized : '',
      }));
    const hasInvalidEnteredSide = factsByKind.some(
      ({ facts }) => !facts.duplicate && facts.validation.kind === 'invalid',
    );
    const canReview =
      !pending &&
      changedLegs.length > 0 &&
      !hasInvalidEnteredSide &&
      (mode === 'position' || amountValidation?.kind === 'valid');
    const hasAmountValue =
      inputSource === 'manual'
        ? !!manualAmount
        : percent > 0 && !!displayAmount;
    const showAmountFloatingLabel = amountFocused || hasAmountValue;
    const isPristineInlineEmpty =
      isInlineEmpty &&
      !takeProfitInput.triggerPrice &&
      !takeProfitInput.rawMagnitude &&
      !stopLossInput.triggerPrice &&
      !stopLossInput.rawMagnitude;

    const submit = () => {
      if (!canReview) {
        return;
      }
      onReview({
        legs: changedLegs.map(leg => ({
          ...leg,
          size: leg.size || null,
        })),
        mode,
        scope: mode === 'position' ? 'position' : 'partial',
      });
    };

    return (
      <View
        style={[
          styles.container,
          resolvedPresentation === 'subpage'
            ? styles.subpageContainer
            : styles.tabContainer,
          minimumHeight == null ? null : { minHeight: minimumHeight },
        ]}
        testID={`perps-pro-position-tpsl-form-${resolvedPresentation}`}>
        <View style={styles.sides}>
          {visibleKinds.map(kind => {
            const facts = sideFacts(kind);
            const orders = facts.sideSummary.positionOrders;
            const input = getSideInput(kind);
            return (
              <View key={kind} style={styles.sideSection}>
                <View style={styles.sideHeading}>
                  <View style={styles.sideTitleRow}>
                    <View
                      style={
                        kind === 'takeProfit'
                          ? styles.takeProfitBar
                          : styles.stopLossBar
                      }
                    />
                    <Text style={styles.sideTitle}>
                      {t(
                        kind === 'takeProfit'
                          ? 'page.perps.pro.positionTpsl.takeProfit'
                          : 'page.perps.pro.positionTpsl.stopLoss',
                      )}
                    </Text>
                  </View>
                  {mode === 'position' && facts.existing && !facts.duplicate ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        pending || cancelingOids.includes(facts.existing.oid)
                      }
                      onPress={() => onCancelOrder(facts.existing!)}>
                      <Text style={styles.cancelText}>
                        {t('global.cancel')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {facts.duplicate ? (
                  <View style={styles.duplicateBox}>
                    <Text style={styles.warningText}>
                      {t('page.perps.pro.positionTpsl.duplicatePositionOrders')}
                    </Text>
                    {orders.map(order => (
                      <View key={order.key} style={styles.duplicateOrderRow}>
                        <Text style={styles.duplicateOrderPrice}>
                          {formatPerpsProPrice(
                            order.triggerPrice,
                            market.pxDecimals,
                          )}{' '}
                          {market.quoteAsset}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={
                            pending || cancelingOids.includes(order.oid)
                          }
                          onPress={() => onCancelOrder(order)}>
                          <Text style={styles.cancelText}>
                            {t('global.cancel')}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <PerpsProPositionTpSlSideInputs
                    addMode={mode === 'add'}
                    disabled={pending}
                    kind={kind}
                    market={market}
                    onChangeModeMagnitude={next =>
                      changeModeMagnitude(kind, next)
                    }
                    onChangeTrigger={next => changeTrigger(kind, next)}
                    onPressMode={() => {
                      dismissKeyboardThen(() => setActiveModeKind(kind));
                    }}
                    position={position}
                    rawMagnitude={input.rawMagnitude}
                    selectedMode={input.mode}
                    errorMessage={facts.errorMessage}
                    highlightInvalidFields={
                      mode === 'position' || facts.modeTriggerUnavailable
                    }
                    showEmptyDescription={
                      mode === 'position' || facts.modeTriggerUnavailable
                    }
                    size={sideSize}
                    validationKind={facts.validation.kind}
                    value={input.triggerPrice}
                  />
                )}
              </View>
            );
          })}
        </View>

        {mode !== 'position' ? (
          <View
            style={styles.amountSection}
            testID="perps-pro-position-tpsl-amount-section">
            <View style={styles.inputShell}>
              <Text
                style={
                  showAmountFloatingLabel
                    ? styles.floatingLabel
                    : styles.amountPlaceholder
                }>
                {t('page.perps.pro.positions.amount')}
              </Text>
              {inputSource === 'slider' && hasAmountValue ? (
                <Text
                  pointerEvents="none"
                  style={styles.sliderAmountValue}
                  testID="perps-pro-position-tpsl-slider-amount">
                  {percent}% (≈
                  {formatPerpsProDecimal(displayAmount, displayAmountDecimals)})
                </Text>
              ) : null}
              <PerpsProDecimalTextInput
                editable={!pending}
                focusCursorAtEnd
                inputComponent={PerpsProPositionTpSlBottomSheetTextInput}
                maxDecimals={displayAmountDecimals}
                normalizeValue={normalizeAmountInput}
                onChangeText={value => {
                  setInputSource('manual');
                  setPercent(0);
                  setManualAmount(value);
                }}
                onBlur={() => setAmountFocused(false)}
                onFocus={() => {
                  setAmountFocused(true);
                  beginManualAmountEntry();
                }}
                onPressIn={beginManualAmountEntry}
                ref={amountInputRef}
                style={styles.input}
                testID="perps-pro-position-tpsl-amount"
                value={inputSource === 'manual' ? manualAmount : ''}
              />
              {hasAmountValue ? (
                <Text
                  style={styles.inputUnit}
                  testID="perps-pro-position-tpsl-amount-unit">
                  {amountUnit === 'base'
                    ? market.displayBase
                    : market.quoteAsset}
                </Text>
              ) : null}
            </View>
            <View
              onStartShouldSetResponderCapture={handleAmountSliderTouchCapture}
              testID="perps-pro-position-tpsl-amount-slider-section">
              <PerpsProSlider
                dimWhenDisabled={false}
                disabled={pending}
                maximumValue={100}
                minimumValue={0}
                onSlidingComplete={sliderHaptics.onSlidingComplete}
                onSlidingStart={sliderHaptics.onSlidingStart}
                onValueChange={next => {
                  const roundedNext = Math.round(next);
                  sliderHaptics.onValueChange(roundedNext);
                  setInputSource('slider');
                  setPercent(roundedNext);
                }}
                pointCount={5}
                step={1}
                tone="neutral"
                value={inputSource === 'slider' ? percent : 0}
              />
            </View>
            <Text
              accessibilityElementsHidden={isInlineEmpty && !hasAmountValue}
              style={[
                styles.amountAvailable,
                isInlineEmpty && !hasAmountValue
                  ? styles.hiddenAmountAvailable
                  : null,
              ]}>
              {t('page.perps.pro.positionTpsl.positionAmount')}{' '}
              {formatPerpsProDecimal(
                amountUnit === 'base'
                  ? position.baseSize
                  : new BigNumber(position.baseSize)
                      .multipliedBy(markPrice || '0')
                      .toString(),
                displayAmountDecimals,
              )}{' '}
              {amountUnit === 'base' ? market.displayBase : market.quoteAsset}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.footer,
            isPristineInlineEmpty ? styles.pristineInlineEmptyFooter : null,
          ]}
          testID="perps-pro-position-tpsl-footer">
          <Button
            buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
            disabled={!canReview}
            height={BOTTOM_BUTTON_COMPACT_HEIGHT}
            onPress={submit}
            testID="perps-pro-position-tpsl-review"
            title={t('global.confirm')}
            titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
            type="primary"
          />
        </View>
        <PerpsProTpSlModeSheet
          allowedModes={['pnl', 'roi']}
          onClose={() => setActiveModeKind(null)}
          onSelect={nextMode => {
            if (!activeModeKind || nextMode === 'price') {
              return;
            }
            void tpSlModePreferences.setMode({
              leg: activeModeKind === 'takeProfit' ? 'tp' : 'sl',
              mode: nextMode,
              surface: 'position',
            });
            selectMode(activeModeKind, nextMode);
          }}
          selected={activeModeKind ? getSideInput(activeModeKind).mode : 'pnl'}
          visible={activeModeKind != null}
        />
      </View>
    );
  },
);

PerpsProPositionTpSlForm.displayName = 'PerpsProPositionTpSlForm';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    container: {
      flexGrow: 1,
      paddingHorizontal: 15,
    },
    subpageContainer: { paddingTop: 16 },
    tabContainer: { paddingTop: 24 },
    sides: { gap: 24 },
    sideSection: {
      gap: 12,
    },
    sideHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sideTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
    takeProfitBar: {
      backgroundColor: colors2024['green-default'],
      borderRadius: 2,
      height: 18,
      width: 4,
    },
    stopLossBar: {
      backgroundColor: colors2024['red-default'],
      borderRadius: 2,
      height: 18,
      width: 4,
    },
    sideTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    cancelText: {
      color: colors2024['blue-default'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    inputShell: {
      backgroundColor: resolvePerpsProFieldBackground({
        darkBackground: colors2024['neutral-bg-2'],
        isLight,
      }),
      borderRadius: 6,
      flex: 1,
      height: 40,
      justifyContent: 'center',
      minWidth: 0,
      position: 'relative',
    },
    floatingLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      left: 8,
      lineHeight: 12,
      position: 'absolute',
      top: 4,
    },
    amountPlaceholder: {
      color: colors2024['neutral-info'],
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      left: 8,
      lineHeight: 12,
      position: 'absolute',
      top: 14,
    },
    input: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      height: 40,
      includeFontPadding: false,
      lineHeight: 18,
      paddingBottom: 0,
      paddingHorizontal: 8,
      paddingRight: 72,
      paddingTop: 12,
      textAlignVertical: 'center',
    },
    inputUnit: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      position: 'absolute',
      right: 8,
      top: 18,
    },
    duplicateBox: {
      backgroundColor: colors2024['orange-light-1'],
      borderRadius: 6,
      gap: 8,
      padding: 8,
    },
    warningText: {
      color: colors2024['orange-default'],
      fontFamily: 'SF Pro',
      fontSize: 11,
      lineHeight: 14,
    },
    duplicateOrderRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    duplicateOrderPrice: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      lineHeight: 16,
    },
    amountSection: { gap: 8, marginTop: 24 },
    sliderAmountValue: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      left: 8,
      lineHeight: 18,
      position: 'absolute',
      top: 18,
    },
    amountAvailable: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      lineHeight: 16,
    },
    hiddenAmountAvailable: { opacity: 0 },
    footer: {
      marginTop: 'auto',
      paddingBottom: Math.max(
        40,
        getBottomButtonBottomOffset(safeAreaInsets.bottom),
      ),
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    },
    pristineInlineEmptyFooter: {
      paddingBottom: Math.max(
        44,
        getBottomButtonBottomOffset(safeAreaInsets.bottom),
      ),
    },
  }),
);
