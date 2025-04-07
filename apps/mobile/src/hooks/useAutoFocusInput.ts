import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

/**
 * @see https://github.com/react-navigation/react-navigation/issues/11626#issuecomment-1823588248
 */
export default function useAutoFocusInput(disableAutoFocus = false) {
  const [isInputInitialized, setIsInputInitialized] = useState(false);

  const inputRef = useRef<TextInput>();
  const navigation = useNavigation();

  useEffect(() => {
    if (!isInputInitialized || !inputRef.current || disableAutoFocus) {
      return;
    }
    const unsubscribe = navigation.addListener(
      'transitionEnd' as any,
      (e: any) => {
        if (e.data.closing === false) {
          setTimeout(() => inputRef?.current?.focus());
        }
      },
    );

    return unsubscribe;
  }, [disableAutoFocus, isInputInitialized, navigation]);

  const inputCallbackRef = ref => {
    inputRef.current = ref;
    setIsInputInitialized(true);
  };

  return { inputCallbackRef, inputRef };
}
