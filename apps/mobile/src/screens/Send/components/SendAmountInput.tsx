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

import { RcIconSwitchCC } from '@/assets/icons/send';
import {
  DEFAULT_FONT_SIZE_STEP,
  DEFAULT_MAX_FONT_SIZE,
  DEFAULT_MIN_FONT_SIZE,
} from '@/components/AutoShrinkAmountTextSizing';
import { SilentTouchableView } from '@/components/Touchable/TouchableView';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { Text, TextInput } from '@/components/Typography';
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
  unit: string;
  quoteValueText: string;
  quoteUnit: string;
  canSwitchMode: boolean;
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
const CARET_BUFFER = 6;
const MAIN_FONT_SIZE = DEFAULT_MAX_FONT_SIZE;
const QUOTE_TEXT_FONT_SIZE = 14;
const QUOTE_UNIT_GAP = 4;
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
];
const QUOTE_MEASURE_CHARS = Array.from(
  new Set(
    '0123456789.,< >ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$',
  ),
);

export const SendAmountInput = ({
  token,
  value,
  unit,
  quoteValueText,
  quoteUnit,
  canSwitchMode,
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
  const unitTextRef = useRef<Text>(null);
  const inputSelectionRef = useRef({
    start: (value || '').length,
    end: (value || '').length,
  });

  const [inputAreaWidth, setInputAreaWidth] = useState(0);
  const [charWidthsAtBaseFontSize, setCharWidthsAtBaseFontSize] = useState<
    Record<string, number>
  >({});
  const [quoteCharWidths, setQuoteCharWidths] = useState<
    Record<string, number>
  >({});
  const [unitWidthAtBaseFontSize, setUnitWidthAtBaseFontSize] = useState(0);
  const [quoteUnitWidth, setQuoteUnitWidth] = useState(0);
  const [inputValue, setInputValue] = useState(value || '');

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

  const textForMeasure = inputValue || '0';
  const fallbackCharWidth =
    charWidthsAtBaseFontSize['0'] || MAIN_FONT_SIZE * 0.56;
  const fallbackUnitWidth = Math.max(unit.length, 1) * MAIN_FONT_SIZE * 0.58;
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

  const getAmountLayout = useCallback(
    (nextValue: string) => {
      const nextValueWidthAtBaseFontSize = getValueWidthAtBaseFontSize(
        nextValue || '0',
      );
      if (!inputAreaWidth || !nextValueWidthAtBaseFontSize) {
        return {
          fittingFontSize: MAIN_FONT_SIZE,
          valueInputWidth: undefined,
          unitLeft: UNIT_GAP,
        };
      }

      let nextFittingFontSize = DEFAULT_MIN_FONT_SIZE;
      for (
        let fontSize = MAIN_FONT_SIZE;
        fontSize >= DEFAULT_MIN_FONT_SIZE;
        fontSize -= DEFAULT_FONT_SIZE_STEP
      ) {
        const scaledValueWidth =
          (nextValueWidthAtBaseFontSize * fontSize) / MAIN_FONT_SIZE;
        const scaledUnitWidth =
          (measuredUnitWidthAtBaseFontSize * fontSize) / MAIN_FONT_SIZE;
        const totalWidth = scaledValueWidth + scaledUnitWidth + UNIT_GAP;

        if (totalWidth <= inputAreaWidth) {
          nextFittingFontSize = fontSize;
          break;
        }
      }

      const valueWidth =
        (nextValueWidthAtBaseFontSize * nextFittingFontSize) / MAIN_FONT_SIZE;
      const maxValueWidth = Math.max(
        inputAreaWidth - UNIT_GAP - Math.ceil(measuredUnitWidthAtBaseFontSize),
        1,
      );
      const visibleValueWidth = Math.min(
        Math.ceil(valueWidth) + CARET_BUFFER,
        maxValueWidth,
      );

      return {
        fittingFontSize: nextFittingFontSize,
        valueInputWidth: maxValueWidth,
        unitLeft: visibleValueWidth + UNIT_GAP,
      };
    },
    [
      getValueWidthAtBaseFontSize,
      inputAreaWidth,
      measuredUnitWidthAtBaseFontSize,
    ],
  );

  const { fittingFontSize, valueInputWidth, unitLeft } = useMemo(
    () => getAmountLayout(textForMeasure),
    [getAmountLayout, textForMeasure],
  );

  const applyUnitLayoutNative = useCallback(
    (nextValue: string) => {
      const nextLayout = getAmountLayout(nextValue);
      unitTextRef.current?.setNativeProps({
        style: {
          fontSize: nextLayout.fittingFontSize,
          left: nextLayout.unitLeft,
        },
      });
    },
    [getAmountLayout],
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

  const handleQuoteCharMeasure = (
    char: string,
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const width = event.nativeEvent.lines[0]?.width || 0;
    setQuoteCharWidths(prev =>
      prev[char] === width
        ? prev
        : {
            ...prev,
            [char]: width,
          },
    );
  };

  const handleQuoteUnitMeasure = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    setQuoteUnitWidth(event.nativeEvent.lines[0]?.width || 0);
  };

  const handleInputSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      inputSelectionRef.current = event.nativeEvent.selection;
    },
    [],
  );

  const getPredictedValueFromKey = useCallback(
    (key: string) => {
      const selection = inputSelectionRef.current;
      const start = Math.max(0, Math.min(selection.start, inputValue.length));
      const end = Math.max(start, Math.min(selection.end, inputValue.length));

      if (key === 'Backspace') {
        if (start !== end) {
          return inputValue.slice(0, start) + inputValue.slice(end);
        }
        if (start > 0) {
          return inputValue.slice(0, start - 1) + inputValue.slice(end);
        }
        return inputValue;
      }

      if (key.length === 1) {
        return inputValue.slice(0, start) + key + inputValue.slice(end);
      }

      return null;
    },
    [inputValue],
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
      applyUnitLayoutNative(nextValue);
      setInputValue(nextValue);
      const result = onChange?.(nextValue);
      if (result === false) {
        applyUnitLayoutNative(previousValue);
        setInputValue(previousValue);
      }
    },
    [applyUnitLayoutNative, inputValue, onChange],
  );

  const fallbackQuoteCharWidth =
    quoteCharWidths['0'] || QUOTE_TEXT_FONT_SIZE * 0.56;
  const fallbackQuoteUnitWidth =
    Math.max(quoteUnit.length, 1) * QUOTE_TEXT_FONT_SIZE * 0.58;
  const measuredQuoteUnitWidth = quoteUnitWidth || fallbackQuoteUnitWidth;
  const quoteTextMaxWidth = Math.max(
    inputAreaWidth -
      (canSwitchMode ? 24 : 0) -
      measuredQuoteUnitWidth -
      QUOTE_UNIT_GAP,
    1,
  );
  const quoteTextWidth = useMemo(() => {
    return quoteValueText
      .split('')
      .reduce(
        (sum, char) => sum + (quoteCharWidths[char] || fallbackQuoteCharWidth),
        0,
      );
  }, [fallbackQuoteCharWidth, quoteCharWidths, quoteValueText]);
  const shouldFixQuoteWidth =
    !!inputAreaWidth && quoteTextWidth >= quoteTextMaxWidth - 1;

  const hasValue = !!inputValue;

  return (
    <View style={[styles.container, style]}>
      <SilentTouchableView
        viewStyle={styles.leftInputContainer}
        onPress={evt => {
          evt.stopPropagation();
          tokenInputRef.current?.focus();
        }}>
        <View style={styles.leftInputContent} onLayout={handleInputAreaLayout}>
          {!hasValue && token.amount > 0 && isEstimatingGas ? (
            <CustomSkeleton
              animation="wave"
              LinearGradientComponent={Linear}
              style={styles.skeleton}
            />
          ) : (
            <View style={styles.amountRow}>
              <TextInput
                ref={tokenInputRef}
                value={inputValue}
                onChangeText={handleInputChange}
                placeholder="0"
                placeholderTextColor={colors2024['neutral-info']}
                inputMode="decimal"
                keyboardType="decimal-pad"
                numberOfLines={1}
                multiline={false}
                scrollEnabled
                onKeyPress={handleInputKeyPress}
                onSelectionChange={handleInputSelectionChange}
                style={[
                  styles.input,
                  {
                    fontSize: fittingFontSize,
                    width: valueInputWidth,
                  },
                ]}
                {...amountInputProps}
              />
              <Text
                ref={unitTextRef}
                numberOfLines={1}
                style={[
                  styles.unitText,
                  {
                    fontSize: fittingFontSize,
                    left: unitLeft,
                  },
                ]}>
                {unit}
              </Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={canSwitchMode ? 0.7 : 1}
            disabled={!canSwitchMode}
            onPress={onSwitchMode}
            style={styles.quoteRow}
            hitSlop={8}>
            <Text
              style={[
                styles.quoteText,
                inputAreaWidth
                  ? shouldFixQuoteWidth
                    ? { width: quoteTextMaxWidth }
                    : { maxWidth: quoteTextMaxWidth }
                  : null,
              ]}
              ellipsizeMode="tail"
              numberOfLines={1}>
              {quoteValueText}
            </Text>
            <Text style={styles.quoteUnitText} numberOfLines={1}>
              {quoteUnit}
            </Text>
            {canSwitchMode ? (
              <View style={styles.switchIconWrapper}>
                <RcIconSwitchCC
                  fillColor={colors2024['brand-light-1']}
                  strokeColor={colors2024['neutral-body']}
                  width={20}
                  height={20}
                />
              </View>
            ) : null}
          </TouchableOpacity>
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
        {unit}
      </Text>
      {QUOTE_MEASURE_CHARS.map(char => (
        <Text
          key={`quote-${char}`}
          numberOfLines={1}
          onTextLayout={event => handleQuoteCharMeasure(char, event)}
          style={[styles.measureText, styles.measureQuoteText]}>
          {char}
        </Text>
      ))}
      <Text
        numberOfLines={1}
        onTextLayout={handleQuoteUnitMeasure}
        style={[styles.measureText, styles.measureQuoteText]}>
        {quoteUnit}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      height: 98,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 16,
      overflow: 'hidden',
    },
    leftInputContainer: {
      flex: 1,
      minWidth: 0,
      paddingLeft: 16,
    },
    leftInputContent: {
      justifyContent: 'center',
    },
    amountRow: {
      height: 36,
      position: 'relative',
      overflow: 'hidden',
    },
    input: {
      position: 'absolute',
      left: 0,
      top: 0,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-title-1'],
      height: 36,
      lineHeight: 36,
      padding: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
      includeFontPadding: false,
      overflow: 'hidden',
      minWidth: 1,
      zIndex: 1,
    },
    unitText: {
      position: 'absolute',
      top: 0,
      color: colors2024['neutral-info'],
      backgroundColor: colors2024['neutral-bg-2'],
      fontWeight: '700',
      lineHeight: 36,
      fontFamily: 'SF Pro Rounded',
      includeFontPadding: false,
      zIndex: 2,
    },
    quoteRow: {
      marginTop: 4,
      height: 20,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    quoteText: {
      color: colors2024['neutral-secondary'],
      fontSize: QUOTE_TEXT_FONT_SIZE,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      flexShrink: 1,
    },
    quoteUnitText: {
      color: colors2024['neutral-secondary'],
      fontSize: QUOTE_TEXT_FONT_SIZE,
      fontWeight: '400',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      flexShrink: 0,
      marginLeft: QUOTE_UNIT_GAP,
    },
    switchIconWrapper: {
      width: 20,
      height: 20,
      marginLeft: 4,
      transform: [{ rotate: '-90deg' }],
    },
    rightControls: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
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
      marginBottom: 4,
      backgroundColor: colors2024['neutral-line'],
      height: 36,
      width: 120,
      borderRadius: 100,
    },
    skeletonLinear: {
      height: '100%',
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
      lineHeight: 36,
    },
    measureUnitText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: MAIN_FONT_SIZE,
      lineHeight: 36,
    },
    measureQuoteText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      fontSize: QUOTE_TEXT_FONT_SIZE,
      lineHeight: 18,
    },
  }),
);
