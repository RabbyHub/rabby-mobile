import { useSyncExternalStore } from 'react';

import type { SignatureManager } from './SignatureManager';
import type { SignatureFlowState } from './types';
import { useSignatureInstance } from './SignatureInstanceContext';

/**
 * Subscribe to the SignatureManager instance from React context.
 * Inside a SignatureInstanceProvider it reads that instance;
 * outside it falls back to the global singleton.
 */
export const useSignatureStore = <T = SignatureFlowState>(
  selector?: (state: SignatureFlowState) => T,
) => {
  const instance = useSignatureInstance();
  return useSignatureStoreOf(instance, selector);
};

/**
 * Subscribe to a specific SignatureManager instance directly.
 * Use this when you own the instance (e.g. from useMiniSigner)
 * and are not inside a SignatureInstanceProvider.
 */
export const useSignatureStoreOf = <T = SignatureFlowState>(
  instance: SignatureManager,
  selector?: (state: SignatureFlowState) => T,
) => {
  return useSyncExternalStore(
    instance.subscribe,
    selector
      ? () => selector(instance.getState())
      : (instance.getState as () => T),
  );
};
