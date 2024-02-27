import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';

export interface Account {
  address: string;
  balance?: number;
}

export type InitAccounts = {
  [key in LedgerHDPathType]: Account[];
};
