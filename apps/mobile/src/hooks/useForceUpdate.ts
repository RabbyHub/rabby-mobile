import { useCallback, useState } from 'react';

export const useForceUpdate = () => {
  const [, setCount] = useState(1);
  const forceUpdate = useCallback(() => {
    setCount(pre => pre + 1);
  }, []);
  return forceUpdate;
};
