import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
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

export const useCanProcessDirectSubmit = () => {
  const disabledProcess = useDirectSigningDisabledProcess();
  const canDirectSign = useAtomValue(canDirectSignAtom);
  return !disabledProcess && canDirectSign;
};

export const useResetMiniApprovalDirectSignState = () => {
  const setMiniApprovalGasState = useSetAtom(miniApprovalGasAtom);
  const setGasRelativeComponent = useSetAtom(gasRelativeComponentAtom);

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
  }, [
    setCanDirectSign,
    setDirectSigning,
    setGasRelativeComponent,
    setMiniApprovalGasState,
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
