import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockExecuteCancel = jest.fn();
const mockEnsureApproval = jest.fn();
const mockShowToast = jest.fn();
let mockCurrentAccount: { address: string; type: string } | null;

jest.mock('@/constant', () => ({ APP_VERSIONS: { fromNative: 'test' } }));
jest.mock('@/hooks/perps/actions/cancelOrders', () => ({
  buildPerpsCancelOrdersCommand: (account: any, orders: any) => ({
    account,
    orders,
    type: 'cancelOrders',
  }),
  executePerpsCancelOrders: (...args: any[]) => mockExecuteCancel(...args),
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: any[]) => mockEnsureApproval(...args),
}));
jest.mock('@/hooks/perps/actions/accountGuard', () => ({
  isSamePerpsActionAccount: (left: any, right: any) =>
    !!left &&
    !!right &&
    left.type === right.type &&
    left.address.toLowerCase() === right.address.toLowerCase(),
}));
jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: {
    getState: () => ({
      currentPerpsAccount: mockCurrentAccount,
    }),
  },
}));
jest.mock('@/utils/perps', () => ({
  getStatsReportSide: () => 'Long',
}));
jest.mock('@/utils/stats', () => ({
  stats: { report: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import { usePerpsProCancelOrders } from './usePerpsProCancelOrders';

const order = (oid: number): PerpsOpenOrderViewModel => ({
  amountBase: '1',
  amountQuote: '100',
  category: 'basic',
  coin: 'BTC',
  displayAmountQuote: '100',
  editKind: 'basicLimit',
  executionPrice: '100',
  executionPriceKind: 'limit',
  filledQuote: '0',
  filledRatio: '0',
  filledSize: '0',
  key: `basic:BTC:${oid}`,
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: false,
  oid,
  orderType: 'Limit',
  reduceOnly: false,
  remainingSize: '1',
  side: 'buy',
  tif: 'Gtc',
  timestamp: 1,
  triggerCondition: null,
  triggerKind: null,
  triggerPrice: null,
});

describe('usePerpsProCancelOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentAccount = { address: '0xabc', type: 'PrivateKey' };
    mockEnsureApproval.mockResolvedValue(undefined);
    mockExecuteCancel.mockImplementation(async command => ({
      items: command.orders.map((item: any) => ({
        ...item,
        status: 'success',
      })),
      kind: 'success',
    }));
  });

  it('requires confirmation before a single cancel is approved or executed', async () => {
    const hook = renderHook(() => usePerpsProCancelOrders());
    act(() => hook.result.current.confirmCancelOrder(order(1)));

    expect(hook.result.current.confirmation).toMatchObject({
      kind: 'single',
      title: 'page.perps.pro.openOrders.cancelConfirmTitle',
    });
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockExecuteCancel).not.toHaveBeenCalled();

    act(() => hook.result.current.confirmCancellation());
    await waitFor(() => expect(mockExecuteCancel).toHaveBeenCalledTimes(1));
    expect(mockEnsureApproval).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.cancelSuccess',
      'success',
    );
  });

  it('requires confirmation before Cancel All and submits the frozen category rows', async () => {
    const rows = [order(1), order(2)];
    const hook = renderHook(() => usePerpsProCancelOrders());
    act(() => hook.result.current.confirmCancelAll(rows, 'basic'));

    expect(hook.result.current.confirmation).toMatchObject({
      kind: 'all',
      title: 'page.perps.pro.openOrders.cancelAllBasicConfirmTitle',
    });
    expect(mockExecuteCancel).not.toHaveBeenCalled();

    act(() => hook.result.current.confirmCancellation());
    await waitFor(() => expect(mockExecuteCancel).toHaveBeenCalledTimes(1));
    expect(mockExecuteCancel.mock.calls[0]?.[0].orders).toEqual([
      { coin: 'BTC', oid: 1 },
      { coin: 'BTC', oid: 2 },
    ]);
  });

  it('does not approve or cancel old rows if the account changes while confirmation is open', async () => {
    const hook = renderHook(() => usePerpsProCancelOrders());
    act(() => hook.result.current.confirmCancelOrder(order(1)));

    mockCurrentAccount = { address: '0xdef', type: 'PrivateKey' };
    act(() => hook.result.current.confirmCancellation());

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'page.perps.pro.openOrders.cancelContextChanged',
        'error',
      ),
    );
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockExecuteCancel).not.toHaveBeenCalled();
  });
});
