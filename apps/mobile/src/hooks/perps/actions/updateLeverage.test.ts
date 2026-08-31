jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
  perpsStore: { getState: jest.fn(() => ({})) },
}));

import {
  buildPerpsUpdateLeverageCommand,
  executePerpsUpdateLeverage,
  type UpdateLeverageDependencies,
} from './updateLeverage';

const account = { address: '0xabc', type: 'PrivateKey' };

const dependencies = (
  overrides: Partial<UpdateLeverageDependencies> = {},
): UpdateLeverageDependencies => ({
  getCurrentAccount: () => account,
  refresh: jest.fn(async () => undefined),
  resolveDex: () => 'xyz',
  updateLeverage: jest.fn(async () => ({ status: 'ok' })),
  ...overrides,
});

describe('Perps update leverage action', () => {
  it('freezes a bounded integer command and submits the margin mode', async () => {
    const command = buildPerpsUpdateLeverageCommand({
      account,
      coin: ' BTC ',
      isCross: false,
      leverage: 20,
      maxLeverage: 40,
    });
    const deps = dependencies();

    await expect(executePerpsUpdateLeverage(command, deps)).resolves.toEqual({
      kind: 'success',
      refreshError: undefined,
    });
    expect(deps.updateLeverage).toHaveBeenCalledWith({
      coin: 'BTC',
      isCross: false,
      leverage: 20,
    });
    expect(deps.refresh).toHaveBeenCalledWith('xyz');
  });

  it('rejects values outside the server market maximum', () => {
    expect(() =>
      buildPerpsUpdateLeverageCommand({
        account,
        coin: 'BTC',
        isCross: true,
        leverage: 41,
        maxLeverage: 40,
      }),
    ).toThrow('Invalid Perps leverage');
  });

  it('does not submit after the account context changes', async () => {
    const updateLeverage = jest.fn();
    const command = buildPerpsUpdateLeverageCommand({
      account,
      coin: 'BTC',
      isCross: true,
      leverage: 10,
      maxLeverage: 40,
    });

    await expect(
      executePerpsUpdateLeverage(
        command,
        dependencies({
          getCurrentAccount: () => ({ ...account, address: '0xdef' }),
          updateLeverage,
        }),
      ),
    ).resolves.toEqual({ kind: 'staleContext' });
    expect(updateLeverage).not.toHaveBeenCalled();
  });
});
