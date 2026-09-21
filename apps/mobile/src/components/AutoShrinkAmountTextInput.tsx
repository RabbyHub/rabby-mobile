import React, { useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, TextInputProps } from 'react-native';

import {
  Text,
  TextInput as AppTextInput,
  type TextInput as AppTextInputRef,
} from '@/components/Typography';
import {
  DEFAULT_FONT_SIZE_STEP,
  DEFAULT_MIN_FONT_SIZE,
  useFittingFontSize,
} from '@/components/AutoShrinkAmountTextSizing';

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
      multiline,
      scrollEnabled,
      ...props
    },
    ref,
  ) => {
    const flattenedStyle = useMemo(() => StyleSheet.flatten(style), [style]);
    const isSingleLine = !multiline;
    const singleLineTextInputStyle = useMemo(() => {
      if (!isSingleLine) {
        return null;
      }

      const height = flattenedStyle?.height;
      const lineHeight =
        flattenedStyle?.lineHeight ||
        (typeof height === 'number' ? height : undefined);

      return {
        includeFontPadding: false,
        lineHeight,
        overflow: 'hidden' as const,
        paddingVertical: 0,
        textAlignVertical: 'center' as const,
      };
    }, [flattenedStyle?.height, flattenedStyle?.lineHeight, isSingleLine]);

    const {
      baseFontSize,
      fittingFontSize,
      measureTextStyle,
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
          multiline={multiline}
          onLayout={handleLayout}
          scrollEnabled={isSingleLine ? false : scrollEnabled}
          style={[
            style,
            singleLineTextInputStyle,
            { fontSize: fittingFontSize },
          ]}
        />
        <Text
          numberOfLines={1}
          onTextLayout={handleMeasureTextLayout}
          style={[
            measureTextStyle,
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
    measureTextStyle,
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
          measureTextStyle,
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
