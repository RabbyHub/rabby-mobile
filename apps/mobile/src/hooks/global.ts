import { makeSecureKeyChainInstance } from '@/core/apis/keychain';
import { useGlobalInitOneKey } from '@/core/apis/onekey';
import React from 'react';

export const useGlobal = () => {
  useGlobalInitOneKey();
};

const securityChainRef = {
  current: null as ReturnType<typeof makeSecureKeyChainInstance> | null,
};
const AppContext = React.createContext<{
  securityChain: ReturnType<typeof makeSecureKeyChainInstance> | null;
}>({ securityChain: null });
export const AppProvider = AppContext.Provider;

export function loadSecurityChain({ rabbitCode }: { rabbitCode: string }) {
  if (securityChainRef.current) return securityChainRef.current;

  return (securityChainRef.current = makeSecureKeyChainInstance({
    salt: rabbitCode,
  }));
}

export function useAppSecurityChain() {
  const { securityChain } = React.useContext(AppContext);

  return { securityChain };
}
