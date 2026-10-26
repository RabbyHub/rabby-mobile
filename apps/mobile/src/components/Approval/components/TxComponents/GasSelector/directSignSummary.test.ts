const mockFormatGasHeaderUsdValue = jest.fn((value: number | string) => {
  return `$fmt:${String(value)}`;
});

jest.mock('@/utils/number', () => ({
  formatGasHeaderUsdValue: (value: number | string) =>
    mockFormatGasHeaderUsdValue(value),
}));

import { buildDirectSignSummary, calcGasAccountUsd } from './directSignSummary';

describe('directSignSummary', () => {
  beforeEach(() => {
    mockFormatGasHeaderUsdValue.mockClear();
  });

  it('keeps native gas summary strings from the caller', () => {
    expect(
      buildDirectSignSummary({
        displayGasMethod: 'native',
        gasCostUsdStr: '$0.08',
        gasCostAmountStr: '0.00002 ETH',
      }),
    ).toEqual({
      primaryText: '$0.08',
      secondaryText: '~0.00002 ETH',
      useGasAccountCost: false,
    });
    expect(mockFormatGasHeaderUsdValue).not.toHaveBeenCalled();
  });

  it('sums GasAccount tx cost and service gas cost for both summary lines', () => {
    expect(
      buildDirectSignSummary({
        displayGasMethod: 'gasAccount',
        gasCostUsdStr: '$0.08',
        gasCostAmountStr: '0.00002 ETH',
        gasAccountCost: {
          estimate_tx_cost: 0.01,
          gas_cost: 0.0025,
        },
      }),
    ).toEqual({
      primaryText: '$fmt:0.0125',
      secondaryText: '~fmt:0.0125 USD',
      useGasAccountCost: true,
    });
    expect(mockFormatGasHeaderUsdValue).toHaveBeenCalledTimes(2);
    expect(mockFormatGasHeaderUsdValue).toHaveBeenNthCalledWith(1, 0.0125);
    expect(mockFormatGasHeaderUsdValue).toHaveBeenNthCalledWith(2, 0.0125);
  });

  it('falls back to zero when GasAccount cost fields are missing', () => {
    expect(
      buildDirectSignSummary({
        displayGasMethod: 'gasAccount',
        gasCostUsdStr: '$0.08',
        gasCostAmountStr: '0.00002 ETH',
      }),
    ).toEqual({
      primaryText: '$fmt:0',
      secondaryText: '~fmt:0 USD',
      useGasAccountCost: true,
    });
  });

  it('normalizes empty GasAccount USD values before formatting', () => {
    expect(calcGasAccountUsd('')).toBe('$fmt:0');
    expect(mockFormatGasHeaderUsdValue).toHaveBeenCalledWith('0');
  });
});
