import { useEffect, useMemo, useRef } from 'react';
import {
  resolveApprovalGasMethod,
  shouldAutoSwitchToApprovalGasAccount,
} from './approvalGasDisplay';
import type { ApprovalGasMethod } from './approvalGasDisplay';

type Params = {
  isReady: boolean;
  isFirstGasLessLoading: boolean;
  isGasNotEnough: boolean;
  gasAccountChainSupported: boolean;
  noCustomRPC: boolean;
  canUseGasLess: boolean;
  manualGasMethod?: ApprovalGasMethod;
  gasMethod: ApprovalGasMethod;
  setGasMethod: (method: ApprovalGasMethod) => void;
  autoSwitchKey?: string | number;
};

export const useEffectiveApprovalGasMethod = ({
  isReady,
  isFirstGasLessLoading,
  isGasNotEnough,
  gasAccountChainSupported,
  noCustomRPC,
  canUseGasLess,
  manualGasMethod,
  gasMethod,
  setGasMethod,
  autoSwitchKey,
}: Params) => {
  const didAutoSwitchRef = useRef(false);
  const autoSwitchKeyRef = useRef(autoSwitchKey);

  useEffect(() => {
    if (autoSwitchKeyRef.current === autoSwitchKey) {
      return;
    }

    autoSwitchKeyRef.current = autoSwitchKey;
    didAutoSwitchRef.current = false;
  }, [autoSwitchKey]);

  const shouldPreferGasAccountImmediately =
    shouldAutoSwitchToApprovalGasAccount({
      nativeTokenInsufficient: isGasNotEnough,
      gasAccountChainSupported,
      freeGasAvailable: canUseGasLess,
      noCustomRPC,
    });

  const effectiveApprovalGasMethod = useMemo(() => {
    if (manualGasMethod) {
      return manualGasMethod;
    }

    return resolveApprovalGasMethod({
      mode: 'native_insufficient_prefers_gasAccount',
      nativeTokenInsufficient: isGasNotEnough,
      gasAccountChainSupported,
      noCustomRPC,
      freeGasAvailable: canUseGasLess,
      legacyGasMethod: gasMethod,
    });
  }, [
    canUseGasLess,
    gasAccountChainSupported,
    gasMethod,
    isGasNotEnough,
    manualGasMethod,
    noCustomRPC,
  ]);

  useEffect(() => {
    if (
      !isReady ||
      manualGasMethod ||
      didAutoSwitchRef.current ||
      (isFirstGasLessLoading && !shouldPreferGasAccountImmediately) ||
      gasMethod === effectiveApprovalGasMethod
    ) {
      return;
    }
    didAutoSwitchRef.current = true;
    setGasMethod(effectiveApprovalGasMethod);
  }, [
    shouldPreferGasAccountImmediately,
    effectiveApprovalGasMethod,
    gasMethod,
    isFirstGasLessLoading,
    isReady,
    manualGasMethod,
    setGasMethod,
  ]);

  return effectiveApprovalGasMethod;
};
