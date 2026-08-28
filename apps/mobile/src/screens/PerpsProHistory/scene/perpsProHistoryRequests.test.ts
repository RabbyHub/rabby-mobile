import { loadLatestPerpsProHistoryBatch } from './perpsProHistoryRequests';

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: jest.fn() },
}));

describe('Perps Pro history requests', () => {
  it('keeps Orders available when optional fill enrichment fails', async () => {
    const orders = [{ order: { oid: 1 }, status: 'filled' }];
    const repository = {
      fetchOrderFills: jest.fn().mockRejectedValue(new Error('offline')),
      fetchOrders: jest.fn().mockResolvedValue(orders),
    } as any;

    await expect(
      loadLatestPerpsProHistoryBatch({
        accountAddress: '0x1111111111111111111111111111111111111111',
        now: 100,
        repository,
        tab: 'orders',
      }),
    ).resolves.toEqual({
      hasEarlier: false,
      orderFills: [],
      rawItems: orders,
    });
  });
});
