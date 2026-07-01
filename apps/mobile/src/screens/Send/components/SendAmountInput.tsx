import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  TextInputKeyPressEventData,
  TextInputSelectionChangeEventData,
  TextLayoutEventData,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { RcIconAmountModeSwitch } from '@/assets/icons/send/switch-amount';
import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import { DEFAULT_MAX_FONT_SIZE } from '@/components/AutoShrinkAmountTextSizing';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { Text, TextInput } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import TokenSelect from '@/screens/Swap/components/TokenSelect';
import { createGetStyles2024 } from '@/utils/styles';

import {
  ITokenCheck,
  TokenSelectorProps,
} from '@/components/Token/TokenSelectorSheetModal';

export type SendAmountInputMode = 'token' | 'usd';

type SendAmountInputProps = {
  token: TokenItem;
  value?: string;
  displayValueText?: string;
  unit: string;
  inputPrefixText?: string;
  showInputUnit?: boolean;
  quoteText: string;
  showQuote?: boolean;
  canSwitchMode: boolean;
  balanceText?: string;
  showBalanceLoading?: boolean;
  onBalancePress?: () => void;
  balanceDisabled?: boolean;
  maxDecimalPlaces?: number | null;
  normalizeInputValue?: (value: string) => string;
  onChange?: (value: string) => void | boolean;
  onSwitchMode?: () => void;
  onTokenChange(token: TokenItem): void;
  handleClickMaxButton?: () => Promise<void> | void;
  amountFocus?: boolean;
  placeholder?: string;
  isEstimatingGas?: boolean;
  currentAccount?: KeyringAccountWithAlias | null;
  disableItemCheck?: ITokenCheck;
  type?: TokenSelectorProps['type'];
  amountInputProps?: Pick<
    React.ComponentProps<typeof TextInput>,
    'testID' | 'accessibilityLabel'
  >;
  maxButtonProps?: Pick<
    React.ComponentProps<typeof TouchableOpacity>,
    'testID' | 'accessibilityLabel'
  >;
  tokenSelectProps?: Pick<
    React.ComponentProps<typeof TokenSelect>,
    'testID' | 'accessibilityLabel'
  >;
};

function useLoadTokenList({
  onTokenChange,
  ref,
}: {
  onTokenChange?: SendAmountInputProps['onTokenChange'];
  ref?: Ref<TextInput>;
} = {}) {
  const internalInputRef = useRef<TextInput>(null);
  const tokenInputRef =
    ref && typeof ref === 'object' && 'current' in ref ? ref : internalInputRef;
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const handleCurrentTokenChange = useCallback(
    (token: TokenItem) => {
      onTokenChange?.(token);
      setTokenSelectorVisible(false);
      tokenInputRef.current?.focus();
    },
    [onTokenChange, tokenInputRef],
  );

  return {
    tokenInputRef,
    tokenSelectorVisible,
    handleCurrentTokenChange,
  };
}

const UNIT_GAP = 4;
const UNIT_COMPACT_PREFIX_LENGTH = 3;
const UNIT_COMPACT_TRIGGER_LENGTH = 6;
const CARET_BUFFER = 7;
const MAIN_FONT_SIZE = DEFAULT_MAX_FONT_SIZE;
const MIN_AMOUNT_FONT_SIZE = 17;
const AMOUNT_FONT_SIZE_STEP = 1;
const AMOUNT_CONTAINER_HEIGHT = 106;
const AMOUNT_CONTENT_HEIGHT = 66;
const AMOUNT_ROW_HEIGHT = 34;
const AMOUNT_ROW_MIN_COMPACT_HEIGHT = 34;
const AMOUNT_DEFAULT_LINE_HEIGHT = 34;
const AMOUNT_LINE_HEIGHT_EXTRA = 6;
const AMOUNT_MIN_COMPACT_LEFT_OFFSET = 6;
const AMOUNT_ROW_GAP = 12;
const QUOTE_TEXT_FONT_SIZE = 14;
const SWITCH_ICON_SIZE = 20;
const SWITCH_ICON_GAP = 4;
const BALANCE_AREA_WIDTH = 190;
const BOTTOM_ROW_PROTECTED_GAP = 12;
const EMPTY_AMOUNT_DISPLAY_VALUE = '0';
const AMOUNT_MEASURE_CHARS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '.',
  '<',
  '$',
];

function getDisplayAmountValue(value?: string) {
  return value || EMPTY_AMOUNT_DISPLAY_VALUE;
}

function getTextCharLength(text: string) {
  return Array.from(text).length;
}

function getCompactUnitText(unit: string) {
  const chars = Array.from(unit);
  if (chars.length <= UNIT_COMPACT_TRIGGER_LENGTH) {
    return unit;
  }

  return `${chars.slice(0, UNIT_COMPACT_PREFIX_LENGTH).join('')}...`;
}

function normalizeIntegerPart(value: string) {
  if (!value) {
    return EMPTY_AMOUNT_DISPLAY_VALUE;
  }

  return value.replace(/^0+(?=\d)/, '') || EMPTY_AMOUNT_DISPLAY_VALUE;
}

function normalizeDisplayAmountValue(value: string) {
  const normalizedSeparatorValue = value.replace(',', '.');
  if (!normalizedSeparatorValue) {
    return '';
  }

  const dotIndex = normalizedSeparatorValue.indexOf('.');
  if (dotIndex >= 0) {
    return `${normalizeIntegerPart(
      normalizedSeparatorValue.slice(0, dotIndex),
    )}${normalizedSeparatorValue.slice(dotIndex)}`;
  }

  return normalizeIntegerPart(normalizedSeparatorValue);
}

function getAmountRowHeight(isMinCompactLayout: boolean) {
  return isMinCompactLayout ? AMOUNT_ROW_MIN_COMPACT_HEIGHT : AMOUNT_ROW_HEIGHT;
}

function getAmountLineHeight(fontSize: number, isMinCompactLayout: boolean) {
  const rowHeight = getAmountRowHeight(isMinCompactLayout);
  return Math.min(
    rowHeight,
    Math.max(fontSize, Math.round(fontSize + AMOUNT_LINE_HEIGHT_EXTRA)),
  );
}

function getCenteredTextTop(rowHeight: number, lineHeight: number) {
  return Math.max(0, Math.round((rowHeight - lineHeight) / 2));
}

function getAmountTextTop(fontSize: number, isMinCompactLayout: boolean) {
  return getCenteredTextTop(
    getAmountRowHeight(isMinCompactLayout),
    getAmountLineHeight(fontSize, isMinCompactLayout),
  );
}

function getUnitLineHeight(fontSize: number, isMinCompactLayout: boolean) {
  return getAmountLineHeight(fontSize, isMinCompactLayout);
}

function getUnitTextTop(fontSize: number, isMinCompactLayout: boolean) {
  return getCenteredTextTop(
    getAmountRowHeight(isMinCompactLayout),
    getUnitLineHeight(fontSize, isMinCompactLayout),
  );
}

function getAmountVerticalLayout(
  fontSize: number,
  isMinCompactLayout: boolean,
) {
  return {
    amountRowHeight: getAmountRowHeight(isMinCompactLayout),
    amountLineHeight: getAmountLineHeight(fontSize, isMinCompactLayout),
    amountTextTop: getAmountTextTop(fontSize, isMinCompactLayout),
    unitLineHeight: getUnitLineHeight(fontSize, isMinCompactLayout),
    unitTextTop: getUnitTextTop(fontSize, isMinCompactLayout),
  };
}

export const SendAmountInput = ({
  token,
  value,
  displayValueText,
  unit,
  inputPrefixText,
  showInputUnit = true,
  quoteText,
  showQuote = true,
  canSwitchMode,
  balanceText,
  showBalanceLoading,
  onBalancePress,
  balanceDisabled,
  maxDecimalPlaces,
  normalizeInputValue,
  onChange,
  onSwitchMode,
  onTokenChange,
  amountFocus,
  style,
  handleClickMaxButton,
  isEstimatingGas,
  placeholder,
  disableItemCheck,
  currentAccount,
  amountInputProps,
  maxButtonProps,
  tokenSelectProps,
  ref,
}: React.PropsWithChildren<RNViewProps & SendAmountInputProps> & {
  ref?: Ref<TextInput>;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { tokenInputRef, tokenSelectorVisible, handleCurrentTokenChange } =
    useLoadTokenList({
      onTokenChange,
      ref,
    });
  const unitTextRef = useRef<{
    setNativeProps?: (nativeProps: object) => void;
  } | null>(null);
  const inputSelectionRef = useRef({
    start: getDisplayAmountValue(value).length,
    end: getDisplayAmountValue(value).length,
  });

  const [inputAreaWidth, setInputAreaWidth] = useState(0);
  const [charWidthsAtBaseFontSize, setCharWidthsAtBaseFontSize] = useState<
    Record<string, number>
  >({});
  const [unitWidthAtBaseFontSize, setUnitWidthAtBaseFontSize] = useState(0);
  const [quoteRowWidth, setQuoteRowWidth] = useState(0);
  const [quoteNaturalWidth, setQuoteNaturalWidth] = useState(0);
  const [inputValue, setInputValue] = useState(value || '');
  const [inputSelection, setInputSelection] = useState(
    inputSelectionRef.current,
  );
  const [isInputFocused, setIsInputFocused] = useState(false);

  const setUnitTextNodeRef = useCallback(
    (node: { setNativeProps?: (nativeProps: object) => void } | null) => {
      unitTextRef.current = node;
    },
    [],
  );
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useLayoutEffect(() => {
    if (amountFocus && !tokenSelectorVisible) {
      tokenInputRef.current?.focus();
    }
  }, [amountFocus, tokenSelectorVisible, tokenInputRef]);

  const Linear = useCallback(() => {
    return (
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.skeletonLinear}
        colors={[colors2024['neutral-line'], colors2024['neutral-bg-2']]}
      />
    );
  }, [colors2024, styles.skeletonLinear]);

  const hasDisplayValueOverride = !!displayValueText;
  const displayInputValue = getDisplayAmountValue(
    displayValueText || inputValue,
  );
  const displayInputPrefixText = inputPrefixText || '';
  const shouldShowInputUnit = showInputUnit && !!unit;
  const displayUnitText = useMemo(
    () => (shouldShowInputUnit ? getCompactUnitText(unit) : ''),
    [shouldShowInputUnit, unit],
  );
  const textForMeasure = displayInputValue;
  const textInputValue = inputValue;
  const decimalPlacesLimit = useMemo(() => {
    if (
      typeof maxDecimalPlaces !== 'number' ||
      !Number.isFinite(maxDecimalPlaces) ||
      maxDecimalPlaces < 0
    ) {
      return undefined;
    }

    return Math.floor(maxDecimalPlaces);
  }, [maxDecimalPlaces]);
  const fallbackCharWidth =
    charWidthsAtBaseFontSize['0'] || MAIN_FONT_SIZE * 0.56;
  const fallbackUnitWidth = shouldShowInputUnit
    ? Math.max(getTextCharLength(displayUnitText), 1) * MAIN_FONT_SIZE * 0.58
    : 0;
  const measuredUnitWidthAtBaseFontSize =
    unitWidthAtBaseFontSize || fallbackUnitWidth;
  const getValueWidthAtBaseFontSize = useCallback(
    (text: string) => {
      return text
        .split('')
        .reduce(
          (sum, char) =>
            sum + (charWidthsAtBaseFontSize[char] || fallbackCharWidth),
          0,
        );
    },
    [charWidthsAtBaseFontSize, fallbackCharWidth],
  );
  const prefixWidthAtBaseFontSize = displayInputPrefixText
    ? getValueWidthAtBaseFontSize(displayInputPrefixText)
    : 0;

  const getAmountLayout = useCallback(
    (nextValue: string) => {
      const nextValueWidthAtBaseFontSize = getValueWidthAtBaseFontSize(
        nextValue || '0',
      );
      const unitGap = shouldShowInputUnit ? UNIT_GAP : 0;
      if (!inputAreaWidth || !nextValueWidthAtBaseFontSize) {
        const prefixWidth = Math.ceil(prefixWidthAtBaseFontSize);
        const visibleValueWidth =
          nextValueWidthAtBaseFontSize > 0
            ? Math.ceil(nextValueWidthAtBaseFontSize) + CARET_BUFFER
            : 0;
        const unitWidth = shouldShowInputUnit
          ? Math.ceil(measuredUnitWidthAtBaseFontSize) + 2
          : 0;

        return {
          fittingFontSize: MAIN_FONT_SIZE,
          prefixWidth,
          valueInputWidth: undefined,
          unitLeft: shouldShowInputUnit
            ? prefixWidth + visibleValueWidth + UNIT_GAP
            : 0,
          unitWidth,
          isMinCompactLayout: false,
        };
      }

      let nextFittingFontSize = MIN_AMOUNT_FONT_SIZE;
      for (
        let fontSize = MAIN_FONT_SIZE;
        fontSize >= MIN_AMOUNT_FONT_SIZE;
        fontSize -= AMOUNT_FONT_SIZE_STEP
      ) {
        const scaledPrefixWidth =
          (prefixWidthAtBaseFontSize * fontSize) / MAIN_FONT_SIZE;
        const scaledValueWidth =
          (nextValueWidthAtBaseFontSize * fontSize) / MAIN_FONT_SIZE;
        const scaledUnitWidth = shouldShowInputUnit
          ? (measuredUnitWidthAtBaseFontSize * fontSize) / MAIN_FONT_SIZE
          : 0;
        const totalWidth =
          scaledPrefixWidth +
          scaledValueWidth +
          CARET_BUFFER +
          scaledUnitWidth +
          unitGap;

        if (totalWidth <= inputAreaWidth) {
          nextFittingFontSize = fontSize;
          break;
        }
      }

      const minPrefixWidth =
        (prefixWidthAtBaseFontSize * MIN_AMOUNT_FONT_SIZE) / MAIN_FONT_SIZE;
      const minValueWidth =
        (nextValueWidthAtBaseFontSize * MIN_AMOUNT_FONT_SIZE) / MAIN_FONT_SIZE;
      const minUnitWidth = shouldShowInputUnit
        ? (measuredUnitWidthAtBaseFontSize * MIN_AMOUNT_FONT_SIZE) /
          MAIN_FONT_SIZE
        : 0;
      const minTotalWidth =
        minPrefixWidth + minValueWidth + CARET_BUFFER + minUnitWidth + unitGap;
      const isMinCompactLayout =
        nextFittingFontSize === MIN_AMOUNT_FONT_SIZE &&
        minTotalWidth > inputAreaWidth;
      const effectiveInputAreaWidth = isMinCompactLayout
        ? inputAreaWidth + AMOUNT_MIN_COMPACT_LEFT_OFFSET
        : inputAreaWidth;

      const valueWidth =
        (nextValueWidthAtBaseFontSize * nextFittingFontSize) / MAIN_FONT_SIZE;
      const prefixWidth = Math.ceil(
        (prefixWidthAtBaseFontSize * nextFittingFontSize) / MAIN_FONT_SIZE,
      );
      const scaledUnitWidth = shouldShowInputUnit
        ? (measuredUnitWidthAtBaseFontSize * nextFittingFontSize) /
          MAIN_FONT_SIZE
        : 0;
      const unitWidth = shouldShowInputUnit
        ? Math.ceil(scaledUnitWidth) + 2
        : 0;
      const reservedAfterValue = shouldShowInputUnit ? UNIT_GAP + unitWidth : 0;
      const maxValueWidth = Math.max(
        effectiveInputAreaWidth - prefixWidth - reservedAfterValue,
        1,
      );
      const visibleValueWidth = Math.min(
        Math.ceil(valueWidth) + CARET_BUFFER,
        maxValueWidth,
      );

      return {
        fittingFontSize: nextFittingFontSize,
        prefixWidth,
        valueInputWidth: maxValueWidth,
        unitLeft: shouldShowInputUnit
          ? prefixWidth + visibleValueWidth + UNIT_GAP
          : 0,
        unitWidth,
        isMinCompactLayout,
      };
    },
    [
      getValueWidthAtBaseFontSize,
      inputAreaWidth,
      measuredUnitWidthAtBaseFontSize,
      prefixWidthAtBaseFontSize,
      shouldShowInputUnit,
    ],
  );

  const {
    fittingFontSize,
    prefixWidth,
    valueInputWidth,
    unitLeft,
    unitWidth,
    isMinCompactLayout,
  } = useMemo(
    () => getAmountLayout(textForMeasure),
    [getAmountLayout, textForMeasure],
  );
  const inputLeft = prefixWidth;
  const inputWidth = valueInputWidth;
  const normalizedSelectionStart = Math.max(
    0,
    Math.min(inputSelection.start, textInputValue.length),
  );
  const normalizedSelectionEnd = Math.max(
    normalizedSelectionStart,
    Math.min(inputSelection.end, textInputValue.length),
  );
  const isInputSelectionCollapsed =
    normalizedSelectionStart === normalizedSelectionEnd;
  const decimalSeparatorIndex = textInputValue.indexOf('.');
  const decimalPlacesCount =
    decimalSeparatorIndex >= 0
      ? textInputValue.length - decimalSeparatorIndex - 1
      : 0;
  const inputMaxLength =
    decimalPlacesLimit !== undefined &&
    decimalSeparatorIndex >= 0 &&
    isInputSelectionCollapsed &&
    normalizedSelectionStart > decimalSeparatorIndex &&
    decimalPlacesCount >= decimalPlacesLimit
      ? textInputValue.length
      : undefined;

  const applyUnitLayoutNative = useCallback(
    (nextValue: string) => {
      if (!shouldShowInputUnit) {
        return;
      }

      const nextLayout = getAmountLayout(getDisplayAmountValue(nextValue));
      const nextVerticalLayout = getAmountVerticalLayout(
        nextLayout.fittingFontSize,
        nextLayout.isMinCompactLayout,
      );
      unitTextRef.current?.setNativeProps?.({
        style: {
          fontSize: nextLayout.fittingFontSize,
          top: nextVerticalLayout.unitTextTop,
          height: nextVerticalLayout.unitLineHeight,
          lineHeight: nextVerticalLayout.unitLineHeight,
          left: nextLayout.unitLeft,
          width: nextLayout.unitWidth,
        },
      });
    },
    [getAmountLayout, shouldShowInputUnit],
  );

  const handleInputAreaLayout = (event: LayoutChangeEvent) => {
    setInputAreaWidth(event.nativeEvent.layout.width);
  };

  const handleCharMeasure = (
    char: string,
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const width = event.nativeEvent.lines[0]?.width || 0;
    setCharWidthsAtBaseFontSize(prev =>
      prev[char] === width
        ? prev
        : {
            ...prev,
            [char]: width,
          },
    );
  };

  const handleUnitMeasure = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    setUnitWidthAtBaseFontSize(event.nativeEvent.lines[0]?.width || 0);
  };

  const handleQuoteRowLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.ceil(event.nativeEvent.layout.width);
    setQuoteRowWidth(prev => (prev === width ? prev : width));
  }, []);

  const handleQuoteMeasure = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const width = Math.ceil(event.nativeEvent.lines[0]?.width || 0);
      setQuoteNaturalWidth(prev => (prev === width ? prev : width));
    },
    [],
  );

  const handleInputSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const nextSelection = event.nativeEvent.selection;
      inputSelectionRef.current = nextSelection;
      setInputSelection(prev =>
        prev.start === nextSelection.start && prev.end === nextSelection.end
          ? prev
          : nextSelection,
      );
    },
    [],
  );
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  const normalizeTypedInputValue = useCallback(
    (nextValue: string) => {
      const normalizedValue = normalizeDisplayAmountValue(nextValue);
      return normalizeInputValue
        ? normalizeInputValue(normalizedValue)
        : normalizedValue;
    },
    [normalizeInputValue],
  );

  const getPredictedValueFromKey = useCallback(
    (key: string) => {
      const selection = inputSelectionRef.current;
      const start = Math.max(
        0,
        Math.min(selection.start, textInputValue.length),
      );
      const end = Math.max(
        start,
        Math.min(selection.end, textInputValue.length),
      );

      if (key === 'Backspace') {
        if (start !== end) {
          return normalizeTypedInputValue(
            textInputValue.slice(0, start) + textInputValue.slice(end),
          );
        }
        if (start > 0) {
          return normalizeTypedInputValue(
            textInputValue.slice(0, start - 1) + textInputValue.slice(end),
          );
        }
        return inputValue;
      }

      if (key.length === 1) {
        return normalizeTypedInputValue(
          textInputValue.slice(0, start) + key + textInputValue.slice(end),
        );
      }

      return null;
    },
    [inputValue, normalizeTypedInputValue, textInputValue],
  );

  const handleInputKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const predictedValue = getPredictedValueFromKey(event.nativeEvent.key);
      if (predictedValue !== null) {
        applyUnitLayoutNative(predictedValue);
      }
    },
    [applyUnitLayoutNative, getPredictedValueFromKey],
  );

  const handleInputChange = useCallback(
    (nextValue: string) => {
      const previousValue = inputValue;
      const normalizedValue = normalizeTypedInputValue(nextValue);

      if (normalizedValue !== nextValue) {
        tokenInputRef.current?.setNativeProps?.({
          text: normalizedValue,
        });
      }

      if (normalizedValue === previousValue) {
        applyUnitLayoutNative(previousValue);
        return;
      }

      applyUnitLayoutNative(normalizedValue);
      setInputValue(normalizedValue);
      const result = onChange?.(normalizedValue);
      if (result === false) {
        tokenInputRef.current?.setNativeProps?.({
          text: previousValue,
        });
        applyUnitLayoutNative(previousValue);
        setInputValue(previousValue);
      }
    },
    [
      applyUnitLayoutNative,
      inputValue,
      normalizeTypedInputValue,
      onChange,
      tokenInputRef,
    ],
  );

  const handleSwitchModePress = useCallback(() => {
    onSwitchMode?.();
    requestAnimationFrame(() => {
      tokenInputRef.current?.focus();
    });
  }, [onSwitchMode, tokenInputRef]);

  const quoteTextMaxWidth = useMemo(() => {
    if (!quoteRowWidth) {
      return 0;
    }

    const switchReservedWidth = canSwitchMode
      ? SWITCH_ICON_SIZE + SWITCH_ICON_GAP
      : 0;

    return Math.max(quoteRowWidth - switchReservedWidth, 1);
  }, [canSwitchMode, quoteRowWidth]);
  const shouldFixQuoteWidth =
    !!quoteTextMaxWidth && quoteNaturalWidth >= quoteTextMaxWidth - 1;
  const quoteTextWidthStyle = quoteTextMaxWidth
    ? shouldFixQuoteWidth
      ? { width: quoteTextMaxWidth }
      : { maxWidth: quoteTextMaxWidth }
    : null;

  const hasValue = !!inputValue || hasDisplayValueOverride;
  const showAmountSkeleton = !hasValue && token.amount > 0 && isEstimatingGas;
  const showStaticEmptyAmount =
    !hasValue && !isInputFocused && !showAmountSkeleton;
  const {
    amountRowHeight,
    amountLineHeight,
    amountTextTop,
    unitLineHeight,
    unitTextTop,
  } = useMemo(
    () => getAmountVerticalLayout(fittingFontSize, isMinCompactLayout),
    [fittingFontSize, isMinCompactLayout],
  );
  const compactAmountRowStyle =
    isMinCompactLayout && inputAreaWidth
      ? {
          marginLeft: -AMOUNT_MIN_COMPACT_LEFT_OFFSET,
          width: inputAreaWidth + AMOUNT_MIN_COMPACT_LEFT_OFFSET,
        }
      : null;
  const isBalancePressDisabled =
    balanceDisabled || showBalanceLoading || !onBalancePress;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <SilentTouchableView
            viewStyle={styles.leftInputContainer}
            onPress={evt => {
              evt.stopPropagation();
              tokenInputRef.current?.focus();
            }}>
            <View
              style={styles.leftInputContent}
              onLayout={handleInputAreaLayout}>
              {showAmountSkeleton ? (
                <CustomSkeleton
                  animation="wave"
                  LinearGradientComponent={Linear}
                  style={styles.skeleton}
                />
              ) : (
                <View
                  style={[
                    styles.amountRow,
                    {
                      height: amountRowHeight,
                    },
                    compactAmountRowStyle,
                  ]}>
                  {displayInputPrefixText ? (
                    <Text
                      pointerEvents="none"
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      numberOfLines={1}
                      style={[
                        styles.inputPrefixText,
                        {
                          top: amountTextTop,
                          height: amountLineHeight,
                          lineHeight: amountLineHeight,
                          fontSize: fittingFontSize,
                          width: prefixWidth,
                        },
                        showStaticEmptyAmount && styles.staticHiddenInput,
                      ]}>
                      {displayInputPrefixText}
                    </Text>
                  ) : null}
                  <TextInput
                    ref={tokenInputRef}
                    value={textInputValue}
                    onChangeText={handleInputChange}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    numberOfLines={1}
                    multiline={false}
                    scrollEnabled
                    maxLength={inputMaxLength}
                    placeholder={EMPTY_AMOUNT_DISPLAY_VALUE}
                    placeholderTextColor={colors2024['neutral-info']}
                    selectionColor={colors2024['brand-default']}
                    cursorColor={colors2024['brand-default']}
                    onKeyPress={handleInputKeyPress}
                    onSelectionChange={handleInputSelectionChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    style={[
                      styles.input,
                      {
                        top: amountTextTop,
                        height: amountLineHeight,
                        lineHeight: amountLineHeight,
                        left: inputLeft,
                        fontSize: fittingFontSize,
                        width: inputWidth,
                      },
                      (showStaticEmptyAmount || hasDisplayValueOverride) &&
                        styles.staticHiddenInput,
                    ]}
                    {...amountInputProps}
                  />
                  {hasDisplayValueOverride ? (
                    <Text
                      pointerEvents="none"
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.displayValueText,
                        {
                          top: amountTextTop,
                          height: amountLineHeight,
                          lineHeight: amountLineHeight,
                          left: inputLeft,
                          fontSize: fittingFontSize,
                          width: inputWidth,
                        },
                      ]}>
                      {displayValueText}
                    </Text>
                  ) : null}
                  {shouldShowInputUnit ? (
                    IS_ANDROID ? (
                      <Text
                        ref={setUnitTextNodeRef}
                        pointerEvents="none"
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.unitText,
                          {
                            top: unitTextTop,
                            height: unitLineHeight,
                            lineHeight: unitLineHeight,
                            fontSize: fittingFontSize,
                            left: unitLeft,
                            width: unitWidth,
                          },
                          showStaticEmptyAmount && styles.staticHiddenInput,
                        ]}>
                        {displayUnitText}
                      </Text>
                    ) : (
                      <TextInput
                        ref={setUnitTextNodeRef}
                        value={displayUnitText}
                        editable={false}
                        caretHidden
                        contextMenuHidden
                        pointerEvents="none"
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        numberOfLines={1}
                        multiline={false}
                        scrollEnabled={false}
                        style={[
                          styles.unitText,
                          {
                            top: unitTextTop,
                            height: unitLineHeight,
                            lineHeight: unitLineHeight,
                            fontSize: fittingFontSize,
                            left: unitLeft,
                            width: unitWidth,
                          },
                          showStaticEmptyAmount && styles.staticHiddenInput,
                        ]}
                      />
                    )
                  ) : null}
                  {showStaticEmptyAmount ? (
                    <View
                      pointerEvents="none"
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={styles.staticEmptyAmountRow}>
                      {displayInputPrefixText ? (
                        <Text
                          numberOfLines={1}
                          style={styles.staticInputPrefixText}>
                          {displayInputPrefixText}
                        </Text>
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={styles.staticEmptyAmountText}>
                        {EMPTY_AMOUNT_DISPLAY_VALUE}
                      </Text>
                      {shouldShowInputUnit ? (
                        <Text numberOfLines={1} style={styles.staticUnitText}>
                          {displayUnitText}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </SilentTouchableView>

          <View style={styles.rightControls}>
            {!hasValue && token.amount > 0 && !isEstimatingGas ? (
              <TouchableOpacity
                disabled={isEstimatingGas}
                style={styles.maxButtonWrapper}
                onPress={handleClickMaxButton}
                {...maxButtonProps}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.divider} />
            <TokenSelect
              accountInScreen={currentAccount}
              chainId=""
              token={token}
              disableItemCheck={disableItemCheck}
              onTokenChange={handleCurrentTokenChange}
              type="send"
              placeholder={placeholder}
              supportChains={[]}
              style={styles.tokenSelect}
              {...tokenSelectProps}
            />
          </View>
        </View>

        <View style={styles.bottomRow}>
          {showQuote ? (
            <TouchableOpacity
              activeOpacity={canSwitchMode ? 0.7 : 1}
              disabled={!canSwitchMode}
              onPress={handleSwitchModePress}
              style={styles.quoteRow}
              onLayout={handleQuoteRowLayout}
              hitSlop={8}>
              <Text
                style={[styles.quoteText, quoteTextWidthStyle]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {quoteText}
              </Text>
              {canSwitchMode ? (
                <View style={styles.switchIcon}>
                  <RcIconAmountModeSwitch
                    fillColor={colors2024['neutral-line']}
                    iconColor={colors2024['neutral-foot']}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          ) : (
            <View style={styles.quotePlaceholder} />
          )}

          <View style={styles.bottomRowSpacer} />

          <TouchableOpacity
            activeOpacity={isBalancePressDisabled ? 1 : 0.7}
            disabled={isBalancePressDisabled}
            onPress={onBalancePress}
            style={styles.balanceArea}
            hitSlop={8}>
            {showBalanceLoading ? (
              <CustomSkeleton
                animation="wave"
                LinearGradientComponent={Linear}
                style={styles.balanceSkeleton}
              />
            ) : balanceText ? (
              <>
                <RcIconWalletCC
                  width={16}
                  height={16}
                  color={colors2024['neutral-foot']}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.balanceText}>
                  {balanceText}
                </Text>
              </>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {AMOUNT_MEASURE_CHARS.map(char => (
        <Text
          key={char}
          numberOfLines={1}
          onTextLayout={event => handleCharMeasure(char, event)}
          style={[styles.measureText, styles.measureValueText]}>
          {char}
        </Text>
      ))}
      <Text
        numberOfLines={1}
        onTextLayout={handleUnitMeasure}
        style={[styles.measureText, styles.measureUnitText]}>
        {displayUnitText}
      </Text>
      {showQuote ? (
        <Text
          numberOfLines={1}
          onTextLayout={handleQuoteMeasure}
          style={[styles.measureText, styles.measureQuoteText]}>
          {quoteText}
        </Text>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      height: AMOUNT_CONTAINER_HEIGHT,
      paddingHorizontal: 16,
      paddingVertical: 20,
      overflow: 'hidden',
    },
    content: {
      height: AMOUNT_CONTENT_HEIGHT,
      gap: AMOUNT_ROW_GAP,
    },
    topRow: {
      height: AMOUNT_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    leftInputContainer: {
      flex: 1,
      minWidth: 0,
      height: AMOUNT_ROW_HEIGHT,
    },
    leftInputContent: {
      height: AMOUNT_ROW_HEIGHT,
      position: 'relative',
    },
    amountRow: {
      height: AMOUNT_ROW_HEIGHT,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      overflow: 'hidden',
    },
    inputPrefixText: {
      position: 'absolute',
      left: 0,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      includeFontPadding: false,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
      overflow: 'hidden',
      zIndex: 2,
    },
    input: {
      position: 'absolute',
      left: 0,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
      includeFontPadding: false,
      overflow: 'hidden',
      minWidth: 1,
      zIndex: 1,
    },
    displayValueText: {
      position: 'absolute',
      left: 0,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
      includeFontPadding: false,
      overflow: 'hidden',
      zIndex: 3,
    },
    unitText: {
      position: 'absolute',
      color: colors2024['neutral-info'],
      backgroundColor: colors2024['neutral-bg-2'],
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      includeFontPadding: false,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
      overflow: 'hidden',
      zIndex: 2,
    },
    staticHiddenInput: {
      opacity: 0,
    },
    staticEmptyAmountRow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: AMOUNT_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      zIndex: 3,
    },
    staticInputPrefixText: {
      color: colors2024['neutral-title-1'],
      fontSize: MAIN_FONT_SIZE,
      fontWeight: '700',
      lineHeight: AMOUNT_DEFAULT_LINE_HEIGHT,
      fontFamily: 'SF Pro Rounded',
      includeFontPadding: false,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    staticEmptyAmountText: {
      color: colors2024['neutral-info'],
      fontSize: MAIN_FONT_SIZE,
      fontWeight: '700',
      lineHeight: AMOUNT_DEFAULT_LINE_HEIGHT,
      fontFamily: 'SF Pro Rounded',
      includeFontPadding: false,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    staticUnitText: {
      color: colors2024['neutral-info'],
      fontSize: MAIN_FONT_SIZE,
      fontWeight: '700',
      lineHeight: AMOUNT_DEFAULT_LINE_HEIGHT,
      fontFamily: 'SF Pro Rounded',
      includeFontPadding: false,
      marginLeft: CARET_BUFFER + UNIT_GAP,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    bottomRow: {
      height: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    quoteRow: {
      height: 20,
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    quoteText: {
      color: colors2024['neutral-foot'],
      fontSize: QUOTE_TEXT_FONT_SIZE,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      flexShrink: 1,
      minWidth: 0,
    },
    quotePlaceholder: {
      flex: 1,
      minWidth: 0,
    },
    bottomRowSpacer: {
      width: BOTTOM_ROW_PROTECTED_GAP,
      flexShrink: 0,
    },
    switchIcon: {
      width: SWITCH_ICON_SIZE,
      height: SWITCH_ICON_SIZE,
      marginLeft: SWITCH_ICON_GAP,
      flexShrink: 0,
      transform: [{ rotate: '-90deg' }],
    },
    rightControls: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      height: AMOUNT_ROW_HEIGHT,
      gap: 12,
      marginLeft: 12,
    },
    divider: {
      height: 28,
      width: 1,
      backgroundColor: colors2024['neutral-line'],
    },
    tokenSelect: {
      borderRadius: 100,
    },
    maxButtonWrapper: {
      padding: 4,
      backgroundColor: colors2024['brand-light-1'],
      borderRadius: 8,
    },
    maxButtonText: {
      color: colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    skeleton: {
      marginTop: 0,
      backgroundColor: colors2024['neutral-line'],
      height: AMOUNT_ROW_HEIGHT,
      width: 120,
      borderRadius: 100,
    },
    skeletonLinear: {
      height: '100%',
    },
    balanceArea: {
      maxWidth: BALANCE_AREA_WIDTH,
      height: 20,
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: 4,
    },
    balanceText: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      maxWidth: BALANCE_AREA_WIDTH - 20,
      flexShrink: 1,
      minWidth: 0,
    },
    balanceSkeleton: {
      backgroundColor: colors2024['neutral-line'],
      height: 16,
      width: 100,
      borderRadius: 8,
    },
    measureText: {
      position: 'absolute',
      width: 10000,
      opacity: 0,
      zIndex: -1,
    },
    measureValueText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: MAIN_FONT_SIZE,
      lineHeight: AMOUNT_DEFAULT_LINE_HEIGHT,
    },
    measureUnitText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: MAIN_FONT_SIZE,
      lineHeight: AMOUNT_DEFAULT_LINE_HEIGHT,
    },
    measureQuoteText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      fontSize: QUOTE_TEXT_FONT_SIZE,
      lineHeight: 18,
    },
  }),
);
