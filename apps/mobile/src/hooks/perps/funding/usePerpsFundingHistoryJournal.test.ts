import { act, renderHook, waitFor } from '@testing-library/react-native';

import { PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS } from './fundingHistoryReconciliation';

const mockReadJournal = jest.fn();
const mockUpdateStatus = jest.fn(async () => undefined);
const mockAddListener = jest.fn();
const mockRemoveListener = jest.fn();
const mockGetTransactionHistory = jest.fn();
const mockFetchLedger = jest.fn(async () => true);
const mockReconcileObservation = jest.fn(
  ({ localHistory }: { localHistory?: unknown[] }) => {
    if (localHistory) {
      mockState.localLoadingHistory = [...localHistory];
    }
    return [];
  },
);

const mockState: any = {
  currentPerpsAccount: {
    address: '0xabc',
    type: 'PrivateKey',
  },
  hiddenLocalFundingHistory: [],
  localLoadingHistory: [],
  userAccountHistory: [],
};

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  fetchUserNonFundingLedgerUpdates: (...args: unknown[]) =>
    mockFetchLedger(...args),
  perpsStore: Object.assign(
    (selector: (state: typeof mockState) => unknown) => selector(mockState),
    {
      getState: () => mockState,
      setState: (updater: (state: typeof mockState) => typeof mockState) => {
        Object.assign(mockState, updater(mockState));
      },
    },
  ),
  reconcilePerpsFundingHistoryObservation: (...args: unknown[]) =>
    mockReconcileObservation(...args),
}));

jest.mock('@/core/serviceApi/transactionHistoryHooks', () => ({
  useTransactionHistoryServiceReady: () => true,
}));

jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistoryListSnapshot: (...args: unknown[]) =>
    mockGetTransactionHistory(...args),
}));

jest.mock('@/utils/events', () => ({
  EVENTS: { RELOAD_TX: 'RELOAD_TX' },
  eventBus: {
    addListener: (...args: unknown[]) => mockAddListener(...args),
    removeListener: (...args: unknown[]) => mockRemoveListener(...args),
  },
}));

jest.mock('./fundingJournal', () => ({
  getPerpsPendingFundingCount: (items: { status: string; type: string }[]) =>
    items.filter(
      item =>
        item.status === 'pending' &&
        (item.type === 'deposit' ||
          item.type === 'receive' ||
          item.type === 'withdraw'),
    ).length,
  isPerpsFundingJournalEntryForAccount: () => true,
  readPerpsFundingJournal: (...args: unknown[]) => mockReadJournal(...args),
  updatePerpsFundingJournalStatus: (...args: unknown[]) =>
    mockUpdateStatus(...args),
}));

import { usePerpsFundingHistoryJournal } from './usePerpsFundingHistoryJournal';

const entry = {
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  amount: '12',
  asset: 'USDT',
  createdAt: 1,
  direction: 'deposit' as const,
  localType: 'receive' as const,
  operationId: 'operation-1',
  settlementAmount: '11.9',
  sourceIdentity: {
    hash: '0xhash',
    kind: 'evmTransactionHash' as const,
  },
  status: 'pending' as const,
  updatedAt: 1,
  version: 2 as const,
};

describe('usePerpsFundingHistoryJournal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.hiddenLocalFundingHistory = [];
    mockState.localLoadingHistory = [];
    mockState.userAccountHistory = [];
    mockReadJournal.mockResolvedValue([entry]);
    mockFetchLedger.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hydrates the current account and marks only receipt failures as failed', async () => {
    mockGetTransactionHistory.mockReturnValue({
      completeds: [
        {
          isFailed: true,
          txs: [{ hash: '0xhash' }],
        },
      ],
      pendings: [],
    });

    renderHook(() => usePerpsFundingHistoryJournal());

    await waitFor(() =>
      expect(mockState.localLoadingHistory[0]).toMatchObject({
        asset: 'USDT',
        status: 'failed',
      }),
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith('operation-1', 'failed');
    expect(mockAddListener).toHaveBeenCalledWith(
      'RELOAD_TX',
      expect.any(Function),
    );
  });

  it('keeps a successful source transaction pending until ledger convergence', async () => {
    mockGetTransactionHistory.mockReturnValue({
      completeds: [
        {
          isFailed: false,
          txs: [{ hash: '0xhash' }],
        },
      ],
      pendings: [],
    });

    renderHook(() => usePerpsFundingHistoryJournal());

    await waitFor(() =>
      expect(mockState.localLoadingHistory[0]?.status).toBe('pending'),
    );
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockFetchLedger).toHaveBeenCalledTimes(1);
  });

  it.each(['isSubmitFailed', 'isWithdrawed'] as const)(
    'treats transaction-history %s as a failed source operation',
    async failureField => {
      mockGetTransactionHistory.mockReturnValue({
        completeds: [
          {
            isFailed: false,
            [failureField]: true,
            txs: [{ hash: '0xhash' }],
          },
        ],
        pendings: [],
      });

      renderHook(() => usePerpsFundingHistoryJournal());

      await waitFor(() =>
        expect(mockState.localLoadingHistory[0]?.status).toBe('failed'),
      );
      expect(mockUpdateStatus).toHaveBeenCalledWith('operation-1', 'failed');
    },
  );

  it('does not poll official ledger history while the Pro scene is inactive', async () => {
    mockState.localLoadingHistory = [
      {
        hash: '0xhash',
        operationId: 'operation-1',
        status: 'pending',
        time: 1,
        type: 'receive',
        usdValue: '11.9',
      },
    ];
    mockReadJournal.mockResolvedValue([]);
    mockGetTransactionHistory.mockReturnValue({
      completeds: [],
      pendings: [],
    });

    renderHook(() => usePerpsFundingHistoryJournal({ enabled: false }));

    await waitFor(() => expect(mockReadJournal).toHaveBeenCalled());
    expect(mockFetchLedger).not.toHaveBeenCalled();
  });

  it('defers inactive expiry work and hides immediately when the scene becomes active', async () => {
    jest.useFakeTimers();
    const now = 1787895600005;
    jest.setSystemTime(now);
    mockState.localLoadingHistory = [
      {
        hash: `hl-nonce:${now}`,
        operationId: 'withdraw-operation',
        settlementNonce: now,
        status: 'pending',
        time: now,
        type: 'withdraw',
        usdValue: '4',
      },
    ];
    mockReadJournal.mockResolvedValue([]);
    mockGetTransactionHistory.mockReturnValue({
      completeds: [],
      pendings: [],
    });

    const hook = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePerpsFundingHistoryJournal({ enabled }),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockReconcileObservation.mockClear();

    act(() => {
      jest.advanceTimersByTime(PERPS_FUNDING_PENDING_VISIBILITY_TTL_MS);
    });
    expect(mockReconcileObservation).not.toHaveBeenCalled();
    expect(mockFetchLedger).not.toHaveBeenCalled();

    hook.rerender({ enabled: true });
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(mockReconcileObservation).toHaveBeenCalledWith({
      confirmedHistory: [],
      observation: 'baseline',
    });
  });
});
