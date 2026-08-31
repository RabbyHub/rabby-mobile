import { act, renderHook } from '@testing-library/react-native';

const mockBuildCommand = jest.fn();
const mockExecute = jest.fn();
const mockEnsureApproval = jest.fn();
const mockGetState = jest.fn();
const mockReportCloseAllHistory = jest.fn();
const mockEnsureUnlock = jest.fn(async () => true);
const mockShowToast = jest.fn();

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));
jest.mock('@/hooks/perps/actions/closeAllPositions', () => ({
  buildPerpsCloseAllPositionsCommand: (...args: unknown[]) =>
    mockBuildCommand(...args),
  executePerpsCloseAllPositions: (...args: unknown[]) => mockExecute(...args),
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
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: () => mockEnsureUnlock(),
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../analytics/manualTradeHistory', () => ({
  reportPerpsProCloseAllHistory: (...args: unknown[]) =>
    mockReportCloseAllHistory(...args),
}));

import { usePerpsProCloseAll } from './usePerpsProCloseAll';

describe('usePerpsProCloseAll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildCommand.mockReturnValue({ type: 'closeAllPositions' });
    mockExecute.mockResolvedValue({ confirmedFills: [], kind: 'success' });
    mockEnsureApproval.mockResolvedValue(undefined);
    mockGetState.mockReturnValue({
      currentClearinghouseState: {
        assetPositions: [{ position: { szi: '1' } }],
      },
      currentPerpsAccount: {
        address: '0x1111111111111111111111111111111111111111',
        type: 'PrivateKeyring',
      },
      openOrders: [],
    });
  });

  it('finishes password unlock before mounting the native confirmation modal', async () => {
    let resolveUnlock: ((value: boolean) => void) | undefined;
    mockEnsureUnlock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveUnlock = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProCloseAll('account-a'));

    act(() => {
      void hook.result.current.requestCloseAll();
    });

    expect(hook.result.current.confirmation).toBeNull();
    expect(mockBuildCommand).not.toHaveBeenCalled();

    await act(async () => {
      resolveUnlock?.(true);
      await Promise.resolve();
    });

    expect(mockEnsureApproval).toHaveBeenCalledTimes(1);
    expect(hook.result.current.confirmation).not.toBeNull();
  });

  it('keeps the confirmation mounted and pending until execution and refresh settle', async () => {
    let resolveExecution: ((value: unknown) => void) | null = null;
    mockExecute.mockReturnValue(
      new Promise(resolve => {
        resolveExecution = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProCloseAll('account-a'));

    await act(async () => hook.result.current.requestCloseAll());
    const confirmation = hook.result.current.confirmation;
    expect(confirmation).not.toBeNull();
    expect(mockEnsureUnlock).toHaveBeenCalledTimes(1);
    expect(mockEnsureApproval).toHaveBeenCalledTimes(1);
    expect(mockBuildCommand).toHaveBeenCalledTimes(1);
    expect(mockBuildCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0x1111111111111111111111111111111111111111',
      }),
      expect.objectContaining({
        assetPositions: [{ position: { szi: '1' } }],
      }),
    );

    act(() => hook.result.current.confirmCloseAll());
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.confirmation).toBe(confirmation);

    act(() => hook.result.current.dismissConfirmation());
    expect(hook.result.current.confirmation).toBe(confirmation);

    await act(async () => {
      resolveExecution?.({
        confirmedFills: [
          {
            coin: 'BTC',
            oid: 1,
            price: '100',
            signedSize: '1',
            size: '1',
          },
        ],
        kind: 'success',
      });
      await Promise.resolve();
    });

    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.confirmation).toBeNull();
    expect(mockReportCloseAllHistory).toHaveBeenCalledWith(
      { type: 'closeAllPositions' },
      [
        {
          coin: 'BTC',
          oid: 1,
          price: '100',
          signedSize: '1',
          size: '1',
        },
      ],
    );
  });

  it('shows an authoritative server rejection instead of the generic close-all error', async () => {
    mockExecute.mockResolvedValueOnce({
      error: 'Order price too far from oracle',
      failureReason: 'requestFailed',
      kind: 'failed',
    });
    const hook = renderHook(() => usePerpsProCloseAll('account-a'));

    await act(async () => hook.result.current.requestCloseAll());
    await act(async () => {
      hook.result.current.confirmCloseAll();
      await Promise.resolve();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Order price too far from oracle',
      'error',
    );
  });

  it('uses the existing reconciliation guidance for an unknown transport outcome', async () => {
    mockExecute.mockResolvedValueOnce({
      error: 'Network request failed',
      kind: 'unknownOutcome',
    });
    const hook = renderHook(() => usePerpsProCloseAll('account-a'));

    await act(async () => hook.result.current.requestCloseAll());
    await act(async () => {
      hook.result.current.confirmCloseAll();
      await Promise.resolve();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.unknownOutcome',
      'error',
    );
  });
});
