import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

type UseAppForegroundOptions = {
  enabled?: boolean;
  onForeground: () => void | Promise<void>;
};

const isLeftForegroundState = (state: AppStateStatus) =>
  state === 'inactive' || state === 'background';

export function useAppForeground({
  enabled = true,
  onForeground,
}: UseAppForegroundOptions) {
  const onForegroundRef = useRef(onForeground);
  const hasLeftForegroundRef = useRef(false);

  onForegroundRef.current = onForeground;

  useEffect(() => {
    if (!enabled) {
      hasLeftForegroundRef.current = false;
      return;
    }

    hasLeftForegroundRef.current = isLeftForegroundState(AppState.currentState);

    const subscription = AppState.addEventListener('change', state => {
      if (isLeftForegroundState(state)) {
        hasLeftForegroundRef.current = true;
        return;
      }

      if (hasLeftForegroundRef.current && state === 'active') {
        hasLeftForegroundRef.current = false;
        onForegroundRef.current();
      }
    });

    return () => {
      hasLeftForegroundRef.current = false;
      subscription.remove();
    };
  }, [enabled]);
}
