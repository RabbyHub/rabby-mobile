import React, { createContext, useContext, type ReactNode } from 'react';

import {
  createStoreActivityScope,
  type StoreActivityScope,
} from '@/core/state/storeActivity';

type StoreActivityProviderProps = {
  children: ReactNode;
  scope: StoreActivityScope;
};

const alwaysActiveStoreActivityScope = createStoreActivityScope({
  active: true,
  label: 'always-active',
});

const StoreActivityContext = createContext<StoreActivityScope>(
  alwaysActiveStoreActivityScope,
);

export function StoreActivityProvider({
  children,
  scope,
}: StoreActivityProviderProps) {
  return (
    <StoreActivityContext.Provider value={scope}>
      {children}
    </StoreActivityContext.Provider>
  );
}

export function useStoreActivityScope() {
  return useContext(StoreActivityContext);
}
