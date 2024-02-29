import { useRef, useEffect } from 'react';

export function useUnmountedRef() {
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  return unmountedRef;
}
