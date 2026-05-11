import type { Account } from '@/types/account';
import type { KeyringAccount } from '@rabby-wallet/keyring-utils';
import type {
  GasAccountBalanceAccount,
  GasAccountSessionAccount,
} from '@/screens/GasAccount/hooks/state';

type GasAccountStoreApiBridge = {
  getSession: () => { sig?: string; account?: GasAccountSessionAccount };
  setAccountsWithGasAccountBalance: (
    accounts: GasAccountBalanceAccount[],
  ) => void;
  loginGasAccount: (account: Account) => Promise<unknown>;
  clearPendingHardwareAccount: () => void;
  setPendingHardwareAccount: (
    account: Pick<KeyringAccount, 'address' | 'type' | 'brandName'>,
  ) => void;
};

let gasAccountStoreApi: GasAccountStoreApiBridge | null = null;

export function setGasAccountStoreApi(api: GasAccountStoreApiBridge) {
  gasAccountStoreApi = api;
}

export function getGasAccountStoreApi() {
  if (!gasAccountStoreApi) {
    throw new Error('gas account store api is not ready');
  }

  return gasAccountStoreApi;
}
