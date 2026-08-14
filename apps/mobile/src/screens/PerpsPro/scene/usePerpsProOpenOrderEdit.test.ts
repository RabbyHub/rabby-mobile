import { act, renderHook } from '@testing-library/react-native';

const mockGetState = jest.fn();
const mockBuildModify = jest.fn();
const mockExecuteModify = jest.fn();
const mockBuildPositionTpSl = jest.fn();
const mockExecutePositionTpSl = jest.fn();
const mockEnsureApproval = jest.fn();
const mockGetSkip = jest.fn();
const mockSetSkip = jest.fn();
const mockShowToast = jest.fn();

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
jest.mock('@/hooks/perps/actions/positionTpSl', () => ({
  buildPerpsPositionTpSlCommand: (...args: unknown[]) =>
    mockBuildPositionTpSl(...args),
  executePerpsPositionTpSl: (...args: unknown[]) =>
    mockExecutePositionTpSl(...args),
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
  coin: 'BTC',
  displayAmountQuote: '100',
  editKind: 'basicLimit',
  executionPrice: '100',
  executionPriceKind: 'limit',
  filledQuote: '50',
  filledRatio: '0.5',
  filledSize: '0.5',
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: false,
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
  editKind: 'partialTpSlMarket',
  executionPrice: null,
  executionPriceKind: 'market',
  isTrigger: true,
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
    mockExecuteModify.mockResolvedValue({ kind: 'resting', oid: 1 });
    mockExecutePositionTpSl.mockResolvedValue({
      kind: 'success',
      legs: [{ cancel: 'success', create: 'success' }],
    });
    mockBuildModify.mockImplementation((input: any) => ({
      account,
      coin: 'BTC',
      dexId: '',
      expected: {
        limitPrice: '100',
        reduceOnly: false,
        remainingSize: '0.5',
        side: 'buy',
        tif: 'Gtc',
      },
      marketKey: 'hyperliquid::BTC',
      oid: 1,
      replacement: { baseSize: input.baseSize, limitPrice: input.limitPrice },
      type: 'modifyOpenOrder',
    }));
    mockBuildPositionTpSl.mockImplementation((input: any) => ({
      account,
      coin: 'BTC',
      direction: 'long',
      expectedPositionSize: '1',
      legs: input.legs,
      markPrice: '100',
      scope: 'partial',
      type: 'positionTpSl',
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
    act(() => hook.result.current.open(basicOrder));
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
    act(() => hook.result.current.open(basicOrder));
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

  it('freezes the approved top-level Partial TP/SL fingerprint', async () => {
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    act(() => hook.result.current.open(conditionalOrder, position));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        triggerPrice: '112',
      });
    });

    expect(mockBuildPositionTpSl).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'partial',
        legs: [
          expect.objectContaining({
            expectedOrder: {
              execution: 'market',
              remainingSize: '0.5',
              side: 'A',
              triggerPrice: '110',
            },
            replaceOid: 2,
            size: '0.4',
          }),
        ],
      }),
    );
  });

  it('bypasses only the matching category review preference', async () => {
    mockGetSkip.mockResolvedValue(true);
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    act(() => hook.result.current.open(conditionalOrder, position));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        triggerPrice: '112',
      });
    });

    expect(mockGetSkip).toHaveBeenCalledWith('conditional');
    expect(mockExecutePositionTpSl).toHaveBeenCalledTimes(1);
    expect(hook.result.current.review).toBeNull();
  });

  it('closes a stale Conditional editor after cancel succeeds but recreate fails', async () => {
    mockExecutePositionTpSl.mockResolvedValue({
      failureReason: 'requestFailed',
      kind: 'partial',
      legs: [
        {
          cancel: 'success',
          create: 'failed',
          error: 'create failed',
          kind: 'takeProfit',
        },
      ],
    });
    const hook = renderHook(() =>
      usePerpsProOpenOrderEdit('account-a', 'base'),
    );
    act(() => hook.result.current.open(conditionalOrder, position));
    await act(async () => {
      await hook.result.current.requestConditionalReview({
        baseSize: '0.4',
        triggerPrice: '112',
      });
    });
    await act(async () => hook.result.current.confirm());

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.openOrders.editReplaceFailedAfterCancel',
      'error',
    );
    expect(hook.result.current.editor).toBeNull();
    expect(hook.result.current.review).toBeNull();
  });
});
