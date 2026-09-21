import { signatureManager } from './SignatureManager';

export * from './types';
export { SignatureManager, signatureManager } from './SignatureManager';
export { useSignatureStore, useSignatureStoreOf } from './useSignatureStore';
export { getMiniSignGasPanelController } from './MiniSignGasPanelController';
export {
  useMiniSignGasPanelController,
  useMiniSignGasPanelState,
} from './useMiniSignGasPanel';
export {
  SignatureInstanceProvider,
  useSignatureInstance,
} from './SignatureInstanceContext';
export { registry, useRegistryInstances } from './SignatureManagerRegistry';

/** @deprecated Use registry.create() to get an isolated instance instead */
export const signatureStore = signatureManager;
