import { makeSecureKeyChainInstance } from '@/core/apis/keychain';
import React from 'react';

const securityChainRef = {
  current: null as ReturnType<typeof makeSecureKeyChainInstance> | null,
};
const AppContext = React.createContext<{
  rabbitCode: string;
  securityChain: ReturnType<typeof makeSecureKeyChainInstance> | null;
}>({ rabbitCode: '', securityChain: null });
export const AppProvider = AppContext.Provider;

export function loadSecurityChain({ rabbitCode }: { rabbitCode: string }) {
  if (securityChainRef.current && rabbitCode) return securityChainRef.current;

  return (securityChainRef.current = makeSecureKeyChainInstance({
    salt: rabbitCode,
  }));
}

export function useAppSecurityChain() {
  const { securityChain } = React.useContext(AppContext);

  return { securityChain };
}
