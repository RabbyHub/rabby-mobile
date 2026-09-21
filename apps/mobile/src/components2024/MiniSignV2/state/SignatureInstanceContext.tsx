import React, { createContext, useContext } from 'react';

import { SignatureManager, signatureManager } from './SignatureManager';

const SignatureInstanceContext = createContext<SignatureManager | null>(null);

export const SignatureInstanceProvider: React.FC<{
  instance: SignatureManager;
  children: React.ReactNode;
}> = ({ instance, children }) => (
  <SignatureInstanceContext.Provider value={instance}>
    {children}
  </SignatureInstanceContext.Provider>
);

/**
 * Get the current SignatureManager instance from context.
 * Falls back to the global singleton for backward compatibility.
 */
export const useSignatureInstance = (): SignatureManager => {
  const instance = useContext(SignatureInstanceContext);
  return instance ?? signatureManager;
};
