import { formatGasHeaderUsdValue } from '@/utils/number';
import { CHAINS_ENUM } from '@debank/common';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { ReactNode, useCallback, useEffect } from 'react';

export const miniApprovalGasAtom = atom<
  | {
      showGasLevelPopup?: boolean;
      loading?: boolean;
      changedCustomGas?: boolean;
      externalPanelSelection?: (gas: GasLevel) => void;
      gasList?: GasLevel[] | null;
      gasMethod?: 'native' | 'gasAccount';
      handleClickEdit?: () => void;
      isDisabledGasPopup?: boolean;
      onChangeGasMethod?: (method: 'native' | 'gasAccount') => void;
      selectedGas?: GasLevel | null;
      gasCostUsdStr?: string;
      gasUsdList?: {
        slow: string;
        normal: string;
        fast: string;
      };
      gasIsNotEnough?: {
        slow: boolean;
        normal: boolean;
        fast: boolean;
      };
      gasAccountIsNotEnough?: {
        slow: [boolean, string];
        normal: [boolean, string];
        fast: [boolean, string];
      };
      disabledProcess?: boolean;

      gasAccountCost?: {
        total_cost: number;
        tx_cost: number;
        gas_cost: number;
        estimate_tx_cost: number;
      };
      gasAccountError?: boolean;
    }
  | undefined
>(undefined);

const directSigningDisabledProcessAtom = atom(
  get => get(miniApprovalGasAtom)?.disabledProcess,
);

export const gasRelativeComponentAtom = atom<ReactNode>(null);

export const useDirectSigningDisabledProcess = () =>
  useAtomValue(directSigningDisabledProcessAtom);

export const directSigningAtom = atom(false);

export const canDirectSignAtom = atom(true);

const innerError = atom(false);
export const useSetDirectSubmitInnerError = () => useSetAtom(innerError);

const currentMiniSignChain = atom(CHAINS_ENUM.ETH);
const gasFeeLimitAtom = atom(get => {
  const currentChain = get(currentMiniSignChain);
  return currentChain === CHAINS_ENUM.ETH ? 15 : 5;
});

export const useMiniSignGasUSDLimit = () => useAtomValue(gasFeeLimitAtom);

export const useSetMiniSignChain = () => useSetAtom(currentMiniSignChain);

const checkGasFeeAtom = atom(false);

const gasFeeTooHighAtom = atom(get => {
  const gasFeeLimit = get(gasFeeLimitAtom);
  const miniApprovalGas = get(miniApprovalGasAtom);
  const showGasContent =
    !!miniApprovalGas &&
    !miniApprovalGas.loading &&
    !!miniApprovalGas.gasCostUsdStr &&
    !miniApprovalGas.disabledProcess;

  const calcGasAccountUsd = (n: number | string) => {
    const v = Number(n);
    if (!Number.isNaN(v) && v < 0.0001) {
      return `$${n}`;
    }
    return formatGasHeaderUsdValue(n || '0');
  };

  const gasAccountCost = miniApprovalGas?.gasAccountCost;

  const gasCostUsd =
    miniApprovalGas?.gasMethod === 'gasAccount'
      ? calcGasAccountUsd(
          (gasAccountCost?.estimate_tx_cost || 0) +
            (gasAccountCost?.gas_cost || 0),
        )
      : miniApprovalGas?.gasCostUsdStr;

  if (
    showGasContent &&
    gasCostUsd &&
    new BigNumber(gasCostUsd?.replaceAll('$', '') || '0').gt(gasFeeLimit)
  ) {
    return true;
  }

  return false;
});

export const useMiniDirectSignGasFeeTooHigh = () =>
  useAtomValue(gasFeeTooHighAtom);

export const useCanProcessDirectSubmit = () => {
  const disabledProcess = useDirectSigningDisabledProcess();
  const canDirectSign = useAtomValue(canDirectSignAtom);
  const directSubmitInnerError = useGetDirectSubmitInnerError();
  const gasFeeDisableProcess = useAtomValue(gasFeeDisableProcessAtom);

  return (
    !gasFeeDisableProcess &&
    !disabledProcess &&
    canDirectSign &&
    !directSubmitInnerError
  );
};

const throwMiniDirectErrorAtom = atom(get => {
  return get(innerError) || get(gasFeeDisableProcessAtom);
});

// abort mini sign process
export const useGetDirectSubmitInnerError = () => {
  const inner = useAtomValue(throwMiniDirectErrorAtom);
  return inner;
};

const gasFeeDisableProcessAtom = atom(get => {
  const checkGasFee = get(checkGasFeeAtom);
  if (!checkGasFee) {
    return false;
  }

  return get(gasFeeTooHighAtom);
});

export const useMiniDirectSignGasFeeDisableProcess = () => {
  const [checkGasFee, setCheckGasFee] = useAtom(checkGasFeeAtom);
  const gasFeeDisableProcess = useAtomValue(gasFeeDisableProcessAtom);
  return {
    checkGasFee,
    setCheckGasFee,
    gasFeeDisableProcess,
  };
};

export const useResetMiniApprovalDirectSignState = () => {
  const setMiniApprovalGasState = useSetAtom(miniApprovalGasAtom);
  const setGasRelativeComponent = useSetAtom(gasRelativeComponentAtom);
  const setDirectSubmitInnerError = useSetDirectSubmitInnerError();
  // const setCheckGasFee = useSetAtom(checkGasFeeAtom);

  const [directSigning, setDirectSigning] = useAtom(directSigningAtom);
  const [canDirectSign, setCanDirectSign] = useAtom(canDirectSignAtom);

  useEffect(() => {
    if (directSigning && !canDirectSign) {
      setDirectSigning(false);
    }
  }, [directSigning, canDirectSign, setDirectSigning]);

  const resetState = useCallback(() => {
    setMiniApprovalGasState(undefined);
    setDirectSigning(false);
    setCanDirectSign(true);
    setGasRelativeComponent(null);
    setDirectSubmitInnerError(false);
    // setCheckGasFee(false);
  }, [
    setDirectSubmitInnerError,
    setCanDirectSign,
    setDirectSigning,
    setGasRelativeComponent,
    setMiniApprovalGasState,
    // setCheckGasFee,
  ]);

  return resetState;
};

export const AbortedDirectSubmitErrorCode = 'AbortedDirectSubmitError';
export class AbortedDirectSubmitError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: string = AbortedDirectSubmitErrorCode,
    statusCode?: number,
  ) {
    super(message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const isAbortedDirectSubmitError = (e: any) => {
  if (
    e instanceof AbortedDirectSubmitError &&
    e.code === AbortedDirectSubmitErrorCode
  ) {
    return true;
  }
  return false;
};
