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
  leverage: 10,
  marginMode: 'isolated',
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

  it('closes the editor after a full-position TP/SL submission', async () => {
    mockBuildPositionTpSl.mockReturnValue({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: null,
          triggerPrice: '110',
        },
      ],
      markPrice: '100',
      scope: 'position',
      type: 'positionTpSl',
    });
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
    act(() => hook.result.current.open(position, 'position'));
    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: null,
            size: null,
            triggerPrice: '110',
          },
        ],
        mode: 'position',
        scope: 'position',
      });
    });

    await act(async () => {
      await hook.result.current.confirm();
    });

    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.review).toBeNull();
    expect(hook.result.current.settlement).toBeNull();
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

    let first: Promise<void>;
    let duplicate: Promise<void>;
    act(() => {
      first = hook.result.current.requestReview(draft);
      duplicate = hook.result.current.requestReview(draft);
    });
    expect(hook.result.current.reviewRequesting).toBe(true);
    expect(hook.result.current.pending).toBe(false);

    await act(async () => {
      resolvePreference?.(false);
      await Promise.all([first!, duplicate!]);
    });

    expect(mockBuildPositionTpSl).toHaveBeenCalledTimes(1);
    expect(hook.result.current.reviewRequesting).toBe(false);
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

  const liveOrder = (oid: number, overrides = {}) => ({
    coin: 'BTC',
    oid,
    side: 'A',
    reduceOnly: true,
    isTrigger: true,
    orderType: 'Take Profit Market',
    triggerPx: '110',
    sz: '0.5',
    origSz: '0.5',
    timestamp: 1,
    ...overrides,
  });

  it('batches only the clicked active partial orders and rechecks after approval', async () => {
    const state = mockGetState();
    const child = liveOrder(14);
    state.openOrders = [
      liveOrder(7),
      liveOrder(8),
      liveOrder(9, { isPositionTpsl: true }),
      liveOrder(10, { coin: 'xyz:BTC' }),
      liveOrder(11, { side: 'B' }),
      liveOrder(12, { isTrigger: false }),
      liveOrder(13, { reduceOnly: false }),
      child,
      liveOrder(15, { isTrigger: false, children: [child] }),
    ];
    let approve!: () => void;
    mockEnsureApproval.mockReturnValueOnce(
      new Promise<void>(resolve => {
        approve = resolve;
      }),
    );
    mockExecuteCancel.mockResolvedValue({
      kind: 'success',
      items: [{ coin: 'BTC', oid: 7, status: 'success' }],
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'partial'));
    const clicked = state.openOrders.map((item: { oid: number }) => ({
      ...order,
      oid: item.oid,
    }));
    let request!: Promise<void>;
    act(() => {
      request = hook.result.current.cancelAllOrders(clicked);
    });
    expect(hook.result.current.cancelAllOids).toEqual([7, 8]);
    await act(async () => {
      await hook.result.current.cancelAllOrders(clicked);
    });
    expect(mockEnsureApproval).toHaveBeenCalledTimes(1);
    // One target disappeared and a new order arrived while approval was open.
    state.openOrders = [liveOrder(7), liveOrder(16)];
    await act(async () => {
      approve();
      await request;
    });
    expect(mockExecuteCancel).toHaveBeenCalledTimes(1);
    expect(mockExecuteCancel.mock.lastCall?.[0].orders).toEqual([
      { coin: 'BTC', oid: 7 },
    ]);
    expect(hook.result.current.confirmedCancelledOids).toEqual([7]);
    expect(hook.result.current.cancelAllOids).toBeNull();
    expect(hook.result.current.pending).toBe(false);
  });

  it('removes acknowledged successes immediately and retries only remaining failures', async () => {
    mockGetState().openOrders = [liveOrder(7), liveOrder(8)];
    mockExecuteCancel
      .mockResolvedValueOnce({
        kind: 'partial',
        items: [
          { coin: 'BTC', oid: 7, status: 'success' },
          { coin: 'BTC', oid: 8, status: 'failed', error: 'retry' },
        ],
      })
      .mockResolvedValueOnce({
        kind: 'success',
        items: [{ coin: 'BTC', oid: 8, status: 'success' }],
      });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    const clicked = [order, { ...order, oid: 8 }];
    act(() => hook.result.current.open(position, 'partial'));
    await act(async () => {
      await hook.result.current.cancelAllOrders(clicked);
    });
    expect(hook.result.current.confirmedCancelledOids).toEqual([7]);
    expect(mockShowToast).toHaveBeenLastCalledWith(
      'page.perps.pro.openOrders.cancelPartial',
      'error',
    );
    await act(async () => {
      await hook.result.current.cancelAllOrders(clicked);
    });
    expect(mockExecuteCancel.mock.lastCall?.[0].orders).toEqual([
      { coin: 'BTC', oid: 8 },
    ]);
    expect(hook.result.current.confirmedCancelledOids).toEqual([7, 8]);
  });

  it.each(['approval', 'request'] as const)(
    'isolates an old account cancellation settling during %s',
    async phase => {
      mockGetState().openOrders = [liveOrder(7)];
      let finish!: (result?: unknown) => void;
      const deferred = new Promise(resolve => {
        finish = resolve;
      });
      if (phase === 'approval')
        mockEnsureApproval.mockReturnValueOnce(deferred);
      else mockExecuteCancel.mockReturnValueOnce(deferred);
      const hook = renderHook(
        ({ identity }) => usePerpsProPositionTpSl(identity, 'base'),
        {
          initialProps: { identity: 'account-a' },
        },
      );
      act(() => hook.result.current.open(position, 'partial'));
      let request!: Promise<void>;
      await act(async () => {
        request = hook.result.current.cancelAllOrders([order]);
      });
      hook.rerender({ identity: 'account-b' });
      mockGetState().currentPerpsAccount = {
        ...account,
        address: '0x2222222222222222222222222222222222222222',
      };
      act(() => hook.result.current.open(position, 'partial'));
      let finishNew!: () => void;
      mockEnsureApproval.mockReturnValueOnce(
        new Promise<void>(resolve => {
          finishNew = resolve;
        }),
      );
      let nextRequest!: Promise<void>;
      act(() => {
        nextRequest = hook.result.current.cancelAllOrders([order]);
      });
      await act(async () => {
        finish({
          kind: 'success',
          items: [{ coin: 'BTC', oid: 7, status: 'success' }],
        });
        await request;
      });
      expect(hook.result.current.pending).toBe(true);
      expect(hook.result.current.cancelAllOids).toEqual([7]);
      expect(hook.result.current.confirmedCancelledOids).toEqual([]);
      expect(mockShowToast).not.toHaveBeenCalled();
      if (phase === 'approval')
        expect(mockExecuteCancel).not.toHaveBeenCalled();
      // Finish without a second request: its target has since disappeared.
      mockGetState().openOrders = [];
      await act(async () => {
        finishNew();
        await nextRequest;
      });
      expect(hook.result.current.pending).toBe(false);
    },
  );

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
  it.each([
    {
      name: 'cancel failure',
      cancel: 'failed',
      create: 'skipped',
      kind: 'failed',
      mutated: false,
      userCancelled: false,
    },
    {
      name: 'create failure after cancel',
      cancel: 'success',
      create: 'failed',
      kind: 'partial',
      mutated: true,
      userCancelled: false,
    },
    {
      name: 'user cancellation before mutation',
      cancel: 'failed',
      create: 'skipped',
      kind: 'failed',
      mutated: false,
      userCancelled: true,
    },
    {
      name: 'user cancellation after mutation',
      cancel: 'success',
      create: 'failed',
      kind: 'partial',
      mutated: true,
      userCancelled: true,
    },
  ])('preserves Full Modify settlement for $name', async result => {
    const command = {
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: [
        { kind: 'takeProfit', replaceOid: 7, size: null, triggerPrice: '115' },
      ],
      markPrice: '100',
      scope: 'position',
      type: 'positionTpSl',
    };
    mockBuildPositionTpSl.mockReturnValue(command);
    mockExecutePositionTpSl.mockResolvedValue({
      kind: result.kind,
      failureReason: result.userCancelled ? 'userCancelled' : 'requestFailed',
      legs: [
        {
          kind: 'takeProfit',
          cancel: result.cancel,
          create: result.create,
          replacedOid: 7,
        },
      ],
    });
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'position'));
    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: 7,
            size: null,
            triggerPrice: '115',
          },
        ],
        mode: 'position',
        scope: 'position',
      });
    });
    await act(async () => {
      await hook.result.current.confirm();
    });
    expect(hook.result.current.editor === null).toBe(result.mutated);
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.settlement).toBeNull();
    if (result.mutated)
      expect(mockShowToast).toHaveBeenCalledWith(
        'page.perps.pro.positionTpsl.replaceFailedAfterCancel',
        'error',
      );
    if (result.userCancelled && !result.mutated) {
      expect(hook.result.current.review).not.toBeNull();
      expect(mockShowToast).not.toHaveBeenCalled();
    }
  });

  it('submits a Full Modify confirmation once while its executor is pending', async () => {
    mockBuildPositionTpSl.mockReturnValue({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: [{ kind: 'takeProfit', replaceOid: 7, triggerPrice: '115' }],
      markPrice: '100',
      scope: 'position',
      type: 'positionTpSl',
    });
    let finish: (result: unknown) => void = () => {};
    mockExecutePositionTpSl.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const hook = renderHook(() => usePerpsProPositionTpSl('account-a', 'base'));
    act(() => hook.result.current.open(position, 'position'));
    await act(async () => {
      await hook.result.current.requestReview({
        legs: [
          {
            kind: 'takeProfit',
            replaceOid: 7,
            size: null,
            triggerPrice: '115',
          },
        ],
        mode: 'position',
        scope: 'position',
      });
    });
    let first: Promise<void>;
    await act(async () => {
      first = hook.result.current.confirm();
      await hook.result.current.confirm();
    });
    expect(mockExecutePositionTpSl).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({
        kind: 'success',
        legs: [
          {
            kind: 'takeProfit',
            cancel: 'success',
            create: 'success',
            replacedOid: 7,
            oid: 100,
          },
        ],
      });
      await first!;
    });
    expect(hook.result.current.editor).toBeNull();
  });
});
