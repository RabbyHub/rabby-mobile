import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

export const usePerpsProDismissKeyboard = (enabled = true) => {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const keyboardVisibleRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const lifetimeRef = useRef<object | null>(null);

  useEffect(() => {
    if (!enabled) {
      mountedRef.current = false;
      pendingActionRef.current = null;
      return;
    }
    mountedRef.current = true;
    const lifetime = {};
    lifetimeRef.current = lifetime;
    keyboardVisibleRef.current = Keyboard.isVisible();
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action && mountedRef.current && enabledRef.current) {
        requestAnimationFrame(() => {
          if (
            mountedRef.current &&
            enabledRef.current &&
            lifetimeRef.current === lifetime
          ) {
            action();
          }
        });
      }
    });

    return () => {
      mountedRef.current = false;
      lifetimeRef.current = null;
      pendingActionRef.current = null;
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [enabled]);

  return useCallback((action: () => void) => {
    if (!enabledRef.current) {
      return;
    }
    if (keyboardVisibleRef.current) {
      pendingActionRef.current = action;
      Keyboard.dismiss();
      return;
    }
    Keyboard.dismiss();
    const lifetime = lifetimeRef.current;
    requestAnimationFrame(() => {
      if (
        mountedRef.current &&
        enabledRef.current &&
        lifetimeRef.current === lifetime
      ) {
        action();
      }
    });
  }, []);
};
