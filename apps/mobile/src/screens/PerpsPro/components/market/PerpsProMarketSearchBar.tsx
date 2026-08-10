import {
  NextSearchBar,
  type NextSearchBarMethods,
} from '@/components2024/SearchBar';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type PerpsProMarketSearchBarHandle = Pick<
  NextSearchBarMethods,
  'blur' | 'focus'
>;

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
  const inputRef = useRef<NextSearchBarMethods>(null);
  const [focused, setFocused] = useState(false);
  const isResting = !focused && !value;

  useImperativeHandle(
    ref,
    () => ({
      blur: () => inputRef.current?.blur(),
      focus: () => inputRef.current?.focus(),
    }),
    [],
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
    onChangeText('');
  }, [onChangeText]);
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={[styles.container, style]}>
      <NextSearchBar
        as="BottomSheetTextInput"
        inputContainerStyle={
          isResting ? styles.restingInputContainer : undefined
        }
        inputStyle={[styles.input, isResting ? styles.restingInput : undefined]}
        onBlur={handleBlur}
        onCancel={handleCancel}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        placeholder={placeholder}
        ref={inputRef}
        returnKeyType="done"
        testID="market-search"
        value={value}
      />
      {isResting ? (
        <Pressable
          accessibilityLabel={placeholder}
          accessibilityRole="button"
          onPress={focusInput}
          style={StyleSheet.absoluteFill}
          testID="perps-pro-market-search-focus-mask"
        />
      ) : null}
    </View>
  );
});

PerpsProMarketSearchBarComponent.displayName = 'PerpsProMarketSearchBar';

export const PerpsProMarketSearchBar = React.memo(
  PerpsProMarketSearchBarComponent,
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    lineHeight: 20,
  },
  restingInput: {
    flex: 0,
  },
  restingInputContainer: {
    justifyContent: 'center',
  },
});
