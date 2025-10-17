import { ComputedUserReserve } from '@aave/math-utils';

export interface IWalletBalance {
  address: string;
  amount: string;
}

export type DisplayPoolReserveInfo = ComputedUserReserve & {
  walletBalance?: string;
  walletBalanceUSD?: string;
  chain?: string;
  tokenLogo?: string;
};
