import { ReserveDataHumanized } from '@aave/contract-helpers';
import {
  ComputedUserReserve,
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
} from '@aave/math-utils';
import { CHAINS_ENUM } from '@debank/common';

export interface IWalletBalance {
  address: string;
  amount: string;
}

export type DisplayPoolReserveInfo = ComputedUserReserve & {
  walletBalance?: string;
  walletBalanceUSD?: string;
  chain: CHAINS_ENUM;
  tokenLogo?: string;
};

export type PopupDetailProps = {
  reserve: DisplayPoolReserveInfo;
  userSummary: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  >;
  onClose?: () => void;
};
