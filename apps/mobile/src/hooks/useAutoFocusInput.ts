import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, TextInput } from 'react-native';

const ANIMATED_TRANSITION = 300;

/**
 * @see https://github.com/react-navigation/react-navigation/issues/11626#issuecomment-1823745730
 */
export default function useAutoFocusInput(disableAutoFocus = false) {
  const [isInputInitialized, setIsInputInitialized] = useState(false);
  const [isScreenTransitionEnded, setIsScreenTransitionEnded] = useState(false);

  const inputRef = useRef<TextInput>();
  const focusTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (
      !isScreenTransitionEnded ||
      !isInputInitialized ||
      !inputRef.current ||
      disableAutoFocus
    ) {
      return;
    }
    InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
      setIsScreenTransitionEnded(false);
    });
  }, [isScreenTransitionEnded, isInputInitialized, disableAutoFocus]);

  useFocusEffect(
    useCallback(() => {
      focusTimeoutRef.current = setTimeout(() => {
        setIsScreenTransitionEnded(true);
      }, ANIMATED_TRANSITION);
      return () => {
        if (!focusTimeoutRef.current) {
          return;
        }
        clearTimeout(focusTimeoutRef.current);
      };
    }, []),
  );

  const inputCallbackRef = ref => {
    inputRef.current = ref;
    setIsInputInitialized(true);
  };

  return { inputCallbackRef, inputRef };
}
