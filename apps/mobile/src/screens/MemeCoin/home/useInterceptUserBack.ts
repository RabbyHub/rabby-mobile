import { useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

/**
 * While `active`, user back (back button / Android back / iOS swipe) calls
 * `onBack` instead of leaving. Any other navigation, e.g. the auto-lock reset
 * to Unlock, goes through.
 */
export const useInterceptUserBack = (active: boolean, onBack: () => void) => {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  const pendingActionRef = useRef<
    Parameters<typeof navigation.dispatch>[0] | null
  >(null);

  usePreventRemove(active && !leaving, ({ data }) => {
    if (data.action.type === 'GO_BACK' || data.action.type === 'POP') {
      onBack();
      return;
    }
    pendingActionRef.current = data.action;
    setLeaving(true);
  });

  // Runs after the render that turned preventRemove off, so the dispatch is not intercepted.
  useEffect(() => {
    if (leaving && pendingActionRef.current) {
      navigation.dispatch(pendingActionRef.current);
      pendingActionRef.current = null;
    }
  }, [leaving, navigation]);
};
