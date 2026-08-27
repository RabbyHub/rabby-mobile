import { act, renderHook } from '@testing-library/react-native';

const mockGetState = jest.fn();
const mockShowToast = jest.fn();
const mockGetSkipLimitConfirmation = jest.fn(async () => false);
const mockGetSkipMarketConfirmation = jest.fn(async () => false);
const mockSetSkipLimitConfirmation = jest.fn(async () => undefined);
const mockSetSkipMarketConfirmation = jest.fn(async () => undefined);
const mockConfirmedClose = {
  acceptance: 'filled' as const,
  oid: 1,
  price: '100',
  size: '0.1',
};
const mockExecuteClose = jest.fn(async () => ({
  confirmed: mockConfirmedClose,
  kind: 'filled' as const,
}));
const mockReportClosePositionHistory = jest.fn();

jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProLimitCloseConfirmation: () => mockGetSkipLimitConfirmation(),
    getSkipPerpsProMarketCloseConfirmation: () =>
      mockGetSkipMarketConfirmation(),
    setSkipPerpsProLimitCloseConfirmation: (value: boolean) =>
      mockSetSkipLimitConfirmation(value),
    setSkipPerpsProMarketCloseConfirmation: (value: boolean) =>
      mockSetSkipMarketConfirmation(value),
  },
}));
jest.mock('@/hooks/perps/actions/closePosition', () => {
  const actual = jest.requireActual('@/hooks/perps/actions/closePosition');
  return {
    ...actual,
    executePerpsClosePosition: (...args: unknown[]) =>
      mockExecuteClose(...args),
  };
});
jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));
jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: jest.fn(),
}));
jest.mock('@/hooks/perps/perpsActionError', () => ({
  judgeIsBuilderFeeNeedApprove: () => false,
  judgeIsUserAgentIsExpired: async () => false,
}));
jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchClearinghouseStateHttp: jest.fn(),
  fetchPositionOpenOrdersHttp: jest.fn(),
  getDexByCoin: jest.fn(() => ''),
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
jest.mock('../analytics/manualTradeHistory', () => ({
  reportPerpsProClosePositionHistory: (...args: unknown[]) =>
    mockReportClosePositionHistory(...args),
}));

import type { PerpsPositionViewModel } from '../model/position';
import type { PerpsProCloseDraft } from '../model/positionAction';
import { usePerpsProPositionActions } from './usePerpsProPositionActions';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};
const position = {
  baseSize: '0.1',
  coin: 'BTC',
  direction: 'long',
  key: 'BTC',
  leverage: 5,
  marginMode: 'cross',
} as PerpsPositionViewModel;
const draft = (size: string): PerpsProCloseDraft => ({
  inputSource: 'slider',
  limitPrice: null,
  midPrice: '100',
  orderType: 'market',
  percent: 50,
  referencePrice: '100',
  size,
});

describe('usePerpsProPositionActions close validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkipLimitConfirmation.mockResolvedValue(false);
    mockGetSkipMarketConfirmation.mockResolvedValue(false);
    mockExecuteClose.mockResolvedValue({
      confirmed: mockConfirmedClose,
      kind: 'filled',
    });
    mockGetState.mockReturnValue({
      currentPerpsAccount: account,
      marketDataMap: {
        BTC: {
          markPx: '100',
          midPx: '100',
          pxDecimals: 2,
          quoteAsset: 'USDC',
          szDecimals: 4,
        },
      },
    });
  });

  it('stops a partial close below $10 before opening review', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.05')));

    expect(hook.result.current.closeReview).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.positions.minimumCloseAmount',
      'error',
    );
  });

  it('keeps the below-$10 exception for a full close', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.1')));

    expect(hook.result.current.closeReview).toMatchObject({ size: '0.1' });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('bypasses a Market review when its independent preference is enabled', async () => {
    mockGetSkipMarketConfirmation.mockResolvedValue(true);
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      hook.result.current.reviewClose(draft('0.1'));
      await Promise.resolve();
    });

    expect(hook.result.current.closeReview).toBeNull();
    expect(mockExecuteClose).toHaveBeenCalledTimes(1);
    expect(mockGetSkipLimitConfirmation).toHaveBeenCalledTimes(1);
    expect(mockGetSkipMarketConfirmation).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing Limit review bypass independent from Market', async () => {
    mockGetSkipLimitConfirmation.mockResolvedValue(true);
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      hook.result.current.reviewClose({
        ...draft('0.1'),
        limitPrice: '100',
        orderType: 'limit',
      });
      await Promise.resolve();
    });

    expect(hook.result.current.closeReview).toBeNull();
    expect(mockExecuteClose).toHaveBeenCalledTimes(1);
    expect(mockSetSkipMarketConfirmation).not.toHaveBeenCalled();
  });

  it('persists Market opt-out only after a checked confirmation', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.1')));
    expect(hook.result.current.closeReview?.orderType).toBe('market');
    act(() => hook.result.current.toggleSkipCloseConfirmation());
    expect(hook.result.current.skipCloseConfirmation).toBe(true);

    await act(async () => {
      hook.result.current.confirmClose();
      await Promise.resolve();
    });

    expect(mockSetSkipMarketConfirmation).toHaveBeenCalledWith(true);
    expect(mockSetSkipLimitConfirmation).not.toHaveBeenCalled();
    expect(mockExecuteClose).toHaveBeenCalledTimes(1);
    expect(mockReportClosePositionHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: 'market',
        reportingFacts: { leverage: 5, marginMode: 'cross' },
      }),
      mockConfirmedClose,
    );
  });

  it('does not persist a checked Market preference when review is cancelled', async () => {
    const hook = renderHook(() =>
      usePerpsProPositionActions({
        accountIdentity: 'account-a',
        leveragePending: false,
        updateLeverageRequest: jest.fn(),
      }),
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.1')));
    act(() => hook.result.current.toggleSkipCloseConfirmation());
    act(() => hook.result.current.cancelCloseReview());

    expect(hook.result.current.closeReview).toBeNull();
    expect(mockSetSkipMarketConfirmation).not.toHaveBeenCalled();
    expect(mockExecuteClose).not.toHaveBeenCalled();
  });

  it('resets close preference presentation when the account identity changes', async () => {
    const hook = renderHook(
      ({ accountIdentity }) =>
        usePerpsProPositionActions({
          accountIdentity,
          leveragePending: false,
          updateLeverageRequest: jest.fn(),
        }),
      { initialProps: { accountIdentity: 'account-a' } },
    );

    await act(async () => {
      hook.result.current.openCloseEditor(position);
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => hook.result.current.reviewClose(draft('0.1')));
    act(() => hook.result.current.toggleSkipCloseConfirmation());
    expect(hook.result.current.skipCloseConfirmation).toBe(true);

    hook.rerender({ accountIdentity: 'account-b' });

    expect(hook.result.current.closeEditor).toBeNull();
    expect(hook.result.current.closeReview).toBeNull();
    expect(hook.result.current.skipCloseConfirmation).toBe(false);
  });
});
