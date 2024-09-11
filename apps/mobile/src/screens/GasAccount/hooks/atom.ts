import { gasAccountService } from '@/core/services';
import { GasAccountServiceStore } from '@/core/services/gasAccount';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';

const refreshGasBalanceAtom = atom(0);

export const useGasBalanceRefresh = () => {
  const [refreshId, setRefreshId] = useAtom(refreshGasBalanceAtom);
  const refresh = useCallback(() => {
    setRefreshId(e => e + 1);
  }, [setRefreshId]);
  return { refreshId, refresh };
};

export const gasAccountSigAtom = atom<{
  sig?: string;
  accountId?: string;
}>({});

gasAccountSigAtom.onMount = set => {
  set({
    sig: gasAccountService.store.sig,
    accountId: gasAccountService.store.accountId,
  });
};

export const useGasAccountSign = () => {
  return useAtomValue(gasAccountSigAtom);
};

export const useSetGasAccount = () => {
  const set = useSetAtom(gasAccountSigAtom);
  const setGasAccount = useCallback(
    (sig?: string, account?: GasAccountServiceStore['account']) => {
      gasAccountService.setGasAccountSig(sig, account);
      set({ sig, accountId: account?.address });
    },
    [set],
  );
  return setGasAccount;
};
