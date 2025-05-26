import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

export const miniApprovalGasAtom = atom<
  | {
      showGasLevelPopup?: boolean;
      loading: boolean;
      changedCustomGas: boolean;
      externalPanelSelection: (gas: GasLevel) => void;
      gasList: GasLevel[] | null;
      gasMethod?: 'native' | 'gasAccount';
      handleClickEdit: () => void;
      isDisabledGasPopup?: boolean;
      onChangeGasMethod?: (method: 'native' | 'gasAccount') => void;
      selectedGas: GasLevel | null;
      gasCostUsdStr: string;
      gasUsdList: {
        slow: string;
        normal: string;
        fast: string;
      };
      gasIsNotEnough: {
        slow: boolean;
        normal: boolean;
        fast: boolean;
      };
      gasAccountIsNotEnough: {
        slow: boolean;
        normal: boolean;
        fast: boolean;
      };
    }
  | undefined
>(undefined);

export const directSigningAtom = atom(false);

export const canDirectSignAtom = atom(true);

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
    console.log('clear resetState');
  }, [setCanDirectSign, setDirectSigning, setMiniApprovalGasState]);

  return resetState;
};
