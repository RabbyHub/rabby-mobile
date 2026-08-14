import { act, renderHook } from '@testing-library/react-native';

const mockExecuteCancel = jest.fn();
const mockBuildPositionTpSl = jest.fn();
const mockExecutePositionTpSl = jest.fn();
const mockEnsureApproval = jest.fn();
const mockFetchClearinghouse = jest.fn();
const mockShowToast = jest.fn();
const mockGetState = jest.fn();
const mockGetSkipConfirmation = jest.fn();
const mockSetSkipConfirmation = jest.fn();

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProPositionTpSlConfirmation: (...args: any[]) =>
      mockGetSkipConfirmation(...args),
    setSkipPerpsProPositionTpSlConfirmation: (...args: any[]) =>
      mockSetSkipConfirmation(...args),
  },
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
jest.mock('@/hooks/perps/actions/positionTpSl', () => ({
  buildPerpsPositionTpSlCommand: (...args: any[]) =>
    mockBuildPositionTpSl(...args),
  executePerpsPositionTpSl: (...args: any[]) =>
    mockExecutePositionTpSl(...args),
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: (...args: any[]) =>
    mockFetchClearinghouse(...args),
  getDexByCoin: () => '',
  perpsStore: { getState: () => mockGetState() },
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../model/market', () => ({
  buildPerpsProMarketDescriptor: () => ({
    displayBase: 'BTC',
    displayPair: 'BTCUSDC',
    sourceTag: null,
  }),
}));

import type { PerpsPositionViewModel } from '../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../model/positionTpSl';
import { usePerpsProPositionTpSl } from './usePerpsProPositionTpSl';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};
const order: PerpsPositionTpSlOrderViewModel = {
  execution: 'market',
  key: 'partial:BTC:7',
  kind: 'takeProfit',
  oid: 7,
  originalSize: '0.5',
  remainingSize: '0.5',
  scope: 'partial',
  side: 'A',
  timestamp: 1,
  triggerPrice: '110',
};
const position = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  key: 'BTC',
  tpslOrders: [order],
} as PerpsPositionViewModel;

describe('usePerpsProPositionTpSl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApproval.mockResolvedValue(undefined);
    mockGetSkipConfirmation.mockResolvedValue(false);
    mockSetSkipConfirmation.mockResolvedValue(undefined);
    mockBuildPositionTpSl.mockReturnValue({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '0.5',
          triggerPrice: '110',
        },
      ],
      markPrice: '100',
      scope: 'partial',
      type: 'positionTpSl',
    });
    mockFetchClearinghouse.mockResolvedValue(undefined);
    mockGetState.mockReturnValue({
      currentClearinghouseState: {
        assetPositions: [{ position: { coin: 'BTC', szi: '1' } }],
      },
      currentPerpsAccount: account,
      marketDataMap: {
        BTC: {
          markPx: '100',
          pxDecimals: 2,
          quoteAsset: 'USDC',
          szDecimals: 3,
        },
      },
      openOrders: [{ coin: 'BTC', isTrigger: true, oid: 7, reduceOnly: true }],
    });
  });

  it('opens with the device trade Amount unit instead of Position Size session', () => {
    const hook = renderHook(
      ({ amountUnit }: { amountUnit: 'base' | 'quote' }) =>
        usePerpsProPositionTpSl('account-a', amountUnit),
      { initialProps: { amountUnit: 'quote' as const } },
    );

    act(() => hook.result.current.open(position, 'partial'));
    expect(hook.result.current.editor?.amountUnit).toBe('quote');

    act(() => hook.result.current.close());
    hook.rerender({ amountUnit: 'base' });
    act(() => hook.result.current.open(position, 'partial'));
    expect(hook.result.current.editor?.amountUnit).toBe('base');
  });

  it('keeps the editor open after submission and publishes a root-surface settlement', async () => {
    mockExecutePositionTpSl.mockResolvedValue({
      kind: 'success',
      legs: [
        {
          cancel: 'notRequired',
          create: 'success',
          kind: 'takeProfit',
          oid: 8,
          replacedOid: null,
        },
      ],
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));
    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: null,
            size: '0.5',
            triggerPrice: '110',
          },
        ],
        mode: 'add',
        scope: 'partial',
      });
    });

    await act(async () => {
      await hook.result.current.confirm();
    });

    expect(hook.result.current.editor).not.toBeNull();
    expect(hook.result.current.review).toBeNull();
    expect(hook.result.current.settlement).toEqual({
      revision: 1,
      scope: 'partial',
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positionTpsl.submitted',
      'success',
    );
  });

  it('persists the TP/SL-specific skip choice only when the checked confirmation is submitted', async () => {
    mockExecutePositionTpSl.mockResolvedValue({
      kind: 'success',
      legs: [
        {
          cancel: 'notRequired',
          create: 'success',
          kind: 'takeProfit',
          oid: 8,
          replacedOid: null,
        },
      ],
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: null,
            size: '0.5',
            triggerPrice: '110',
          },
        ],
        mode: 'add',
        scope: 'partial',
      });
    });
    expect(mockSetSkipConfirmation).not.toHaveBeenCalled();

    act(() => hook.result.current.toggleSkipConfirmation());
    expect(hook.result.current.skipConfirmation).toBe(true);
    await act(async () => {
      await hook.result.current.confirm();
    });

    expect(mockSetSkipConfirmation).toHaveBeenCalledWith(true);
    expect(mockExecutePositionTpSl).toHaveBeenCalledTimes(1);
  });

  it('submits the frozen TP/SL command directly when its independent skip preference is enabled', async () => {
    mockGetSkipConfirmation.mockResolvedValue(true);
    mockExecutePositionTpSl.mockResolvedValue({
      kind: 'success',
      legs: [
        {
          cancel: 'notRequired',
          create: 'success',
          kind: 'takeProfit',
          oid: 8,
          replacedOid: null,
        },
      ],
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: null,
            size: '0.5',
            triggerPrice: '110',
          },
        ],
        mode: 'add',
        scope: 'partial',
      });
    });

    expect(hook.result.current.review).toBeNull();
    expect(mockExecutePositionTpSl).toHaveBeenCalledTimes(1);
    expect(hook.result.current.settlement).toEqual({
      revision: 1,
      scope: 'partial',
    });
  });

  it('deduplicates review requests while the skip preference is loading', async () => {
    let resolvePreference: ((value: boolean) => void) | null = null;
    mockGetSkipConfirmation.mockReturnValue(
      new Promise<boolean>(resolve => {
        resolvePreference = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    const draft = {
      legs: [
        {
          kind: 'takeProfit' as const,
          replaceOid: null,
          size: '0.5',
          triggerPrice: '110',
        },
      ],
      mode: 'add' as const,
      scope: 'partial' as const,
    };
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      const first = hook.result.current.requestReview(draft);
      const duplicate = hook.result.current.requestReview(draft);
      resolvePreference?.(false);
      await Promise.all([first, duplicate]);
    });

    expect(mockBuildPositionTpSl).toHaveBeenCalledTimes(1);
    expect(hook.result.current.review).not.toBeNull();
  });

  it('keeps a canceled order visible and disabled until its success Toast finishes', async () => {
    mockExecuteCancel.mockResolvedValue({
      items: [{ coin: 'BTC', oid: 7, status: 'success' }],
      kind: 'success',
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      await hook.result.current.cancelOrder(order);
    });

    expect(hook.result.current.editor).not.toBeNull();
    expect(hook.result.current.confirmedCancelledOids).toEqual([]);
    expect(hook.result.current.cancelingOids).toEqual([7]);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positionTpsl.cancelSuccess',
      'success',
      expect.objectContaining({ onHidden: expect.any(Function) }),
    );

    act(() => mockShowToast.mock.lastCall?.[2].onHidden());
    expect(hook.result.current.confirmedCancelledOids).toEqual([7]);
    expect(hook.result.current.cancelingOids).toEqual([]);
  });

  it('ignores a completed Toast from an editor that was already closed', async () => {
    mockExecuteCancel.mockResolvedValue({
      items: [{ coin: 'BTC', oid: 7, status: 'success' }],
      kind: 'success',
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      await hook.result.current.cancelOrder(order);
    });
    const onHidden = mockShowToast.mock.lastCall?.[2].onHidden;

    act(() => hook.result.current.close());
    act(() => onHidden());

    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.confirmedCancelledOids).toEqual([]);
    expect(hook.result.current.cancelingOids).toEqual([]);
  });

  it('keeps a failed cancellation visible and shows the failure toast', async () => {
    mockExecuteCancel.mockResolvedValue({
      items: [{ coin: 'BTC', error: 'failed', oid: 7, status: 'failed' }],
      kind: 'failed',
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));

    await act(async () => {
      await hook.result.current.cancelOrder(order);
    });

    expect(hook.result.current.editor).not.toBeNull();
    expect(hook.result.current.confirmedCancelledOids).toEqual([]);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positionTpsl.cancelFailed',
      'error',
    );
  });
});
