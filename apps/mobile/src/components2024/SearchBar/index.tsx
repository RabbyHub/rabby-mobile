import React, {
  ReactNode,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import {
  RcNextCloseCircle,
  RcNextCloseCircleDark,
  RcNextSearchCC,
} from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Text, TextInput } from '@/components/Typography';
import { useTranslation } from 'react-i18next';

export interface Props extends Omit<TextInputProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  onCancel?(): void;
  noCancel?: boolean;
  searchIcon?: ReactNode;
  alwaysShowCancel?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  as?: 'TextInput' | 'BottomSheetTextInput';
  inputComponent?: React.ComponentType<React.ComponentProps<typeof TextInput>>;
}

export type NextSearchBarMethods = {
  focus(): void;
  blur(): void;
  clear(): void;
};

export const NextSearchBar = ({
  ref,
  style,
  inputContainerStyle,
  inputStyle,
  value,
  searchIcon,
  alwaysShowCancel,
  onChangeText,
  onChange,
  onBlur,
  onFocus,
  onCancel,
  noCancel,
  as = 'TextInput',
  inputComponent,
  placeholder,
  placeholderTextColor,
  onLayout,
  ...rest
}: Props & { ref?: Ref<NextSearchBarMethods> }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  const inputRef = useRef<any>(null);
  const isEmpty = !value;
  const [inputLayout, setInputLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isFocus, setIsFocus] = useState(false);

  const flattenedInputStyle: TextStyle =
    StyleSheet.flatten([styles.input as TextStyle, inputStyle]) ?? {};
  const effectivePlaceholderColor =
    placeholderTextColor ?? styles.placeholder.color;
  // Fabric's iOS TextInput draws the native placeholder lower than the text
  // baseline when the field has an explicit height (QA 1022/672). Keep the
  // native placeholder for semantics but paint the visible one ourselves,
  // centered against the same box as the input text.
  const useManagedPlaceholder =
    Platform.OS === 'ios' && !!placeholder && isEmpty;
  const showManagedPlaceholder =
    useManagedPlaceholder &&
    !!inputLayout &&
    inputLayout.width > 0 &&
    inputLayout.height > 0;

  const handleInputLayout = useMemoizedFn((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setInputLayout(prev => {
      if (
        prev &&
        prev.x === x &&
        prev.y === y &&
        prev.width === width &&
        prev.height === height
      ) {
        return prev;
      }
      return { x, y, width, height };
    });
    onLayout?.(event);
  });

  const handleBlur = useMemoizedFn(e => {
    setIsFocus(false);
    onBlur?.(e);
  });
  const handleFocus = useMemoizedFn(e => {
    setIsFocus(true);
    onFocus?.(e);
  });

  const InputComponent =
    inputComponent || (as === 'TextInput' ? TextInput : BottomSheetTextInput);

  useImperativeHandle(ref, () => {
    return {
      focus() {
        return inputRef.current?.focus();
      },
      blur() {
        return inputRef.current?.blur();
      },
      clear() {
        return inputRef.current?.clear();
      },
    };
  });

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputContainer, inputContainerStyle]}>
        <TouchableWithoutFeedback
          hitSlop={8}
          onPress={() => {
            inputRef.current?.focus();
          }}>
          {searchIcon || (
            <RcNextSearchCC
              style={styles.searchIcon}
              color={colors2024['neutral-secondary']}
              width={20}
              height={20}
            />
          )}
        </TouchableWithoutFeedback>
        <InputComponent
          ref={inputRef}
          style={StyleSheet.flatten([
            styles.input,
            inputStyle,
            isEmpty ? styles.placeholder : null,
          ])}
          placeholder={placeholder}
          placeholderTextColor={
            showManagedPlaceholder ? 'transparent' : effectivePlaceholderColor
          }
          value={value}
          onChangeText={onChangeText}
          onChange={onChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onLayout={handleInputLayout}
          autoCorrect={false}
          spellCheck={false}
          {...rest}
        />
        {showManagedPlaceholder ? (
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.placeholderOverlay,
              {
                left: inputLayout.x,
                top: inputLayout.y,
                width: inputLayout.width,
                height: inputLayout.height,
                paddingLeft:
                  flattenedInputStyle?.paddingLeft ??
                  flattenedInputStyle?.paddingHorizontal ??
                  0,
                paddingRight:
                  flattenedInputStyle?.paddingRight ??
                  flattenedInputStyle?.paddingHorizontal ??
                  0,
              },
            ]}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.placeholder,
                {
                  color: effectivePlaceholderColor,
                  fontSize: flattenedInputStyle?.fontSize,
                  lineHeight: flattenedInputStyle?.lineHeight,
                  letterSpacing: flattenedInputStyle?.letterSpacing,
                },
              ]}>
              {placeholder}
            </Text>
          </View>
        ) : null}
        {!isEmpty ? (
          <TouchableWithoutFeedback
            hitSlop={8}
            onPress={() => {
              onChangeText?.('');
            }}>
            {isLight ? (
              <RcNextCloseCircle
                style={styles.closeIcon}
                color={colors2024['neutral-secondary']}
              />
            ) : (
              <RcNextCloseCircleDark
                style={styles.closeIcon}
                color={colors2024['neutral-secondary']}
              />
            )}
          </TouchableWithoutFeedback>
        ) : null}
      </View>
      {alwaysShowCancel || (isFocus && !noCancel) ? (
        <TouchableOpacity
          onPress={() => {
            onCancel?.();
            inputRef?.current?.blur();
          }}>
          <Text style={styles.cancelText}>{t('global.Cancel')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 12,
    paddingLeft: 12,
    gap: 7,
  },

  searchIcon: {},
  closeIcon: {},
  input: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    height: 46,
    fontSize: 16,
    // lineHeight: 20, // to avoid multi row show text
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    textAlignVertical: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  placeholder: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  placeholderOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cancelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
