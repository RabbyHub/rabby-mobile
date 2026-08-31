const mockStableCoinOrder = jest.fn();
const mockShowToast = jest.fn();
const mockEnsureApproval = jest.fn(async () => undefined);

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'PrivateKeyring',
} as const;

jest.mock('@/core/apis', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: { stableCoinOrder: mockStableCoinOrder },
    }),
  },
}));

jest.mock('@/hooks/perps/perpsActionError', () => ({
  runPerpsAction: async (
    config: {
      fallback: unknown;
      getToastMessage?: (error: Error) => string;
    },
    action: () => Promise<unknown>,
  ) => {
    try {
      return await action();
    } catch (error) {
      mockShowToast(
        config.getToastMessage?.(error as Error) || 'Swap failed',
        'error',
      );
      return config.fallback;
    }
  },
}));

jest.mock('@/hooks/perps/actions/accountGuard', () => ({
  isSamePerpsActionAccount: () => true,
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: () => ({ currentPerpsAccount: mockAccount }) },
}));

jest.mock('@/hooks/perps/showToast', () => ({
  __esModule: true,
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

import { executePerpsStableCoinOrder } from './perpsStableCoinOrder';

describe('executePerpsStableCoinOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves the existing stableCoinOrder params and success feedback', async () => {
    const filled = { avgPx: '1', totalSz: '10' };
    mockStableCoinOrder.mockResolvedValue({
      response: { data: { statuses: [{ filled }] } },
    });
    const params = {
      coin: 'USDT' as const,
      isBuy: true,
      limitPx: '1.01',
      size: '10',
    };

    await expect(
      executePerpsStableCoinOrder(mockAccount, params),
    ).resolves.toEqual(filled);
    expect(mockEnsureApproval).toHaveBeenCalledWith(mockAccount, {
      builderFee: false,
    });
    expect(mockStableCoinOrder).toHaveBeenCalledWith(params);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Swap completed successfully',
      'success',
    );
  });

  it('returns null and keeps the SDK error feedback when no fill is returned', async () => {
    mockStableCoinOrder.mockResolvedValue({
      response: { data: { statuses: [{ error: 'No liquidity' }] } },
    });

    await expect(
      executePerpsStableCoinOrder(mockAccount, {
        coin: 'USDH',
        isBuy: false,
        limitPx: '0.99',
        size: '2',
      }),
    ).resolves.toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith('No liquidity', 'error');
  });
});
