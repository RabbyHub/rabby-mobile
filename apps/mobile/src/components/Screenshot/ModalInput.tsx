import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Text, TextInput, View } from 'react-native';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  SCREENSHOT_FEEDBACK_MAX_LENGTH,
  useFeedbackOnScreenshot,
} from './hooks';
import { useTranslation } from 'react-i18next';
import { IS_ANDROID } from '@/core/native/utils';

export type BottomInputMethods = {};
export type BottomInputProps = {} & RNViewProps;

const ModalInput = React.forwardRef<BottomInputMethods, BottomInputProps>(
  ({ style }, ref) => {
    const { feedbackText: value, onChangeFeedback } = useFeedbackOnScreenshot();

    // const [value, setValue] = useState(feedbackText);
    // useEffect(() => {
    //   setValue(feedbackText);
    // }, [feedbackText]);
    const valueOverLimit = value.length > SCREENSHOT_FEEDBACK_MAX_LENGTH - 1;

    const { styles } = useTheme2024({ getStyle: getStyle });
    const { t } = useTranslation();

    const inputRef = useRef<any>(null);
    const isEmpty = !value;

    const handleDone = useCallback(async () => {
      onChangeFeedback(value.trim());
      Keyboard.dismiss();
    }, [onChangeFeedback, value]);

    return (
      <View style={[styles.container, style]}>
        <View style={[styles.inputContainer]}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={text => {
              onChangeFeedback(text);
            }}
            multiline={true}
            onBlur={handleDone}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
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
          {/* <Text style={styles.inputTextLenIndicator}>
            <Text style={[valueOverLimit && styles.inputTextOverLimit]}>
              {value.length}
            </Text>
            {`/${SCREENSHOT_FEEDBACK_MAX_LENGTH - 1}`}
          </Text> */}
        </View>
      </View>
    );
  },
);

export default ModalInput;

export const ModalBottomInputSizes = {
  mainHeight: 108,
  get totalContainerHeight() {
    return this.mainHeight + 12 * 2;
  },
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      position: 'relative',
      backgroundColor: colors2024['neutral-bg-1'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    inputContainer: {
      flex: 1,
      width: '100%',
      height: ModalBottomInputSizes.mainHeight,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors2024['neutral-bg-5'],
      maxHeight: 78,
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
      color: colors2024['neutral-title-1'],
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
