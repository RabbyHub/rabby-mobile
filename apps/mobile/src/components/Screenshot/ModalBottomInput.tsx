import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  SCREENSHOT_FEEDBACK_MAX_LENGTH,
  useFeedbackOnScreenshot,
} from './hooks';
import { useTranslation } from 'react-i18next';
import { IS_ANDROID } from '@/core/native/utils';

export type BottomInputMethods = {};
export type BottomInputProps = {
  visible?: boolean;
} & RNViewProps;

const ModalBottomInput = React.forwardRef<BottomInputMethods, BottomInputProps>(
  ({ visible, style }, ref) => {
    const {
      feedbackText: value,
      feedbackOverLimit: valueOverLimit,
      onChangeFeedback,
    } = useFeedbackOnScreenshot();

    const { styles } = useTheme2024({ getStyle: getBottomInputStyle });
    const { t } = useTranslation();

    useEffect(() => {
      if (visible) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      } else {
        setTimeout(() => {
          inputRef.current?.blur();
        }, 300);
        Keyboard.dismiss();
      }
    }, [visible]);

    const inputRef = useRef<any>(null);
    const isEmpty = !value;
    const handleFocus = useCallback<TextInputProps['onFocus'] & object>(e => {},
    []);

    const handleBlur = useCallback<
      TextInputProps['onBlur'] & object
    >(async () => {
      Keyboard.dismiss();
    }, []);

    return (
      <View
        {...(!visible && { pointerEvents: 'none' })}
        style={[
          styles.container,
          // containerAnimatedStyle,
          !visible && { opacity: 0, height: 0 },
          style,
        ]}>
        <View style={[styles.inputContainer]}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeFeedback}
            multiline={true}
            onFocus={handleFocus}
            onBlur={handleBlur}
            enterKeyHint="done"
            textAlign="left"
            textAlignVertical="top"
            autoFocus={IS_ANDROID}
            placeholder={t(
              'component.screenshotModal.feedbackInput.placeholder',
            )}
            placeholderTextColor={styles.inputPlaceholder.color}
            style={[styles.input, isEmpty ? styles.inputPlaceholder : null]}
          />
          <Text style={styles.inputTextLenIndicator}>
            <Text style={[valueOverLimit && styles.inputTextOverLimit]}>
              {value.length}
            </Text>
            {`/${SCREENSHOT_FEEDBACK_MAX_LENGTH - 1}`}
          </Text>
        </View>
      </View>
    );
  },
);

export default ModalBottomInput;

export const ModalBottomInputSizes = {
  mainHeight: 108,
  get totalContainerHeight() {
    return this.mainHeight + 12 * 2;
  },
};

const getBottomInputStyle = createGetStyles2024(({ colors2024 }) => {
  const winLayout = Dimensions.get('window');
  return {
    // outerMask: {
    //   position: 'absolute',
    //   height: winLayout.height,
    //   width: winLayout.width,
    //   ...(__DEV__ && {
    //     backgroundColor: 'red',
    //   }),
    // },
    container: {
      position: 'relative',
      backgroundColor: colors2024['neutral-bg-1'],
      paddingHorizontal: 16,
      paddingVertical: 12,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      bottom: 0,
      minHeight: ModalBottomInputSizes.totalContainerHeight,
    },
    inputContainer: {
      flex: 1,
      width: '100%',
      height: ModalBottomInputSizes.mainHeight,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors2024['neutral-bg-5'],
    },
    input: {
      flex: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      padding: 0,
      fontSize: 16,
      justifyContent: 'flex-start',
      // ...makeDebugBorder(),
    },

    inputPlaceholder: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },
    inputTextLenIndicator: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'transparent',
      color: colors2024['neutral-secondary'],
      fontSize: 15,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 22,
    },
    inputTextOverLimit: {
      color: colors2024['red-default'],
    },
  };
});
