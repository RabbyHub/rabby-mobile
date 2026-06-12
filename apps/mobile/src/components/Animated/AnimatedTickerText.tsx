import React, { memo, useEffect } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  SharedValue,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AnimateableText, AnimatedText } from '@/components/Typography';
import { getFontSizeByLength } from '@/utils/fontSize';

type AnimatedStringValue = {
  value: string;
};

type FontSizeByLengthOptions = {
  maxFontSize: number;
  minFontSize: number;
  threshold: number;
  step?: number;
};

type AnimatedTickerTextProps = {
  value: AnimatedStringValue;
  maxLength?: number;
  duration?: number;
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  textProps?: TextProps;
  containerProps?: ViewProps;
  fontSizeByLength?: FontSizeByLengthOptions;
};

type TickerTextState = {
  text: string;
  isRtl: boolean;
  isOverflow: boolean;
  fontSize: number | undefined;
};

type TickerColumnProps = {
  value: AnimatedStringValue;
  textState: SharedValue<TickerTextState>;
  slotIndex: number;
  maxLength: number;
  duration: number;
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  textProps?: TextProps;
};

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const GLYPH_SIDE_BEARING = 0;

const getSlotChar = (text: string, slotIndex: number, maxLength: number) => {
  'worklet';

  const safeText = text || '';
  const textIndex = slotIndex;

  if (textIndex >= maxLength || textIndex >= safeText.length) {
    return '';
  }

  return safeText.charAt(textIndex);
};

// 目前影响只印度货币，兜底到不走滚动数字动画，fallback 到 animateText
const hasRtlText = (text: string) => {
  'worklet';

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);

    if (
      (code >= 0x0590 && code <= 0x08ff) ||
      (code >= 0xfb1d && code <= 0xfdff) ||
      (code >= 0xfe70 && code <= 0xfeff)
    ) {
      return true;
    }
  }

  return false;
};

const getDigitIndex = (char: string) => {
  'worklet';

  switch (char) {
    case '0':
      return 0;
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '5':
      return 5;
    case '6':
      return 6;
    case '7':
      return 7;
    case '8':
      return 8;
    case '9':
      return 9;
    default:
      return -1;
  }
};

const getDigitWidthUnit = (char: string) => {
  'worklet';

  switch (char) {
    // 先留在这，需要配置再改
    default:
      return 0.68;
  }
};

const getCharWidthUnit = (char: string) => {
  'worklet';

  switch (char) {
    case '':
      return 0;
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      return getDigitWidthUnit(char);
    case ' ':
      return 0.24;
    case ',':
    case '.':
      return 0.3;
    case '-':
      return 0.5;
    case '*':
      return 0.46;
    case '<':
    case '+':
      return 0.64;
    case '$':
    case '€':
    case '£':
    case '¥':
    case '₹':
    case '₽':
    case '₺':
    case '฿':
    case '₫':
    case 'K':
    case 'B':
    case 'T':
      return 0.64;
    case '₩':
    case 'W':
    case 'M':
    case 'm':
      return 0.94;
    case 'I':
    case 'l':
    case 'i':
      return 0.34;
    case 'w':
      return 0.82;
    case '₀':
    case '₁':
    case '₂':
    case '₃':
    case '₄':
    case '₅':
    case '₆':
    case '₇':
    case '₈':
    case '₉':
      return 0.42;
    default:
      return 0.72;
  }
};

const getTextFontSize = (text: string, options?: FontSizeByLengthOptions) => {
  'worklet';

  if (!options) {
    return undefined;
  }

  return getFontSizeByLength(text?.length ?? 0, options);
};

const AnimatedTickerColumn = memo(
  ({
    value,
    textState,
    slotIndex,
    maxLength,
    duration,
    lineHeight,
    style,
    textProps,
  }: TickerColumnProps) => {
    const initialDigit = getDigitIndex(
      getSlotChar(value.value, slotIndex, maxLength),
    );
    const digitPosition = useSharedValue(
      initialDigit >= 0 ? -initialDigit * lineHeight : 0,
    );

    useEffect(() => {
      const initialDigit = getDigitIndex(
        getSlotChar(value.value, slotIndex, maxLength),
      );

      if (initialDigit >= 0) {
        digitPosition.value = -initialDigit * lineHeight;
      }
    }, [digitPosition, lineHeight, maxLength, slotIndex, value]);

    useAnimatedReaction(
      () => {
        const char = getSlotChar(value.value, slotIndex, maxLength);
        return getDigitIndex(char);
      },
      nextDigit => {
        if (nextDigit < 0) {
          return;
        }

        digitPosition.value = withTiming(-nextDigit * lineHeight, {
          duration,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
        });
      },
      [duration, lineHeight, maxLength, slotIndex],
    );

    const columnStyle = useAnimatedStyle(() => {
      const {
        text,
        isRtl,
        isOverflow,
        fontSize: textFontSize,
      } = textState.value;
      if (isRtl || isOverflow) {
        return {
          width: 0,
          height: lineHeight,
          opacity: 0,
        };
      }

      const char = getSlotChar(text, slotIndex, maxLength);
      const fontSize = textFontSize ?? 38;
      return {
        width: withTiming(
          char ? fontSize * getCharWidthUnit(char) + GLYPH_SIDE_BEARING : 0,
          {
            duration: Math.min(duration, 180),
            easing: Easing.linear,
          },
        ),
        height: lineHeight,
        opacity: char ? 1 : 0,
      };
    }, [duration, lineHeight, maxLength, slotIndex]);

    const rollingStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: digitPosition.value }],
        opacity:
          getDigitIndex(getSlotChar(value.value, slotIndex, maxLength)) >= 0
            ? 1
            : 0,
      };
    }, [maxLength, slotIndex]);

    const staticStyle = useAnimatedStyle(() => {
      const char = getSlotChar(value.value, slotIndex, maxLength);
      return {
        opacity: getDigitIndex(char) < 0 && char ? 1 : 0,
      };
    }, [maxLength, slotIndex]);

    const textSizeStyle = useAnimatedStyle(() => {
      const fontSize = textState.value.fontSize;

      if (!fontSize) {
        return {};
      }

      return {
        fontSize,
      };
    });

    const staticTextProps = useAnimatedProps(() => {
      const char = getSlotChar(value.value, slotIndex, maxLength);

      return {
        text: getDigitIndex(char) < 0 ? char : '',
      };
    }, [maxLength, slotIndex]);

    return (
      <Animated.View style={[styles.column, columnStyle]}>
        <Animated.View style={[styles.rollingColumn, rollingStyle]}>
          {DIGITS.map(digit => (
            <AnimatedText
              key={digit}
              {...textProps}
              style={[
                style,
                textSizeStyle,
                styles.rollingText,
                { lineHeight, height: lineHeight },
              ]}>
              {digit}
            </AnimatedText>
          ))}
        </Animated.View>
        <AnimateableText
          {...textProps}
          style={[
            style,
            textSizeStyle,
            styles.staticText,
            { lineHeight, height: lineHeight },
          ]}
          animatedProps={staticTextProps}
        />
      </Animated.View>
    );
  },
);

const AnimatedTickerText = ({
  value,
  maxLength = 16,
  duration = 300,
  lineHeight,
  style,
  containerStyle,
  textProps,
  containerProps,
  fontSizeByLength,
}: AnimatedTickerTextProps) => {
  const textState = useDerivedValue(() => {
    const text = value.value || '';

    return {
      text,
      isRtl: hasRtlText(text),
      isOverflow: text.length > maxLength,
      fontSize: getTextFontSize(text, fontSizeByLength),
    };
  }, [fontSizeByLength, maxLength]);

  const fallbackAnimatedProps = useAnimatedProps(() => {
    return {
      text: textState.value.text,
    };
  });

  const fallbackStyle = useAnimatedStyle(() => {
    const { isRtl, isOverflow, fontSize } = textState.value;

    return {
      display: isRtl || isOverflow ? 'flex' : 'none',
      ...(fontSize ? { fontSize } : {}),
    };
  });

  const columns = React.useMemo(
    () => Array.from({ length: maxLength }, (_, index) => index),
    [maxLength],
  );

  return (
    <View {...containerProps} style={[styles.row, containerStyle]}>
      <AnimateableText
        {...textProps}
        style={[style, fallbackStyle, { lineHeight, height: lineHeight }]}
        animatedProps={fallbackAnimatedProps}
      />
      {columns.map(index => (
        <AnimatedTickerColumn
          key={index}
          value={value}
          textState={textState}
          slotIndex={index}
          maxLength={maxLength}
          duration={duration}
          lineHeight={lineHeight}
          style={style}
          textProps={textProps}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  column: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  rollingColumn: {
    width: '100%',
  },
  rollingText: {
    width: '100%',
    textAlign: 'center',
  },
  staticText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
});

export default memo(AnimatedTickerText);
