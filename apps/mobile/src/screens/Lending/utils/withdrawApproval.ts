import BigNumber from 'bignumber.js';

const NATIVE_WITHDRAW_APPROVAL_MARGIN = 1.3;

export const getNativeWithdrawRequiredAllowance = ({
  amount,
  decimals,
}: {
  amount: string;
  decimals: number;
}) => {
  return new BigNumber(amount)
    .shiftedBy(decimals)
    .integerValue(BigNumber.ROUND_UP)
    .toFixed(0);
};

export const getNativeWithdrawApprovalAmount = (requiredAllowance: string) => {
  return new BigNumber(requiredAllowance)
    .multipliedBy(NATIVE_WITHDRAW_APPROVAL_MARGIN)
    .integerValue(BigNumber.ROUND_UP)
    .toFixed(0);
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
