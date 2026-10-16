import {
  cancelAllPerpsSpotOrders,
  cancelPerpsSpotOrder,
  executePerpsSpotOrder,
} from './spotActions';

const mockSpotOrder = jest.fn();
const mockCancelSpotOrders = jest.fn();
const mockEnsureApproval = jest.fn();
const mockStoreState = {
  hasPermission: false,
  currentPerpsAccount: { address: '0xabc', type: 'SimpleKeyring' },
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: {
        spotOrder: (...args: unknown[]) => mockSpotOrder(...args),
        cancelSpotOrders: (...args: unknown[]) => mockCancelSpotOrders(...args),
      },
    }),
  },
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));

jest.mock('@/hooks/perps/actions/accountGuard', () => ({
  isSamePerpsActionAccount: () => true,
}));

// Run the action and surface failures as the fallback, like the real wrapper.
jest.mock('@/hooks/perps/perpsActionError', () => ({
  runPerpsAction: async (
    config: { fallback: unknown },
    action: () => Promise<unknown>,
  ) => {
    try {
      return await action();
    } catch {
      return config.fallback;
    }
  },
}));

jest.mock('@/hooks/perps/showToast', () => ({ showToast: jest.fn() }));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: () => mockStoreState },
}));

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const account = { address: '0xabc', type: 'SimpleKeyring' } as never;
const cancelOk = {
  response: { data: { statuses: ['success'] } },
};

describe('spot actions region permission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.hasPermission = false;
    mockCancelSpotOrders.mockResolvedValue(cancelOk);
  });

  it('refuses to place an order without the region permission', async () => {
    const buildParams = jest.fn();
    await expect(
      executePerpsSpotOrder(account, 107, buildParams),
    ).resolves.toBeNull();
    expect(buildParams).not.toHaveBeenCalled();
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockSpotOrder).not.toHaveBeenCalled();
  });

  it('still cancels one order without the region permission', async () => {
    await expect(
      cancelPerpsSpotOrder(account, { pairIndex: 107, oid: 42 }),
    ).resolves.toBe(true);
    expect(mockCancelSpotOrders).toHaveBeenCalledWith([
      { pairIndex: 107, oid: 42 },
    ]);
  });

  it('still cancels all orders without the region permission', async () => {
    mockCancelSpotOrders.mockResolvedValue({
      response: { data: { statuses: ['success', 'success'] } },
    });
    await expect(
      cancelAllPerpsSpotOrders(account, [
        { pairIndex: 107, oid: 1 },
        { pairIndex: 0, oid: 2 },
      ]),
    ).resolves.toBe(true);
    expect(mockCancelSpotOrders).toHaveBeenCalledTimes(1);
  });

  it('places an order when the region permission is granted', async () => {
    mockStoreState.hasPermission = true;
    mockSpotOrder.mockResolvedValue({
      response: { data: { statuses: [{ resting: { oid: 7 } }] } },
    });
    await expect(
      executePerpsSpotOrder(account, 107, () => ({
        pairIndex: 107,
        side: 'buy',
        type: 'limit',
        size: '1',
        limitPx: '38',
      })),
    ).resolves.toEqual({ status: 'resting', oid: 7 });
  });
});
