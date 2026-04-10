export type DepositValidationMessages = {
  unavailablePaymentWallet: string;
  invalidAmount: string;
  zeroInvalidAmount: string;
  minAmountRequired: string;
  insufficientTokenBalance: string;
  fetchQuoteFailed: string;
};

const MAX_DEPOSIT_USD = 500;

export const getDepositAmountValidation = ({
  hasSelectedToken,
  hasSelectedOwnerAccount,
  usdValue,
  amountValue,
  isBridgeDeposit,
  directTokenBalance,
  tokenBalanceUsd,
  hasTokenPrice,
  minDepositUsd,
  messages,
}: {
  hasSelectedToken: boolean;
  hasSelectedOwnerAccount: boolean;
  usdValue: string;
  amountValue: number;
  isBridgeDeposit: boolean;
  directTokenBalance: number;
  tokenBalanceUsd: number;
  hasTokenPrice: boolean;
  minDepositUsd: number;
  messages: DepositValidationMessages;
}) => {
  if (!hasSelectedToken) {
    return { isValid: false, errorMessage: '' };
  }

  if (!hasSelectedOwnerAccount) {
    return {
      isValid: false,
      errorMessage: messages.unavailablePaymentWallet,
    };
  }

  if (!usdValue) {
    return { isValid: false, errorMessage: '' };
  }

  if (Number.isNaN(amountValue)) {
    return {
      isValid: false,
      errorMessage: messages.invalidAmount,
    };
  }

  if (amountValue <= 0) {
    return {
      isValid: false,
      errorMessage: messages.zeroInvalidAmount,
    };
  }

  if (amountValue < minDepositUsd) {
    return {
      isValid: false,
      errorMessage: messages.minAmountRequired,
    };
  }

  if (amountValue > MAX_DEPOSIT_USD) {
    return {
      isValid: false,
      errorMessage: messages.invalidAmount,
    };
  }

  if (!isBridgeDeposit && directTokenBalance < amountValue) {
    return {
      isValid: false,
      errorMessage: messages.insufficientTokenBalance,
    };
  }

  if (isBridgeDeposit && tokenBalanceUsd < amountValue) {
    return {
      isValid: false,
      errorMessage: messages.insufficientTokenBalance,
    };
  }

  if (isBridgeDeposit && !hasTokenPrice) {
    return {
      isValid: false,
      errorMessage: messages.fetchQuoteFailed,
    };
  }

  return {
    isValid: true,
    errorMessage: '',
  };
};

export const getMinDepositUsdValue = (minDepositPrice?: number) =>
  Math.max(1, Number(minDepositPrice || 0));

export const getBridgeFromTokenAmount = ({
  amountValue,
  tokenPrice,
}: {
  amountValue: number;
  tokenPrice?: number;
}) => {
  if (!tokenPrice || !amountValue) {
    return 0;
  }

  return amountValue / tokenPrice;
};

export const getDepositMaxUsdValue = ({
  isBridgeDeposit,
  directTokenBalance,
  tokenBalanceUsd,
}: {
  isBridgeDeposit: boolean;
  directTokenBalance: number;
  tokenBalanceUsd: number;
}) => {
  return isBridgeDeposit ? tokenBalanceUsd : directTokenBalance;
};

export const getDepositBalanceCopy = ({
  hasSelectedToken,
  tokenBalanceUsd,
  amountValue,
  formattedBalance,
  balanceLabel,
  insufficientBalanceLabel,
}: {
  hasSelectedToken: boolean;
  tokenBalanceUsd: number;
  amountValue: number;
  formattedBalance: string;
  balanceLabel: string;
  insufficientBalanceLabel: string;
}) => {
  const isInsufficient =
    hasSelectedToken &&
    (tokenBalanceUsd < 1 || (amountValue > 0 && tokenBalanceUsd < amountValue));
  const label = isInsufficient ? insufficientBalanceLabel : balanceLabel;

  return {
    copy: `${label}:${formattedBalance}`,
    isInsufficient,
  };
};
