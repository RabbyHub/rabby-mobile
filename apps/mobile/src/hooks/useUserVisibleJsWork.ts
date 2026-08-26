import { useEffect } from 'react';

import { beginUserVisibleJsWork } from '@/core/utils/userVisibleJsWork';

export const useUserVisibleJsWork = (active: boolean, label: string) => {
  useEffect(() => {
    if (!active) {
      return;
    }
    return beginUserVisibleJsWork(label);
  }, [active, label]);
};
