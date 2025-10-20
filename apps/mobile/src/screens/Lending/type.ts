import { ReserveDataHumanized } from '@aave/contract-helpers';
import {
  ComputedUserReserve,
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
} from '@aave/math-utils';

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

export type PopupDetailProps = {
  reserve: DisplayPoolReserveInfo;
  userSummary: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  >;
};
