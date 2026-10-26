import BigNumber from 'bignumber.js';

export type DepositValidationMessages = {
  unavailablePaymentWallet: string;
  invalidAmount: string;
  zeroInvalidAmount: string;
  minAmountRequired: string;
  insufficientTokenBalance: string;
  fetchQuoteFailed: string;
};

const MAX_DEPOSIT_USD = 500;
const PRICE_IMPACT_WARNING_THRESHOLD = 0.05;
const MAX_DEFAULT_QUOTE_PRICE_IMPACT = 0.2;

type DepositTokenIdentity = {
  owner_addr?: string;
  chain: string;
  id: string;
  gasAccountDepositType: 'direct' | 'bridge';
};

const getDepositTokenKey = (token: DepositTokenIdentity) =>
  [
    token.owner_addr?.toLowerCase(),
    token.chain,
    token.id.toLowerCase(),
    token.gasAccountDepositType,
  ].join(':');

export const getNextDefaultQuoteToken = <T extends DepositTokenIdentity>(
  availableTokens: T[],
  currentToken: DepositTokenIdentity,
) => {
  const currentIndex = availableTokens.findIndex(
    token => getDepositTokenKey(token) === getDepositTokenKey(currentToken),
  );

  return currentIndex >= 0 ? availableTokens[currentIndex + 1] : undefined;
};

export const getGasAccountPriceImpact = ({
  payUsd,
  receiveUsd,
}: {
  payUsd: number;
  receiveUsd: number;
}) => {
  if (!Number.isFinite(payUsd) || payUsd <= 0 || !Number.isFinite(receiveUsd)) {
    return { lossUsd: 0, showWarning: false, isTooHigh: false };
  }

  const lossUsd = BigNumber.max(new BigNumber(payUsd).minus(receiveUsd), 0);
  const lossRatio = lossUsd.div(payUsd);

  return {
    lossUsd: lossUsd.toNumber(),
    showWarning: lossRatio.gte(PRICE_IMPACT_WARNING_THRESHOLD),
    isTooHigh: lossRatio.gt(MAX_DEFAULT_QUOTE_PRICE_IMPACT),
  };
};

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
