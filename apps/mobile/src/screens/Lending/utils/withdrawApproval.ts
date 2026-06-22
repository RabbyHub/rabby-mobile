import { SUPER_BIG_ALLOWANCE_NUMBER } from '@aave/contract-helpers';
import BigNumber from 'bignumber.js';
import { parseUnits } from 'ethers/lib/utils';

export const getNativeWithdrawRequiredAllowance = ({
  amount,
  decimals,
  isMaxSelected,
}: {
  amount: string;
  decimals: number;
  isMaxSelected: boolean;
}) => {
  return isMaxSelected
    ? SUPER_BIG_ALLOWANCE_NUMBER
    : parseUnits(amount, decimals).toString();
};

export const isNativeWithdrawApprovalRequired = ({
  allowance,
  requiredAllowance,
}: {
  allowance: string;
  requiredAllowance: string;
}) => {
  return new BigNumber(allowance || '0').lt(requiredAllowance);
};
