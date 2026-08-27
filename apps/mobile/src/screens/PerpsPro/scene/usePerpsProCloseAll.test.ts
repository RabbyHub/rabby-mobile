import { act, renderHook } from '@testing-library/react-native';

const mockBuildCommand = jest.fn();
const mockExecute = jest.fn();
const mockEnsureApproval = jest.fn();
const mockGetState = jest.fn();
const mockReportCloseAllHistory = jest.fn();

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
jest.mock('@/hooks/perps/showToast', () => ({ showToast: jest.fn() }));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: () => mockGetState() },
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

  it('keeps the confirmation mounted and pending until execution and refresh settle', async () => {
    let resolveExecution: ((value: unknown) => void) | null = null;
    mockExecute.mockReturnValue(
      new Promise(resolve => {
        resolveExecution = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProCloseAll('account-a'));

    act(() => hook.result.current.requestCloseAll());
    const confirmation = hook.result.current.confirmation;
    expect(confirmation).not.toBeNull();

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
});
