const mockStableCoinOrder = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/core/apis', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: { stableCoinOrder: mockStableCoinOrder },
    }),
  },
}));

jest.mock('@/hooks/perps/perpsActionError', () => ({
  runPerpsAction: async (_config: unknown, action: () => Promise<unknown>) =>
    action(),
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

    await expect(executePerpsStableCoinOrder(params)).resolves.toEqual(filled);
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
      executePerpsStableCoinOrder({
        coin: 'USDH',
        isBuy: false,
        limitPx: '0.99',
        size: '2',
      }),
    ).resolves.toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith('No liquidity', 'error');
  });
});
