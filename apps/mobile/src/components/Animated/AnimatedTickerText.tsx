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
  Easing,
  useAnimatedProps,
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

type TickerColumnProps = {
  value: AnimatedStringValue;
  slotIndex: number;
  maxLength: number;
  duration: number;
  lineHeight: number;
  style?: StyleProp<TextStyle>;
  textProps?: TextProps;
  fontSizeByLength?: FontSizeByLengthOptions;
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
    case 'M':
      return 0.94;
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
    slotIndex,
    maxLength,
    duration,
    lineHeight,
    style,
    textProps,
    fontSizeByLength,
  }: TickerColumnProps) => {
    const digitPosition = useSharedValue(0);

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
      const text = value.value || '';
      const char = getSlotChar(text, slotIndex, maxLength);
      const fontSize = getTextFontSize(text, fontSizeByLength) ?? 38;
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
    }, [duration, fontSizeByLength, lineHeight, maxLength, slotIndex]);

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
      const fontSize = getTextFontSize(value.value || '', fontSizeByLength);

      if (!fontSize) {
        return {};
      }

      return {
        fontSize,
      };
    }, [fontSizeByLength]);

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
  return (
    <View {...containerProps} style={[styles.row, containerStyle]}>
      {Array.from({ length: maxLength }).map((_, index) => (
        <AnimatedTickerColumn
          key={index}
          value={value}
          slotIndex={index}
          maxLength={maxLength}
          duration={duration}
          lineHeight={lineHeight}
          style={style}
          textProps={textProps}
          fontSizeByLength={fontSizeByLength}
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
