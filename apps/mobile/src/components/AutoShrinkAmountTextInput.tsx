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

type AutoShrinkAmountTextProps = React.ComponentProps<typeof Text> & {
  maxFontSize?: number;
  minFontSize?: number;
  fontSizeStep?: number;
};

function useFittingFontSize({
  style,
  maxFontSize,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  fontSizeStep = DEFAULT_FONT_SIZE_STEP,
}: {
  style?: AutoShrinkAmountTextInputProps['style'];
  maxFontSize?: number;
  minFontSize?: number;
  fontSizeStep?: number;
}) {
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style), [style]);
  const baseFontSize =
    maxFontSize || Number(flattenedStyle?.fontSize) || DEFAULT_MAX_FONT_SIZE;
  const [inputWidth, setInputWidth] = useState(0);
  const [textWidthAtBaseFontSize, setTextWidthAtBaseFontSize] = useState(0);

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

  const handleMeasureTextLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    setTextWidthAtBaseFontSize(event.nativeEvent.lines[0]?.width || 0);
  };

  return {
    baseFontSize,
    fittingFontSize,
    setInputWidth,
    handleMeasureTextLayout,
  };
}

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
    const {
      baseFontSize,
      fittingFontSize,
      setInputWidth,
      handleMeasureTextLayout,
    } = useFittingFontSize({
      style,
      maxFontSize,
      minFontSize,
      fontSizeStep,
    });

    const textForMeasure = value || placeholder || '0';

    const handleLayout = (event: LayoutChangeEvent) => {
      setInputWidth(event.nativeEvent.layout.width);
      onLayout?.(event);
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

export const AutoShrinkAmountText = ({
  style,
  children,
  onLayout,
  maxFontSize,
  minFontSize,
  fontSizeStep,
  ...props
}: AutoShrinkAmountTextProps) => {
  const {
    baseFontSize,
    fittingFontSize,
    setInputWidth,
    handleMeasureTextLayout,
  } = useFittingFontSize({
    style,
    maxFontSize,
    minFontSize,
    fontSizeStep,
  });

  const textForMeasure = useMemo(
    () => React.Children.toArray(children).join('') || '0',
    [children],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    setInputWidth(event.nativeEvent.layout.width);
    onLayout?.(event);
  };

  return (
    <>
      <Text
        {...props}
        onLayout={handleLayout}
        style={[style, { fontSize: fittingFontSize }]}>
        {children}
      </Text>
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
};

const styles = StyleSheet.create({
  measureText: {
    position: 'absolute',
    width: 10000,
    opacity: 0,
    zIndex: -1,
  },
});
