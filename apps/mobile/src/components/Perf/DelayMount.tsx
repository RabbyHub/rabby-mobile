import React from 'react';
import { useSharedValue } from 'react-native-reanimated';

const DEFAULT_DELAY = 1000;
export function DelayMount({
  children,
  delay = DEFAULT_DELAY,
}: {
  children?: React.ReactNode;
  delay?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  // const mountedValue = useSharedValue(0);
  // const mounted = mountedValue.value === 1;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      // mountedValue.value = 1;
    }, delay ?? DEFAULT_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [delay]);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
