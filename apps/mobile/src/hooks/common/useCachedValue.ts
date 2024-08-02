import { useMemo, useRef } from 'react';

function useCachedValue<T extends object, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
): T[K] | undefined {
  const cachedValue = useRef<T[K]>();

  return useMemo(() => {
    if (obj && key in obj) {
      cachedValue.current = obj[key];
    }
    return cachedValue.current;
  }, [obj, key]);
}

export default useCachedValue;
