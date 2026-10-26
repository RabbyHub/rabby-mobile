import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

export const usePerpsProDismissKeyboard = () => {
  const keyboardVisibleRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action && mountedRef.current) {
        requestAnimationFrame(action);
      }
    });

    return () => {
      mountedRef.current = false;
      pendingActionRef.current = null;
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return useCallback((action: () => void) => {
    if (keyboardVisibleRef.current) {
      pendingActionRef.current = action;
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      if (mountedRef.current) {
        action();
      }
    });
  }, []);
};
