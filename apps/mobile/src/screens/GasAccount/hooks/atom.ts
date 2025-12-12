import {
  gasAccountService,
  keyringService,
  perpsService,
} from '@/core/services';
import { GasAccountServiceStore } from '@/core/services/gasAccount';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { eventBus, EVENTS } from '@/utils/events';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useCallback } from 'react';

// const refreshGasBalanceAtom = atom(0);
// const refreshgasAccountHistoryAtom = atom(0);
// export const gasAccountSigAtom = atom<Partial<GasAccountServiceStore>>({});
// gasAccountSigAtom.onMount = set => {
//   const data = gasAccountService.getGasAccountData() as GasAccountServiceStore;
//   set({
//     ...data,
//   });
//   eventBus.on(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, () => {
//     const data =
//       gasAccountService.getGasAccountData() as GasAccountServiceStore;
//     set({
//       ...data,
//     });
//   });
// };
// const logoutVisibleAtom = atom(false);
// const loginVisibleAtom = atom(false);
// const switchVisibleAtom = atom(false);

runIIFEFunc(() => {
  eventBus.on(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, () => {
    const data =
      gasAccountService.getGasAccountData() as GasAccountServiceStore;
    gasAccountStore.setState({
      sigState: {
        ...data,
      },
    });
  });
});

type GasAccountRefresherState = {
  refreshGasBalance: number;
  refreshGasAccountHistory: number;
};

type GasAccountVisibleState = {
  logoutVisible: boolean;
  loginVisible: boolean;
  switchVisible: boolean;
};

type GasAccountState = GasAccountRefresherState & {
  sigState?: Partial<GasAccountServiceStore>;
} & GasAccountVisibleState;

function setRefreshIdFor(
  key: keyof GasAccountRefresherState,
  valOrFunc: UpdaterOrPartials<number>,
) {
  gasAccountStore.setState(prev => {
    const newVal = resolveValFromUpdater(prev[key], valOrFunc).newVal;

    return {
      ...prev,
      [key]: newVal,
    };
  });
}

function setVisibleFor(
  key: keyof GasAccountVisibleState,
  valOrFunc: UpdaterOrPartials<boolean>,
) {
  gasAccountStore.setState(prev => {
    const newVal = resolveValFromUpdater(prev[key] || false, valOrFunc).newVal;

    return {
      ...prev,
      [key]: newVal,
    };
  });
}

const gasAccountStore = zCreate<GasAccountState>(() => ({
  refreshGasBalance: 0,
  refreshGasAccountHistory: 0,
  sigState: {
    ...(gasAccountService.getGasAccountData() as GasAccountServiceStore),
  },
  logoutVisible: false,
  loginVisible: false,
  switchVisible: false,
}));

function setGasAccountSigState(
  valOrFunc: UpdaterOrPartials<GasAccountState['sigState']>,
) {
  gasAccountStore.setState(prev => {
    const newVal = resolveValFromUpdater(prev.sigState || {}, valOrFunc).newVal;

    return {
      ...prev,
      sigState: newVal,
    };
  });
}

export const useGasBalanceRefresh = () => {
  const refreshId = gasAccountStore(s => s.refreshGasBalance);
  const refresh = useCallback(() => {
    setRefreshIdFor('refreshGasBalance', e => e + 1);
  }, []);
  return { refreshId, refresh };
};

export const useGasAccountHistoryRefresh = () => {
  const refreshId = gasAccountStore(s => s.refreshGasAccountHistory);
  const refresh = useCallback(() => {
    setRefreshIdFor('refreshGasAccountHistory', e => e + 1);
  }, []);
  return { refreshId, refresh };
};

const syncDeleteGasAccount = async (
  address: string,
  type: string,
  brand?: string,
) => {
  if (type !== KEYRING_TYPE.WatchAddressKeyring) {
    const restAddresses = await keyringService.getAllAddresses();
    const gasAccount =
      gasAccountService.getGasAccountData() as GasAccountServiceStore;
    if (gasAccount?.account?.address) {
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
        eventBus.emit(EVENTS.AUTO_LOGIN_GAS_ACCOUNT, null);
      }
    }
    const perpsAccount = await perpsService.getCurrentAccount();
    if (
      isSameAddress(perpsAccount?.address || '', address) &&
      perpsAccount?.type === type
    ) {
      eventBus.emit(EVENTS.PERPS.LOG_OUT, perpsAccount);
      perpsService.setCurrentAccount(null);
    }
  }
};
keyringService.on('removedAccount', syncDeleteGasAccount);

export const useGasAccountSign = () => {
  // return useAtomValue(gasAccountSigAtom);
  const sigState = gasAccountStore(s => s.sigState);
  return sigState || {};
};

const setGasAccount = (
  sig?: string,
  account?: GasAccountServiceStore['account'],
) => {
  gasAccountService.setGasAccountSig(sig, account);
  setGasAccountSigState({ sig, accountId: account?.address, account: account });
};
export const useSetGasAccount = () => {
  return setGasAccount;
};

export const useGasAccountLogoutVisible = () => {
  // return useAtom(logoutVisibleAtom);
  const isVisible = gasAccountStore(s => s.logoutVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('logoutVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};

export const useGasAccountLoginVisible = () => {
  // return useAtom(loginVisibleAtom);
  const isVisible = gasAccountStore(s => s.loginVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('loginVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};

export const useGasAccountSwitchVisible = () => {
  // return useAtom(switchVisibleAtom);
  const isVisible = gasAccountStore(s => s.switchVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('switchVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};
