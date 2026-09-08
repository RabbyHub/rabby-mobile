import RcNextCloseCircleDark from '@/assets/icons/common/next-close-circle-dark.svg';
import RcNextCloseCircle from '@/assets/icons/common/next-close-circle.svg';
import RcNextSearchCC from '@/assets/icons/common/next-search-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolvePerpsProEmptyInputSelection } from '../common/perpsProInputSelection';
import { PerpsProNativeSearchInput } from './PerpsProNativeSearchInput';

export type PerpsProMarketSearchBarHandle = {
  blur: () => void;
  clear: () => void;
  focus: () => void;
};

type PerpsProMarketSearchBarProps = {
  onChangeText: (value: string) => void;
  onFocusChange: (focused: boolean) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  value: string;
};

const PerpsProMarketSearchBarComponent = forwardRef<
  PerpsProMarketSearchBarHandle,
  PerpsProMarketSearchBarProps
>(({ onChangeText, onFocusChange, placeholder, style, value }, ref) => {
  const { colors2024, isLight, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const nativeInputRef =
    useRef<React.ElementRef<typeof PerpsProNativeSearchInput>>(null);
  const bottomSheetInputRef =
    useRef<React.ElementRef<typeof BottomSheetTextInput>>(null);
  const initialNativeValueRef = useRef(value);
  const [focused, setFocused] = useState(false);
  const isResting = !focused && !value;

  const blurInput = useCallback(() => {
    if (Platform.OS === 'ios') {
      nativeInputRef.current?.blur();
    } else {
      bottomSheetInputRef.current?.blur();
    }
  }, []);
  const focusInput = useCallback(() => {
    if (Platform.OS === 'ios') {
      nativeInputRef.current?.focus();
    } else {
      bottomSheetInputRef.current?.focus();
    }
  }, []);
  const clearInput = useCallback(() => {
    if (Platform.OS === 'ios') {
      nativeInputRef.current?.clear();
    } else {
      bottomSheetInputRef.current?.clear();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      blur: blurInput,
      clear: clearInput,
      focus: focusInput,
    }),
    [blurInput, clearInput, focusInput],
  );

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocusChange(true);
  }, [onFocusChange]);
  const handleBlur = useCallback(() => {
    setFocused(false);
    onFocusChange(false);
  }, [onFocusChange]);
  const handleCancel = useCallback(() => {
    clearInput();
    onChangeText('');
    blurInput();
    Keyboard.dismiss();
  }, [blurInput, clearInput, onChangeText]);
  const handleClear = useCallback(() => {
    clearInput();
    onChangeText('');
  }, [clearInput, onChangeText]);
  const commonInputProps: React.ComponentProps<
    typeof PerpsProNativeSearchInput
  > = {
    accessibilityLabel: placeholder,
    accessible: !isResting,
    allowFontScaling: false,
    autoCorrect: false,
    cursorColor: colors2024['brand-default'],
    onBlur: handleBlur,
    onChangeText,
    onFocus: handleFocus,
    returnKeyType: 'done',
    selectionColor: colors2024['brand-default'],
    spellCheck: false,
    style: styles.input,
    testID: 'market-search',
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.inputContainer,
          isResting ? styles.restingInputContainer : null,
        ]}
        testID="perps-pro-market-search-input-container">
        <RcNextSearchCC
          color={colors2024['neutral-secondary']}
          height={16}
          style={isResting ? styles.hiddenInputContent : undefined}
          width={16}
        />
        <View style={styles.inputArea}>
          {!isResting && !value ? (
            <Text
              pointerEvents="none"
              style={styles.activePlaceholder}
              testID="perps-pro-market-search-active-placeholder">
              {placeholder}
            </Text>
          ) : null}
          {Platform.OS === 'ios' ? (
            // Keep UIKit as the text owner while an IME has marked text. Query
            // state still follows onChangeText, but must not echo through value.
            <PerpsProNativeSearchInput
              {...commonInputProps}
              defaultValue={initialNativeValueRef.current}
              ref={nativeInputRef}
            />
          ) : (
            <BottomSheetTextInput
              {...commonInputProps}
              ref={bottomSheetInputRef}
              selection={
                focused && !value
                  ? resolvePerpsProEmptyInputSelection('android')
                  : undefined
              }
              value={value}
            />
          )}
        </View>
        {!isResting && value ? (
          <TouchableOpacity
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            activeOpacity={1}
            hitSlop={8}
            onPress={handleClear}
            testID="market-search-clear">
            {isLight ? (
              <RcNextCloseCircle
                height={16}
                testID="perps-pro-market-search-clear-light"
                width={16}
              />
            ) : (
              <RcNextCloseCircleDark
                height={16}
                testID="perps-pro-market-search-clear-dark"
                width={16}
              />
            )}
          </TouchableOpacity>
        ) : null}
        {isResting ? (
          <Pressable
            accessibilityLabel={placeholder}
            accessibilityRole="button"
            onPress={focusInput}
            style={StyleSheet.absoluteFill}
            testID="perps-pro-market-search-focus-mask">
            <View pointerEvents="none" style={styles.restingContent}>
              <RcNextSearchCC
                color={colors2024['neutral-secondary']}
                height={16}
                width={16}
              />
              <Text style={styles.placeholder}>{placeholder}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      {!isResting ? (
        <Pressable
          accessibilityLabel={t('global.Cancel')}
          accessibilityRole="button"
          hitSlop={{ bottom: 5, top: 5 }}
          onPress={handleCancel}
          style={styles.cancel}
          testID="market-search-cancel">
          <Text style={styles.cancelText}>{t('global.Cancel')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

PerpsProMarketSearchBarComponent.displayName = 'PerpsProMarketSearchBar';

export const PerpsProMarketSearchBar = React.memo(
  PerpsProMarketSearchBarComponent,
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 34,
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-2'],
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 34,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  restingInputContainer: {
    marginRight: 1,
  },
  hiddenInputContent: {
    opacity: 0,
  },
  inputArea: {
    flex: 1,
    height: 18,
    minWidth: 0,
    position: 'relative',
  },
  input: {
    bottom: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    height: 18,
    includeFontPadding: false,
    lineHeight: 18,
    left: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    position: 'absolute',
    right: 0,
    textAlignVertical: 'center',
    top: 0,
  },
  activePlaceholder: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    left: 2,
    lineHeight: 18,
    position: 'absolute',
    top: 0,
  },
  restingContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  placeholder: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  cancel: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 46,
  },
  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
}));
