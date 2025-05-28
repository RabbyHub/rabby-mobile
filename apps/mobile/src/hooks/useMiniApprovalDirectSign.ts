import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

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
  }, [setCanDirectSign, setDirectSigning, setMiniApprovalGasState]);

  return resetState;
};
