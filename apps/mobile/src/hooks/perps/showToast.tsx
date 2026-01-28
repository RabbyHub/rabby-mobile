import React from 'react';
import { Dimensions, Platform, Text } from 'react-native';
import { toast, toastWithIcon } from '@/components2024/Toast';
import Toast from 'react-native-root-toast';

export const showToast = (
  msg: string,
  type: 'success' | 'error' = 'success',
) => {
  const msgText = String(msg);
  const content: Parameters<ReturnType<typeof toastWithIcon>>[0] =
    Platform.OS === 'android'
      ? ({ iconNode, styles }) => (
          <>
            {iconNode}
            <Text
              style={[
                styles.text,
                styles.selfDefinedContent,
                {
                  maxWidth: Dimensions.get('window').width - 100,
                },
              ]}>
              {msgText}
            </Text>
          </>
        )
      : msgText;

  const options = {
    position: Toast.positions.CENTER,
  };

  if (type === 'success') {
    toast.success(content, options);
  } else {
    toast.error(content, options);
  }
};
