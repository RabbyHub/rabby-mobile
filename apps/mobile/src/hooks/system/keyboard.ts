import { useEffect } from 'react';
import { Keyboard, KeyboardEventListener } from 'react-native';

import { IS_ANDROID } from '@/core/native/utils';

export function useOnKeyboardDismissed(subscription: KeyboardEventListener) {
  useEffect(() => {
    const keyboardHideListener = IS_ANDROID
      ? Keyboard.addListener('keyboardDidHide', subscription)
      : Keyboard.addListener('keyboardWillHide', evt => {
          setTimeout(() => subscription(evt), 350);
        });

    return () => {
      keyboardHideListener.remove();
    };
  }, [subscription]);
}
