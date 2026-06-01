import {
  type DepositValidationMessages,
  getBridgeFromTokenAmount,
  getDepositAmountValidation,
  getDepositBalanceCopy,
  getDepositMaxUsdValue,
  getMinDepositUsdValue,
} from './GasAccountDepositTokenForm.utils';

const messages: DepositValidationMessages = {
  unavailablePaymentWallet: 'wallet unavailable',
  invalidAmount: 'invalid amount',
  zeroInvalidAmount: 'zero amount',
  minAmountRequired: 'min amount required',
  insufficientTokenBalance: 'insufficient balance',
  fetchQuoteFailed: 'fetch quote failed',
};

const baseValidationParams = {
  hasSelectedToken: true,
  hasSelectedOwnerAccount: true,
  usdValue: '10',
  amountValue: 10,
  isBridgeDeposit: false,
  directTokenBalance: 20,
  tokenBalanceUsd: 20,
  hasTokenPrice: true,
  minDepositUsd: 1,
  messages,
};

describe('getDepositAmountValidation', () => {
  it('waits silently until a token and USD value are selected', () => {
    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        hasSelectedToken: false,
      }),
    ).toEqual({ isValid: false, errorMessage: '' });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        usdValue: '',
      }),
    ).toEqual({ isValid: false, errorMessage: '' });
  });

  it('requires an available payment wallet before validating amounts', () => {
    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        hasSelectedOwnerAccount: false,
        amountValue: Number.NaN,
      }),
    ).toEqual({
      isValid: false,
      errorMessage: messages.unavailablePaymentWallet,
    });
  });

  it('rejects invalid, zero, below-minimum, and over-limit amounts', () => {
    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        amountValue: Number.NaN,
      }),
    ).toEqual({ isValid: false, errorMessage: messages.invalidAmount });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        amountValue: 0,
      }),
    ).toEqual({ isValid: false, errorMessage: messages.zeroInvalidAmount });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        amountValue: 0.5,
        minDepositUsd: 1,
      }),
    ).toEqual({ isValid: false, errorMessage: messages.minAmountRequired });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        amountValue: 501,
        directTokenBalance: 1000,
        tokenBalanceUsd: 1000,
      }),
    ).toEqual({ isValid: false, errorMessage: messages.invalidAmount });
  });

  it('uses direct token balance for same-chain deposits', () => {
    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        isBridgeDeposit: false,
        amountValue: 30,
        directTokenBalance: 20,
        tokenBalanceUsd: 100,
      }),
    ).toEqual({
      isValid: false,
      errorMessage: messages.insufficientTokenBalance,
    });
  });

  it('uses USD balance and quote availability for bridge deposits', () => {
    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        isBridgeDeposit: true,
        amountValue: 30,
        directTokenBalance: 100,
        tokenBalanceUsd: 20,
      }),
    ).toEqual({
      isValid: false,
      errorMessage: messages.insufficientTokenBalance,
    });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        isBridgeDeposit: true,
        amountValue: 30,
        directTokenBalance: 10,
        tokenBalanceUsd: 40,
        hasTokenPrice: false,
      }),
    ).toEqual({
      isValid: false,
      errorMessage: messages.fetchQuoteFailed,
    });
  });

  it('accepts valid direct and bridge deposits', () => {
    expect(getDepositAmountValidation(baseValidationParams)).toEqual({
      isValid: true,
      errorMessage: '',
    });

    expect(
      getDepositAmountValidation({
        ...baseValidationParams,
        isBridgeDeposit: true,
        directTokenBalance: 0,
        tokenBalanceUsd: 10,
      }),
    ).toEqual({
      isValid: true,
      errorMessage: '',
    });
  });
});

describe('gas account deposit helpers', () => {
  it('normalizes minimum deposit to at least 1 USD', () => {
    expect(getMinDepositUsdValue()).toBe(1);
    expect(getMinDepositUsdValue(0.5)).toBe(1);
    expect(getMinDepositUsdValue(2.5)).toBe(2.5);
  });

  it('converts bridge USD amount to token amount only when price is available', () => {
    expect(getBridgeFromTokenAmount({ amountValue: 100, tokenPrice: 4 })).toBe(
      25,
    );
    expect(getBridgeFromTokenAmount({ amountValue: 100 })).toBe(0);
    expect(getBridgeFromTokenAmount({ amountValue: 0, tokenPrice: 4 })).toBe(0);
  });

  it('chooses the correct max deposit balance for direct and bridge deposits', () => {
    expect(
      getDepositMaxUsdValue({
        isBridgeDeposit: false,
        directTokenBalance: 12,
        tokenBalanceUsd: 30,
      }),
    ).toBe(12);

    expect(
      getDepositMaxUsdValue({
        isBridgeDeposit: true,
        directTokenBalance: 12,
        tokenBalanceUsd: 30,
      }),
    ).toBe(30);
  });

  it('builds balance copy with insufficient state from selected token balance', () => {
    expect(
      getDepositBalanceCopy({
        hasSelectedToken: false,
        tokenBalanceUsd: 0,
        amountValue: 50,
        formattedBalance: '$0.00',
        balanceLabel: 'Balance',
        insufficientBalanceLabel: 'Insufficient',
      }),
    ).toEqual({
      copy: 'Balance:$0.00',
      isInsufficient: false,
    });

    expect(
      getDepositBalanceCopy({
        hasSelectedToken: true,
        tokenBalanceUsd: 0.5,
        amountValue: 0,
        formattedBalance: '$0.50',
        balanceLabel: 'Balance',
        insufficientBalanceLabel: 'Insufficient',
      }),
    ).toEqual({
      copy: 'Insufficient:$0.50',
      isInsufficient: true,
    });

    expect(
      getDepositBalanceCopy({
        hasSelectedToken: true,
        tokenBalanceUsd: 20,
        amountValue: 25,
        formattedBalance: '$20.00',
        balanceLabel: 'Balance',
        insufficientBalanceLabel: 'Insufficient',
      }),
    ).toEqual({
      copy: 'Insufficient:$20.00',
      isInsufficient: true,
    });
  });
});
