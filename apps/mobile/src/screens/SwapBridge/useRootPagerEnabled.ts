import { useSyncExternalStore } from 'react';
import { AppState, Keyboard } from 'react-native';

import { useVisibleBlockingModalIds } from '@/utils/modalGate';

const isAppActive = () => AppState.currentState === 'active';
const isKeyboardVisible = () => Keyboard.isVisible();

const subscribeAppState = (onChange: () => void) => {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
};

const subscribeKeyboard = (onChange: () => void) => {
  const show = Keyboard.addListener('keyboardDidShow', onChange);
  const hide = Keyboard.addListener('keyboardDidHide', onChange);
  return () => {
    show.remove();
    hide.remove();
  };
};

/**
 * Presentation-only gate: route commands and signing keep their existing owners.
 * The modal registry covers registered blocking surfaces, not every global
 * sheet or native authentication session. Those retain their own touch hosts.
 */
export function useRootPagerEnabled(screenFocused: boolean): boolean {
  const appActive = useSyncExternalStore(subscribeAppState, isAppActive);
  const keyboardVisible = useSyncExternalStore(
    subscribeKeyboard,
    isKeyboardVisible,
  );
  const blockingModalIds = useVisibleBlockingModalIds();

  return (
    screenFocused &&
    appActive &&
    !keyboardVisible &&
    blockingModalIds.length === 0
  );
}
