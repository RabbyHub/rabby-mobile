import { gasAccountService, keyringService } from '@/core/services';
import { GasAccountServiceStore } from '@/core/services/gasAccount';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';

const refreshGasBalanceAtom = atom(0);

const refreshgasAccountHistoryAtom = atom(0);

export const useGasBalanceRefresh = () => {
  const [refreshId, setRefreshId] = useAtom(refreshGasBalanceAtom);
  const refresh = useCallback(() => {
    setRefreshId(e => e + 1);
  }, [setRefreshId]);
  return { refreshId, refresh };
};

export const useGasAccountHistoryRefresh = () => {
  const [refreshId, setRefreshId] = useAtom(refreshgasAccountHistoryAtom);
  const refresh = useCallback(() => {
    setRefreshId(e => e + 1);
  }, [setRefreshId]);
  return { refreshId, refresh };
};

export const gasAccountSigAtom = atom<Partial<GasAccountServiceStore>>({});

gasAccountSigAtom.onMount = set => {
  const syncDeleteGasAccount = async (
    address: string,
    type: string,
    brand?: string,
  ) => {
    if (type !== KEYRING_TYPE.WatchAddressKeyring) {
      const restAddresses = await keyringService.getAllAddresses();
      const gasAccount =
        gasAccountService.getGasAccountData() as GasAccountServiceStore;
      if (!gasAccount?.account?.address) return;
      // check if there is another type address in wallet
      const stillHasAddr = restAddresses.some(item => {
        return (
          isSameAddress(item.address, gasAccount.account!.address) &&
          item.type !== KEYRING_TYPE.WatchAddressKeyring
        );
      });
      if (!stillHasAddr && isSameAddress(address, gasAccount.account.address)) {
        // if there is no another type address then reset signature
        gasAccountService.setGasAccountSig();
        const data =
          gasAccountService.getGasAccountData() as GasAccountServiceStore;

        set({
          ...data,
        });
      }
    }
  };
  keyringService.on('removedAccount', syncDeleteGasAccount);
  set({
    ...(gasAccountService.getGasAccountData() as GasAccountServiceStore),
  });

  return () => {
    keyringService.off('removedAccount', syncDeleteGasAccount);
  };
};

export const useGasAccountSign = () => {
  return useAtomValue(gasAccountSigAtom);
};

export const useSetGasAccount = () => {
  const set = useSetAtom(gasAccountSigAtom);
  const setGasAccount = useCallback(
    (sig?: string, account?: GasAccountServiceStore['account']) => {
      gasAccountService.setGasAccountSig(sig, account);
      set({ sig, accountId: account?.address, account: account });
    },
    [set],
  );
  return setGasAccount;
};

const logoutVisibleAtom = atom(false);
const loginVisibleAtom = atom(false);

export const useGasAccountLogoutVisible = () => {
  return useAtom(logoutVisibleAtom);
};

export const useGasAccountLoginVisible = () => {
  return useAtom(loginVisibleAtom);
};
