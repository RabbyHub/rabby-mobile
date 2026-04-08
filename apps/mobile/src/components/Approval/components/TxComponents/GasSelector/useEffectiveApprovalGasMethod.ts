import { useEffect, useMemo } from 'react';
import {
  ApprovalGasMethod,
  resolveApprovalGasMethod,
} from './approvalGasDisplay';

type Params = {
  isReady: boolean;
  isFirstGasLessLoading: boolean;
  isGasNotEnough: boolean;
  gasAccountChainSupported: boolean;
  canUseGasLess: boolean;
  gasMethod: ApprovalGasMethod;
  setGasMethod: (method: ApprovalGasMethod) => void;
};

export const useEffectiveApprovalGasMethod = ({
  isReady,
  isFirstGasLessLoading,
  isGasNotEnough,
  gasAccountChainSupported,
  canUseGasLess,
  gasMethod,
  setGasMethod,
}: Params) => {
  const effectiveApprovalGasMethod = useMemo(
    () =>
      resolveApprovalGasMethod({
        nativeTokenInsufficient: isGasNotEnough,
        gasAccountChainSupported,
        freeGasAvailable: canUseGasLess,
        legacyGasMethod: gasMethod,
      }),
    [canUseGasLess, gasAccountChainSupported, gasMethod, isGasNotEnough],
  );

  useEffect(() => {
    if (
      !isReady ||
      isFirstGasLessLoading ||
      gasMethod === effectiveApprovalGasMethod
    ) {
      return;
    }
    setGasMethod(effectiveApprovalGasMethod);
  }, [
    effectiveApprovalGasMethod,
    gasMethod,
    isFirstGasLessLoading,
    isReady,
    setGasMethod,
  ]);

  return effectiveApprovalGasMethod;
};
