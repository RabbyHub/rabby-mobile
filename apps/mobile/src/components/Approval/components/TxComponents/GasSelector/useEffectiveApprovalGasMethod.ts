import { useEffect, useMemo } from 'react';
import {
  ApprovalGasMethod,
  resolveApprovalGasMethod,
  shouldAutoSwitchToApprovalGasAccount,
} from './approvalGasDisplay';

type Params = {
  isReady: boolean;
  isFirstGasLessLoading: boolean;
  isGasNotEnough: boolean;
  gasAccountChainSupported: boolean;
  noCustomRPC: boolean;
  canUseGasLess: boolean;
  gasMethod: ApprovalGasMethod;
  setGasMethod: (method: ApprovalGasMethod) => void;
};

export const useEffectiveApprovalGasMethod = ({
  isReady,
  isFirstGasLessLoading,
  isGasNotEnough,
  gasAccountChainSupported,
  noCustomRPC,
  canUseGasLess,
  gasMethod,
  setGasMethod,
}: Params) => {
  const shouldPreferGasAccountImmediately =
    shouldAutoSwitchToApprovalGasAccount({
      nativeTokenInsufficient: isGasNotEnough,
      gasAccountChainSupported,
      freeGasAvailable: canUseGasLess,
      noCustomRPC,
    });

  const effectiveApprovalGasMethod = useMemo(
    () =>
      resolveApprovalGasMethod({
        nativeTokenInsufficient: isGasNotEnough,
        gasAccountChainSupported,
        noCustomRPC,
        freeGasAvailable: canUseGasLess,
        legacyGasMethod: gasMethod,
      }),
    [
      canUseGasLess,
      gasAccountChainSupported,
      gasMethod,
      isGasNotEnough,
      noCustomRPC,
    ],
  );

  useEffect(() => {
    if (
      !isReady ||
      (isFirstGasLessLoading && !shouldPreferGasAccountImmediately) ||
      gasMethod === effectiveApprovalGasMethod
    ) {
      return;
    }
    setGasMethod(effectiveApprovalGasMethod);
  }, [
    shouldPreferGasAccountImmediately,
    effectiveApprovalGasMethod,
    gasMethod,
    isFirstGasLessLoading,
    isReady,
    setGasMethod,
  ]);

  return effectiveApprovalGasMethod;
};
