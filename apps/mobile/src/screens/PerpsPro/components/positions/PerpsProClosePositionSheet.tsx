import RcOrderTypeSwitch from '@/assets2024/icons/perps/icon-switch-mode.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BOTTOM_BUTTON_COMPACT_HEIGHT } from '@/constant/layout';
import { usePerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import {
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
} from '../common/perpsProVisual';
import {
  resolvePerpsProCloseSize,
  type PerpsProCloseDraft,
  type PerpsProCloseMarketSnapshot,
} from '../../model/positionAction';
import {
  getPerpsProAmountInputDecimals,
  getPerpsProPriceInputMaxDecimals,
  isPerpsProPriceProtocolValid,
  resolvePerpsProDisplayAmount,
  sanitizePerpsProDecimalInput,
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
  type PerpsProTradeAmountUnit,
} from '../../model/trade';
import { usePerpsProPositionMark } from '../../scene/usePerpsProPositionMark';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { resolvePerpsProEmptyInputSelection } from '../common/perpsProInputSelection';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { PerpsProSlider } from '../common/PerpsProSlider';
import { usePerpsProDismissKeyboard } from '../common/usePerpsProDismissKeyboard';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PerpsProCloseMarketTag } from './PerpsProCloseMarketTag';
import { getPerpsProClosePositionSheetStyles } from './PerpsProClosePositionSheet.styles';

const PerpsProCloseBottomSheetTextInput = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput>
>((props, forwardedRef) => (
  <BottomSheetTextInput
    {...props}
    ref={
      forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
    }
  />
));

PerpsProCloseBottomSheetTextInput.displayName =
  'PerpsProCloseBottomSheetTextInput';

const calculateEstimatedPnl = (
  position: PerpsPositionViewModel,
  exitPrice: string,
  size: string | null,
) => {
  const entry = new BigNumber(position.entryPrice ?? Number.NaN);
  const exit = new BigNumber(exitPrice || Number.NaN);
  const amount = new BigNumber(size ?? Number.NaN);
  if (
    !entry.isFinite() ||
    !exit.isFinite() ||
    !amount.isFinite() ||
    entry.lte(0) ||
    exit.lte(0) ||
    amount.lte(0)
  ) {
    return null;
  }
  return (position.direction === 'long' ? exit.minus(entry) : entry.minus(exit))
    .multipliedBy(amount)
    .toString();
};

export const PerpsProClosePositionSheet: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  coveredByReview?: boolean;
  market: PerpsProCloseMarketSnapshot;
  onClose: () => void;
  onReview: (draft: PerpsProCloseDraft) => void;
  position: PerpsPositionViewModel;
  visible: boolean;
}> = React.memo(
  ({
    amountUnit = 'quote',
    coveredByReview = false,
    market,
    onClose,
    onReview,
    position,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const previousAmountUnitRef = useRef(amountUnit);
    const { colors2024, styles } = useTheme2024({
      getStyle: getPerpsProClosePositionSheetStyles,
    });
    const { t } = useTranslation();
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !coveredByReview,
    });
    const dismissKeyboardThen = usePerpsProDismissKeyboard();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const liveMarket = usePerpsProPositionMark(position.coin);
    const latestTrade = usePerpsLatestTrade({
      coin: position.coin,
      enabled: visible && !coveredByReview,
    });
    const readyLatestTradePrice =
      latestTrade.status === 'ready' ? latestTrade.trade?.price : null;
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [inputSource, setInputSource] =
      useState<PerpsProCloseDraft['inputSource']>('slider');
    const inputSourceRef = useRef<PerpsProCloseDraft['inputSource']>('slider');
    const discardNextSliderBackspaceChangeRef = useRef(false);
    const [percent, setPercent] = useState(100);
    const sliderValue = inputSource === 'slider' ? percent : 0;
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: !visible || coveredByReview,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: sliderValue,
    });
    const [manualAmount, setManualAmount] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [limitPriceDirty, setLimitPriceDirty] = useState(false);
    const normalizeLimitPrice = useCallback(
      (value: string) =>
        sanitizePerpsProPriceEditingInput(value, market.szDecimals),
      [market.szDecimals],
    );
    const canonicalizeLimitPrice = useCallback(
      (value: string) => sanitizePerpsProPriceInput(value, market.szDecimals),
      [market.szDecimals],
    );

    useEffect(() => {
      if (visible) {
        setOrderType('market');
        inputSourceRef.current = 'slider';
        discardNextSliderBackspaceChangeRef.current = false;
        setInputSource('slider');
        setPercent(100);
        setManualAmount('');
        setLimitPrice('');
        setLimitPriceDirty(false);
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [position.key, visible]);

    useEffect(() => {
      if (orderType === 'limit' && !limitPriceDirty && readyLatestTradePrice) {
        setLimitPrice(canonicalizeLimitPrice(readyLatestTradePrice));
      }
    }, [
      canonicalizeLimitPrice,
      limitPriceDirty,
      orderType,
      readyLatestTradePrice,
    ]);

    const markPrice = liveMarket.markPrice || market.markPrice;
    const referencePrice =
      orderType === 'market' ? markPrice || '' : limitPrice;
    const size = useMemo(
      () =>
        resolvePerpsProCloseSize({
          amountUnit,
          inputSource,
          manualAmount,
          percent,
          positionSize: position.baseSize,
          referencePrice,
          szDecimals: market.szDecimals,
        }),
      [
        amountUnit,
        inputSource,
        manualAmount,
        market.szDecimals,
        percent,
        position.baseSize,
        referencePrice,
      ],
    );
    const displaySize = resolvePerpsProDisplayAmount({
      amountUnit,
      baseAmount: size || '',
      price: referencePrice,
    });
    const positionDisplaySize = resolvePerpsProDisplayAmount({
      amountUnit,
      baseAmount: position.baseSize,
      price: markPrice,
    });
    const displayUnit =
      amountUnit === 'base' ? market.displayBase : market.quoteAsset;
    const displayDecimals = amountUnit === 'base' ? market.szDecimals : 2;
    const estimatedPnl = calculateEstimatedPnl(position, referencePrice, size);
    const estimatedPnlValue = Number(estimatedPnl);
    const estimatedPnlStyle =
      estimatedPnlValue > 0
        ? styles.positiveValue
        : estimatedPnlValue < 0
        ? styles.negativeValue
        : styles.summaryValue;
    const valid =
      !!size &&
      new BigNumber(size).gt(0) &&
      !!referencePrice &&
      new BigNumber(referencePrice).gt(0) &&
      (orderType !== 'limit' ||
        isPerpsProPriceProtocolValid(limitPrice, market.szDecimals));

    useEffect(() => {
      const previousAmountUnit = previousAmountUnitRef.current;
      previousAmountUnitRef.current = amountUnit;
      if (previousAmountUnit === amountUnit || inputSource !== 'manual') {
        return;
      }
      const previousSize = resolvePerpsProCloseSize({
        amountUnit: previousAmountUnit,
        inputSource: 'manual',
        manualAmount,
        percent,
        positionSize: position.baseSize,
        referencePrice,
        szDecimals: market.szDecimals,
      });
      if (!previousSize) {
        setManualAmount('');
        return;
      }
      const nextAmount = resolvePerpsProDisplayAmount({
        amountUnit,
        baseAmount: previousSize,
        price: referencePrice,
      });
      setManualAmount(
        nextAmount
          ? new BigNumber(nextAmount)
              .decimalPlaces(
                amountUnit === 'base' ? market.szDecimals : 2,
                BigNumber.ROUND_DOWN,
              )
              .toFixed()
          : '',
      );
    }, [
      amountUnit,
      inputSource,
      manualAmount,
      market.szDecimals,
      percent,
      position.baseSize,
      referencePrice,
    ]);

    const selectLimit = () => {
      setOrderType('limit');
      if (!limitPriceDirty && readyLatestTradePrice) {
        setLimitPrice(canonicalizeLimitPrice(readyLatestTradePrice));
      }
    };
    const beginAmountEntry = (discardNextChange = false) => {
      if (inputSourceRef.current !== 'slider') {
        if (!discardNextChange) {
          discardNextSliderBackspaceChangeRef.current = false;
        }
        return;
      }
      inputSourceRef.current = 'manual';
      discardNextSliderBackspaceChangeRef.current = discardNextChange;
      setInputSource('manual');
      setManualAmount('');
    };
    const handleAmountChange = (value: string) => {
      if (inputSourceRef.current === 'slider') {
        beginAmountEntry();
        return;
      }
      if (discardNextSliderBackspaceChangeRef.current) {
        discardNextSliderBackspaceChangeRef.current = false;
        return;
      }
      inputSourceRef.current = 'manual';
      setInputSource('manual');
      setManualAmount(
        sanitizePerpsProDecimalInput(
          value,
          getPerpsProAmountInputDecimals({
            amountUnit,
            szDecimals: market.szDecimals,
          }),
        ),
      );
    };
    const sliderDisplay = `${percent}% (≈${formatPerpsProDecimal(
      displaySize,
      displayDecimals,
    )})`;

    return (
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropProps={{
          pressBehavior: coveredByReview ? 'none' : 'close',
        }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!coveredByReview}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={onClose}
        snapPoints={[510]}
        style={styles.modal}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>
              {t('page.perps.pro.positions.closePosition')}
            </Text>
            <View
              style={styles.positionHeader}
              testID="perps-pro-close-position-header">
              <View style={styles.pairRow}>
                <Text style={styles.pair}>{market.displayPair}</Text>
                <PerpsProCloseMarketTag sourceTag={market.sourceTag} />
                <View
                  style={
                    position.direction === 'long'
                      ? styles.longTag
                      : styles.shortTag
                  }>
                  <Text
                    style={
                      position.direction === 'long'
                        ? styles.longTagText
                        : styles.shortTagText
                    }>
                    {t(`page.perps.pro.positions.${position.direction}`)}{' '}
                    {position.leverage}x
                  </Text>
                </View>
              </View>
              <View style={styles.priceSummaryRow}>
                <Text style={styles.priceSummaryLabel}>
                  {`${t('page.perps.pro.positions.entry')} (${
                    market.quoteAsset
                  })`}
                </Text>
                <Text style={styles.priceSummaryValue}>
                  {formatPerpsProPrice(position.entryPrice, market.pxDecimals)}
                </Text>
              </View>
              <View style={styles.priceSummaryRow}>
                <Text style={styles.priceSummaryLabel}>
                  {`${t('page.perps.pro.positions.mark')} (${
                    market.quoteAsset
                  })`}
                </Text>
                <Text style={styles.priceSummaryValue}>
                  {formatPerpsProPrice(markPrice, market.pxDecimals)}
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.orderRow}>
                {orderType === 'market' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={selectLimit}
                    style={[styles.priceField, styles.disabledPriceField]}
                    testID="perps-pro-close-market-price-field">
                    <Text style={styles.centeredFieldText}>
                      {t('page.perps.pro.positions.marketPrice')}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.priceField}>
                    <Text style={styles.floatingLabel}>
                      {t('page.perps.pro.positions.price')}
                    </Text>
                    <PerpsProDecimalTextInput
                      accessibilityLabel={t('page.perps.pro.positions.price')}
                      canonicalizeValueOnBlur={canonicalizeLimitPrice}
                      cursorColor={colors2024['brand-default']}
                      inputComponent={PerpsProCloseBottomSheetTextInput}
                      maxDecimals={getPerpsProPriceInputMaxDecimals(
                        market.szDecimals,
                      )}
                      normalizeValue={normalizeLimitPrice}
                      onChangeText={value => {
                        setLimitPriceDirty(true);
                        setLimitPrice(value);
                      }}
                      preserveIntegerZeroRun
                      selectionColor={colors2024['brand-default']}
                      style={styles.priceInput}
                      value={limitPrice}
                    />
                    <Text pointerEvents="none" style={styles.priceUnit}>
                      {market.quoteAsset}
                    </Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    orderType === 'market'
                      ? selectLimit()
                      : setOrderType('market')
                  }
                  style={styles.orderTypeField}>
                  <Text style={styles.orderTypeText}>
                    {t(`page.perps.pro.positions.${orderType}`)}
                  </Text>
                  <RcOrderTypeSwitch
                    color={colors2024['neutral-secondary']}
                    height={10}
                    style={styles.orderTypeSwitch}
                    width={10}
                  />
                </Pressable>
              </View>

              <View style={styles.amountGroup}>
                <View style={styles.amountField}>
                  <Text style={styles.floatingLabel}>
                    {t('page.perps.pro.positions.amount')}
                  </Text>
                  <BottomSheetTextInput
                    accessibilityLabel={t('page.perps.pro.positions.amount')}
                    cursorColor={colors2024['brand-default']}
                    keyboardType="decimal-pad"
                    maxFontSizeMultiplier={1.2}
                    multiline={false}
                    numberOfLines={1}
                    onChangeText={handleAmountChange}
                    onFocus={() => beginAmountEntry()}
                    onKeyPress={event => {
                      if (
                        event.nativeEvent.key === 'Backspace' &&
                        inputSourceRef.current === 'slider'
                      ) {
                        beginAmountEntry(true);
                      }
                    }}
                    onPressIn={() => beginAmountEntry()}
                    scrollEnabled
                    selection={
                      inputSource === 'manual' && !manualAmount
                        ? resolvePerpsProEmptyInputSelection()
                        : undefined
                    }
                    selectionColor={colors2024['brand-default']}
                    style={styles.amountInput}
                    value={
                      inputSource === 'slider' ? sliderDisplay : manualAmount
                    }
                  />
                  <Text pointerEvents="none" style={styles.amountUnit}>
                    {displayUnit}
                  </Text>
                </View>
                <PerpsProSlider
                  maximumValue={100}
                  minimumValue={0}
                  onSlidingComplete={sliderHaptics.onSlidingComplete}
                  onSlidingStart={sliderHaptics.onSlidingStart}
                  onValueChange={value => {
                    const roundedValue = Math.round(value);
                    sliderHaptics.onValueChange(roundedValue);
                    inputSourceRef.current = 'slider';
                    discardNextSliderBackspaceChangeRef.current = false;
                    setInputSource('slider');
                    setPercent(roundedValue);
                  }}
                  pointCount={5}
                  step={1}
                  tone="neutral"
                  value={sliderValue}
                />
              </View>

              <View
                style={styles.summary}
                testID="perps-pro-close-position-summary">
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t('page.perps.pro.positions.positionAmount')}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatPerpsProDecimal(
                      positionDisplaySize,
                      displayDecimals,
                    )}{' '}
                    {displayUnit}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <PerpsProDottedUnderlineText
                    accessibilityLabel={t(
                      'page.perps.pro.positions.estimatedPnl',
                    )}
                    onPress={() => openFieldExplanation('estimatedPnl')}
                    style={styles.summaryLabel}>
                    {t('page.perps.pro.positions.estimatedPnl')}
                  </PerpsProDottedUnderlineText>
                  <Text style={estimatedPnlStyle}>
                    {formatPerpsProSignedDecimal(estimatedPnl, 2)}{' '}
                    {market.quoteAsset}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={styles.footer}
              testID="perps-pro-close-position-footer">
              <Button
                buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
                disabled={!valid || coveredByReview}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                onPress={() => {
                  if (!size || coveredByReview) {
                    return;
                  }
                  if (orderType === 'limit') {
                    setLimitPriceDirty(true);
                  }
                  dismissKeyboardThen(() =>
                    onReview({
                      inputSource,
                      limitPrice: orderType === 'limit' ? limitPrice : null,
                      midPrice: market.midPrice,
                      orderType,
                      percent,
                      referencePrice,
                      size,
                    }),
                  );
                }}
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

PerpsProClosePositionSheet.displayName = 'PerpsProClosePositionSheet';
