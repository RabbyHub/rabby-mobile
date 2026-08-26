import { act, renderHook } from '@testing-library/react-native';

const mockGetState = jest.fn();
const mockGetOrderStatus = jest.fn();
const mockBuildModify = jest.fn();
const mockExecuteModify = jest.fn();
const mockEnsureApproval = jest.fn();
const mockGetSkip = jest.fn();
const mockSetSkip = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: {
        getOrderStatus: (...args: unknown[]) => mockGetOrderStatus(...args),
      },
    }),
  },
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProOpenOrderEditConfirmation: (...args: unknown[]) =>
      mockGetSkip(...args),
    setSkipPerpsProOpenOrderEditConfirmation: (...args: unknown[]) =>
      mockSetSkip(...args),
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
jest.mock('@/hooks/perps/actions/modifyOpenOrder', () => ({
  buildPerpsModifyOpenOrderCommand: (...args: unknown[]) =>
    mockBuildModify(...args),
  executePerpsModifyOpenOrder: (...args: unknown[]) =>
    mockExecuteModify(...args),
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
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
    marketKey: 'hyperliquid::BTC',
    sourceTag: null,
  }),
}));

import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import type { PerpsPositionViewModel } from '../model/position';
import { usePerpsProOpenOrderEdit } from './usePerpsProOpenOrderEdit';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};

const basicOrder = {
  amountBase: '1',
  amountQuote: '100',
  category: 'basic',
  cloid: null,
  coin: 'BTC',
  displayAmountQuote: '100',
  editKind: 'limit',
  executionPrice: '100',
  executionPriceKind: 'limit',
  filledQuote: '50',
  filledRatio: '0.5',
  filledSize: '0.5',
  hasChildren: false,
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: false,
  limitPrice: '100',
  key: 'basic:BTC:1',
  oid: 1,
  orderType: 'Limit',
  reduceOnly: false,
  remainingSize: '0.5',
  side: 'buy',
  tif: 'Gtc',
  timestamp: 1,
  triggerCondition: null,
  triggerKind: null,
  triggerPrice: null,
} satisfies PerpsOpenOrderViewModel;

const conditionalOrder = {
  ...basicOrder,
  category: 'conditional',
  displayAmountQuote: '50',
  editKind: 'triggerMarket',
  executionPrice: null,
  executionPriceKind: 'market',
  isTrigger: true,
  limitPrice: '101.2',
  key: 'conditional:BTC:2',
  oid: 2,
  orderType: 'Take Profit Market',
  reduceOnly: true,
  side: 'sell',
  triggerCondition: 'Above',
  triggerKind: 'takeProfit',
  triggerPrice: '110',
} satisfies PerpsOpenOrderViewModel;

const position = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '90',
  key: 'BTC',
  tpslOrders: [],
} as PerpsPositionViewModel;

describe('usePerpsProOpenOrderEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureApproval.mockResolvedValue(undefined);
    mockGetSkip.mockResolvedValue(false);
    mockSetSkip.mockResolvedValue(undefined);
    mockExecuteModify.mockResolvedValue({ kind: 'updated' });
    mockGetOrderStatus.mockImplementation(async (oid: number) => ({
      order: {
        order: {
          ...(oid === conditionalOrder.oid ? conditionalOrder : basicOrder),
          limitPx:
            oid === conditionalOrder.oid
              ? conditionalOrder.limitPrice
              : basicOrder.limitPrice,
          side: oid === conditionalOrder.oid ? 'A' : 'B',
          sz:
            oid === conditionalOrder.oid
              ? conditionalOrder.remainingSize
              : basicOrder.remainingSize,
          origSz:
            oid === conditionalOrder.oid
              ? conditionalOrder.amountBase
              : basicOrder.amountBase,
          triggerPx:
            oid === conditionalOrder.oid ? conditionalOrder.triggerPrice : '0',
          children: [],
        },
        status: 'open',
        statusTimestamp: 1,
      },
      status: 'order',
    }));
    mockBuildModify.mockImplementation((input: any) => ({
      account,
      coin: 'BTC',
      dexId: '',
      expected: {
        kind: input.editKind,
        limitPrice: '100',
        reduceOnly: false,
        remainingSize: '0.5',
        side: 'buy',
        tif: 'Gtc',
      },
      marketKey: 'hyperliquid::BTC',
      oid: 1,
      replacement: {
        baseSize: input.baseSize,
        limitPrice: input.limitPrice || '110.4',
        orderType:
          input.editKind === 'limit'
            ? { limit: { tif: input.tif } }
            : {
                trigger: {
                  isMarket: input.editKind === 'triggerMarket',
                  tpsl: 'tp',
                  triggerPx: input.triggerPrice,
                },
              },
        triggerPrice: input.triggerPrice || null,
      },
      type: 'modifyOpenOrder',
    }));
    mockGetState.mockReturnValue({
      currentClearinghouseState: {
        assetPositions: [{ position: { coin: 'BTC', szi: '1' } }],
      },
      currentPerpsAccount: account,
      marketDataMap: {
        BTC: {
          dexId: '',
          displayName: 'BTC',
          markPx: '100',
          name: 'BTC',
          pxDecimals: 2,
          quoteAsset: 'USDC',
          szDecimals: 3,
        },
      },
    });
  });

  it('uses the unfinished sz when only a Basic price is edited', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'quote'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '60',
        amountTouched: false,
        price: '120',
      });
    });

    expect(mockBuildModify).toHaveBeenCalledWith(
      expect.objectContaining({
        baseSize: '0.5',
        expectedRemainingSize: '0.5',
        limitPrice: '120',
      }),
    );
    expect(hook.result.current.review?.category).toBe('basic');
  });

  it('persists the category checkbox only after final confirmation', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.4',
        amountTouched: true,
        price: '100',
      });
    });
    expect(mockSetSkip).not.toHaveBeenCalled();
    act(() => hook.result.current.toggleSkipConfirmation());
    await act(async () => hook.result.current.confirm());

    expect(mockSetSkip).toHaveBeenCalledWith('basic', true);
    expect(mockExecuteModify).toHaveBeenCalledTimes(1);
  });

  it('finishes a Basic edit after one accepted confirmation', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.5',
        amountTouched: false,
        price: '120',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockExecuteModify).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editSubmitted',
      'success',
    );
    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.review).toBeNull();
  });

  it('surfaces the same explicit server rejection used by normal orders', async () => {
    mockExecuteModify.mockResolvedValue({
      error: 'Order must have minimum value of $10.',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.5',
        amountTouched: false,
        price: '120',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Order must have minimum value of $10.',
      'error',
    );
    expect(hook.result.current.editor).not.toBeNull();
    expect(hook.result.current.review).toBeNull();
  });

  it('passes a small valid Amount to the command so the backend remains authoritative', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.01',
        amountTouched: true,
        price: '120',
      });
    });

    expect(mockBuildModify).toHaveBeenCalledWith(
      expect.objectContaining({ baseSize: '0.01' }),
    );
    expect(hook.result.current.review?.category).toBe('basic');
  });

  it('freezes a Trigger Market replacement without a Position gate', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(conditionalOrder, null));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        limitPrice: null,
        triggerPrice: '112',
      });
    });

    expect(mockBuildModify).toHaveBeenCalledWith(
      expect.objectContaining({
        baseSize: '0.4',
        editKind: 'triggerMarket',
        expectedOrderType: 'Take Profit Market',
        expectedTriggerPrice: '110',
        triggerKind: 'takeProfit',
        triggerPrice: '112',
      }),
    );
    expect(hook.result.current.editor).toMatchObject({
      category: 'conditional',
      position: null,
    });
  });

  it('bypasses only the matching category review preference', async () => {
    mockGetSkip.mockResolvedValue(true);
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(conditionalOrder, position));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        limitPrice: null,
        triggerPrice: '112',
      });
    });

    expect(mockGetSkip).toHaveBeenCalledWith('conditional');
    expect(mockExecuteModify).toHaveBeenCalledTimes(1);
    expect(hook.result.current.review).toBeNull();
  });

  it('hides a candidate after orderStatus exposes attached children', async () => {
    mockGetOrderStatus.mockResolvedValueOnce({
      order: {
        order: {
          coin: 'BTC',
          isPositionTpsl: false,
          isTrigger: false,
          limitPx: '100',
          oid: 1,
          orderType: 'Limit',
          origSz: '1',
          reduceOnly: false,
          side: 'B',
          sz: '0.5',
          tif: 'Gtc',
          timestamp: 1,
          triggerCondition: '',
          triggerPx: '0',
          children: [{ oid: 2 }],
        },
        status: 'open',
        statusTimestamp: 1,
      },
      status: 'order',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editUnavailable',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.isEditUnavailable(basicOrder)).toBe(true);
  });

  it('opens with the authoritative orderStatus values when the Store snapshot is behind', async () => {
    mockGetOrderStatus.mockResolvedValueOnce({
      order: {
        order: {
          ...basicOrder,
          children: [],
          limitPx: '105',
          origSz: '1',
          side: 'B',
          sz: '0.4',
          triggerPx: '0',
        },
        status: 'open',
        statusTimestamp: 2,
      },
      status: 'order',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));

    expect(hook.result.current.editor?.order).toMatchObject({
      limitPrice: '105',
      remainingSize: '0.4',
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it.each([
    ['unknownOid', () => Promise.resolve({ status: 'unknownOid' })],
    [
      'transport failure',
      () => Promise.reject(new Error('failed to fetch order status')),
    ],
  ])('keeps editing available after %s preflight', async (_name, response) => {
    mockGetOrderStatus.mockImplementationOnce(response);
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));

    expect(hook.result.current.editor?.order).toMatchObject({ oid: 1 });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('hides an order that orderStatus says is no longer open', async () => {
    mockGetOrderStatus.mockResolvedValueOnce({
      order: {
        order: basicOrder,
        status: 'canceled',
        statusTimestamp: 2,
      },
      status: 'order',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editOrderClosed',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.isEditUnavailable(basicOrder)).toBe(true);
  });

  it('rebases the editor and requires confirmation again when preflight finds a changed order', async () => {
    const latestOrder = {
      ...basicOrder,
      children: [],
      limitPx: '101',
      origSz: '1',
      side: 'B',
      sz: '0.4',
      triggerPx: '0',
    };
    mockExecuteModify.mockResolvedValueOnce({
      kind: 'staleContext',
      latestOrder,
      staleReason: 'orderChanged',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.5',
        amountTouched: false,
        price: '120',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editOrderChanged',
      'error',
    );
    expect(hook.result.current.review).toBeNull();
    expect(hook.result.current.editor?.order).toMatchObject({
      limitPrice: '101',
      remainingSize: '0.4',
    });
    expect(hook.result.current.isEditUnavailable(basicOrder)).toBe(false);
  });

  it('closes the editor when final preflight finds the order closed', async () => {
    mockExecuteModify.mockResolvedValueOnce({
      kind: 'staleContext',
      staleReason: 'orderClosed',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(basicOrder));
    await act(async () => {
      await hook.result.current.requestBasicReview({
        amount: '0.5',
        amountTouched: false,
        price: '120',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editOrderClosed',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.review).toBeNull();
  });

  it('shows one explicit backend Conditional error without canceling the order', async () => {
    mockExecuteModify.mockResolvedValue({
      failureReason: 'requestFailed',
      kind: 'failed',
      error: 'Invalid TP/SL price.',
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    await act(async () => hook.result.current.open(conditionalOrder, position));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        limitPrice: null,
        triggerPrice: '112',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('Invalid TP/SL price.', 'error');
  });
});
