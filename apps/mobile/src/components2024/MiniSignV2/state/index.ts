import { signatureManager } from './SignatureManager';

export * from './types';
export { SignatureManager, signatureManager } from './SignatureManager';
export { useSignatureStore, useSignatureStoreOf } from './useSignatureStore';
export {
  useMiniSignGasPanelController,
  useMiniSignGasPanelState,
} from './useMiniSignGasPanel';
export { getMiniSignGasPanelController } from './miniSignGasPanelController';
export {
  SignatureInstanceProvider,
  useSignatureInstance,
} from './SignatureInstanceContext';
export { registry, useRegistryInstances } from './SignatureManagerRegistry';

/** @deprecated Use registry.create() to get an isolated instance instead */
export const signatureStore = signatureManager;
