import { toast } from '@/components/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { sendRequest } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import {
  gasAccountService,
  keyringService,
  perpsService,
} from '@/core/services';
import { GasAccountServiceStore } from '@/core/services/gasAccount';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { eventBus, EVENTS } from '@/utils/events';
import { sendPersonalMessage } from '@/utils/sendPersonalMessage';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringEventAccount } from '@rabby-wallet/service-keyring';
import pRetry from 'p-retry';
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

const syncDeleteGasAccount = async ({
  address,
  type,
  brandName,
}: KeyringEventAccount) => {
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

async function fetchGasAccountInfo() {
  const { sig, accountId } = gasAccountStore.getState().sigState || {};

  if (!sig || !accountId) {
    return undefined;
  }
  return openapi.getGasAccountInfo({ sig, id: accountId }).then(e => {
    if (e.account.id) {
      return e;
    }
    storeApiGasAccount.setGasAccount();
    return undefined;
  });
}

export const storeApiGasAccount = {
  setGasAccount,
  getSigState() {
    return gasAccountStore.getState().sigState;
  },
  fetchGasAccountInfo,
  setLogoutVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('logoutVisible', valOrFunc);
  },
  setLoginVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('loginVisible', valOrFunc);
  },
  setSwitchVisible(valOrFunc: UpdaterOrPartials<boolean>) {
    setVisibleFor('switchVisible', valOrFunc);
  },

  loginGasAccount: async (selectAccount: Account) => {
    const account = selectAccount;
    if (!account) {
      throw new Error('background.error.noCurrentAccount');
    }
    console.debug('selectAccount', account);
    const { text } = await openapi.getGasAccountSignText(account.address);

    const noSignType =
      account?.type === KEYRING_CLASS.PRIVATE_KEY ||
      account?.type === KEYRING_CLASS.MNEMONIC;

    let signature = '';
    if (noSignType) {
      const { txHash } = await sendPersonalMessage({
        data: [text, account.address],
        account: account,
      });
      signature = txHash;
    } else {
      signature = await sendRequest<string>({
        data: {
          method: 'personal_sign',
          params: [text, account.address],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      });
    }
    console.log(signature);
    if (signature) {
      const result = await pRetry(
        async () =>
          openapi.loginGasAccount({
            sig: signature,
            account_id: account.address,
          }),
        {
          retries: 2,
        },
      );

      if (result?.success) {
        storeApiGasAccount.setGasAccount(signature, account);
        gasAccountService.setHasClaimedGift(true);
        // setLoginVisible(false);
      } else {
        throw new Error('Login failed');
      }
    }
    return signature;
  },

  logoutGasAccount: async () => {
    const { sig, accountId } = storeApiGasAccount.getSigState() || {};
    if (sig && accountId) {
      const result = await openapi.logoutGasAccount({
        sig,
        account_id: accountId,
      });
      if (result.success) {
        storeApiGasAccount.setGasAccount();
        storeApiGasAccount.setLogoutVisible(false);
        // gotoDashboard();
      } else {
        toast.show('please retry');
      }
    }
  },
};

export const useGasAccountLogoutVisible = () => {
  const isVisible = gasAccountStore(s => s.logoutVisible);
  return [isVisible, storeApiGasAccount.setLogoutVisible] as const;
};

export const useGasAccountLoginVisible = () => {
  const isVisible = gasAccountStore(s => s.loginVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('loginVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};

export const useGasAccountSwitchVisible = () => {
  const isVisible = gasAccountStore(s => s.switchVisible);
  const setIsVisible = useCallback((valOrFunc: UpdaterOrPartials<boolean>) => {
    setVisibleFor('switchVisible', valOrFunc);
  }, []);
  return [isVisible, setIsVisible] as const;
};
