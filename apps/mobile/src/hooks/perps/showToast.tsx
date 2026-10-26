import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { toast, toastWithIcon } from '@/components2024/Toast';
import { Text } from '@/components/Typography';

export const showToast = (
  msg: string,
  type: 'success' | 'error' = 'success',
  lifecycle?: { onHidden?: () => void },
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
    onHidden: lifecycle?.onHidden,
    position: toast.positions.CENTER,
    standalone: !!lifecycle?.onHidden,
  };

  if (type === 'success') {
    return toast.success(content, options);
  } else {
    return toast.error(content, options);
  }
};
