import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  TextInputProps,
  TextLayoutEventData,
  NativeSyntheticEvent,
} from 'react-native';

import {
  Text,
  TextInput as AppTextInput,
  type TextInput as AppTextInputRef,
} from '@/components/Typography';

const DEFAULT_MAX_FONT_SIZE = 28;
const DEFAULT_MIN_FONT_SIZE = 18;
const DEFAULT_FONT_SIZE_STEP = 2;

type AutoShrinkAmountTextInputProps = TextInputProps & {
  maxFontSize?: number;
  minFontSize?: number;
  fontSizeStep?: number;
};

export const AutoShrinkAmountTextInput = React.forwardRef<
  AppTextInputRef,
  AutoShrinkAmountTextInputProps
>(
  (
    {
      style,
      value,
      placeholder,
      onLayout,
      maxFontSize,
      minFontSize = DEFAULT_MIN_FONT_SIZE,
      fontSizeStep = DEFAULT_FONT_SIZE_STEP,
      ...props
    },
    ref,
  ) => {
    const flattenedStyle = useMemo(() => StyleSheet.flatten(style), [style]);
    const baseFontSize =
      maxFontSize || Number(flattenedStyle?.fontSize) || DEFAULT_MAX_FONT_SIZE;
    const [inputWidth, setInputWidth] = useState(0);
    const [textWidthAtBaseFontSize, setTextWidthAtBaseFontSize] = useState(0);

    const textForMeasure = value || placeholder || '0';

    const fittingFontSize = useMemo(() => {
      if (!inputWidth || !textWidthAtBaseFontSize) {
        return baseFontSize;
      }

      for (
        let fontSize = baseFontSize;
        fontSize >= minFontSize;
        fontSize -= fontSizeStep
      ) {
        if ((textWidthAtBaseFontSize * fontSize) / baseFontSize <= inputWidth) {
          return fontSize;
        }
      }

      return minFontSize;
    }, [
      baseFontSize,
      fontSizeStep,
      inputWidth,
      minFontSize,
      textWidthAtBaseFontSize,
    ]);

    const handleLayout = (event: LayoutChangeEvent) => {
      setInputWidth(event.nativeEvent.layout.width);
      onLayout?.(event);
    };

    const handleMeasureTextLayout = (
      event: NativeSyntheticEvent<TextLayoutEventData>,
    ) => {
      setTextWidthAtBaseFontSize(event.nativeEvent.lines[0]?.width || 0);
    };

    return (
      <>
        <AppTextInput
          {...props}
          ref={ref}
          value={value}
          placeholder={placeholder}
          onLayout={handleLayout}
          style={[style, { fontSize: fittingFontSize }]}
        />
        <Text
          numberOfLines={1}
          onTextLayout={handleMeasureTextLayout}
          style={[
            style,
            styles.measureText,
            {
              fontSize: baseFontSize,
            },
          ]}>
          {textForMeasure}
        </Text>
      </>
    );
  },
);

AutoShrinkAmountTextInput.displayName = 'AutoShrinkAmountTextInput';

const styles = StyleSheet.create({
  measureText: {
    position: 'absolute',
    width: 10000,
    opacity: 0,
    zIndex: -1,
  },
});
