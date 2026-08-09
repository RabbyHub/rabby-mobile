import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook } from '@testing-library/react-native';

import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';

import type { PerpsProAttachedTpSlCommand } from '../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../model/market';
import { usePerpsProAttachedTpSlExecution } from './usePerpsProAttachedTpSlExecution';

const mockEnsureApproval = jest.fn(async () => undefined);
const mockIsCancelled = jest.fn((error: unknown) =>
  String(error).includes('cancelled'),
);
const mockValidate = jest.fn(() => ({ ok: true as const }));
const mockExecute = jest.fn();
const mockReconcile = jest.fn();
const mockGetJournal = jest.fn();
const mockUpsertJournal = jest.fn(async () => undefined);
const mockRemoveJournal = jest.fn(async () => undefined);
const mockRefreshOpenOrders = jest.fn(async () => undefined);
const mockRefreshClearinghouse = jest.fn(async () => undefined);

const account = { address: '0xabc', type: 'PrivateKey' };
const state = {
  currentClearinghouseState: {
    assetPositions: [],
    crossMaintenanceMarginUsed: '0',
    crossMarginSummary: { accountValue: '1000' },
  },
  currentPerpsAccount: account,
  marketDataMap: {
    BTC: {
      markPx: '100',
      maxLeverage: 50,
      pxDecimals: 2,
    },
  },
};

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getPerpsAttachedTpSlJournal: (...args: unknown[]) =>
      mockGetJournal(...args),
    removePerpsAttachedTpSlJournalEntry: (...args: unknown[]) =>
      mockRemoveJournal(...args),
    upsertPerpsAttachedTpSlJournalEntry: (...args: unknown[]) =>
      mockUpsertJournal(...args),
  },
}));

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: (error: unknown) => mockIsCancelled(error),
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(...args),
}));

jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  getPerpsRuntimeSnapshot: () => ({
    branch: 'selfSign',
    error: null,
    generation: 1,
    identity: '0xabc::PrivateKey',
    origin: 'runtime',
    phase: null,
    status: 'ready',
  }),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const store = { getState: () => state };
  return {
    fetchClearinghouseStateHttp: (...args: unknown[]) =>
      mockRefreshClearinghouse(...args),
    fetchPositionOpenOrdersHttp: (...args: unknown[]) =>
      mockRefreshOpenOrders(...args),
    getPerpsAccountRuntimeContext: () => ({
      account,
      generation: 1,
      isInitialized: true,
    }),
    perpsStore: store,
  };
});

jest.mock('@/utils/perps', () => ({ calLiquidationPrice: () => 50 }));

jest.mock('../actions/openOrderWithAttachedTpSl', () => ({
  executePerpsProAttachedTpSl: (...args: unknown[]) => mockExecute(...args),
  getPerpsProAttachedTpSlPositionIdentity: () => ({
    entryPx: '',
    marginUsed: '',
    szi: '0',
  }),
  validatePerpsProAttachedTpSlCommand: (...args: unknown[]) =>
    mockValidate(...args),
}));

jest.mock('../actions/reconcileAttachedTpSl', () => ({
  reconcilePerpsProAttachedTpSl: (...args: unknown[]) => mockReconcile(...args),
}));

const command = {
  commandId: 'command-1',
  parent: {
    account,
    baseSize: '1',
    coin: 'BTC',
    dexId: '',
    execution: { kind: 'market', midPrice: '101' },
    marketKey: 'BTC:USDC',
    side: 'buy',
  },
  reviewFacts: {
    leverage: 10,
    marginMode: 'cross',
    szDecimals: 2,
  },
} as unknown as PerpsProAttachedTpSlCommand;

const journal: PerpsAttachedTpSlJournalEntry = {
  accountAddress: account.address,
  accountType: account.type,
  cloids: {
    parent: '0x11111111111111111111111111111111',
    takeProfit: '0x22222222222222222222222222222222',
  },
  coin: 'BTC',
  commandId: 'command-1',
  createdAt: 1,
  dexId: '',
  legs: [],
  marketKey: 'BTC:USDC',
  outcome: 'unknown',
  parentFingerprint: 'parent-1',
  parentSide: 'buy',
  updatedAt: 1,
  version: 1,
};

const market = {
  canonicalCoin: 'BTC',
  marketData: { dexId: '' },
  marketKey: 'BTC:USDC',
} as PerpsProMarket;

const book: L2Book = {
  coin: 'BTC',
  levels: [[{ n: 1, px: '100', sz: '10' }], [{ n: 1, px: '101', sz: '10' }]],
  time: 1,
};

const renderExecution = () => {
  const refreshActiveAssetData = jest.fn(async () => undefined);
  const hook = renderHook(() =>
    usePerpsProAttachedTpSlExecution({
      active: false,
      activeAssetData: {
        maxTradeSzs: ['10', '10'],
      } as never,
      bboBook: book,
      bboSessionKey: 'BTC:1',
      bboStatus: 'ready',
      market,
      refreshActiveAssetData,
    }),
  );
  return { hook, refreshActiveAssetData };
};

describe('usePerpsProAttachedTpSlExecution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetJournal.mockResolvedValue([journal]);
    mockExecute.mockResolvedValue({ kind: 'fullAccepted' });
    mockReconcile.mockResolvedValue({
      errors: [],
      kind: 'fullAccepted',
      legs: [],
    });
  });

  it('sequences approval, leverage, dispatch, reconciliation and refresh', async () => {
    const order: string[] = [];
    mockEnsureApproval.mockImplementationOnce(async () => {
      order.push('approval');
    });
    const ensureLeverage = jest.fn(async () => {
      order.push('leverage');
      return 'success' as const;
    });
    mockExecute.mockImplementationOnce(async () => {
      order.push('dispatch');
      return { kind: 'fullAccepted' };
    });
    mockReconcile.mockImplementationOnce(async () => {
      order.push('reconcile');
      return { errors: [], kind: 'fullAccepted', legs: [] };
    });
    const { hook, refreshActiveAssetData } = renderExecution();

    let result: Awaited<ReturnType<typeof hook.result.current.execute>>;
    await act(async () => {
      result = await hook.result.current.execute(command, ensureLeverage);
    });

    expect(result!).toMatchObject({ kind: 'fullAccepted' });
    expect(order).toEqual(['approval', 'leverage', 'dispatch', 'reconcile']);
    expect(mockRemoveJournal).toHaveBeenCalledWith(journal.commandId);
    expect(mockRefreshOpenOrders).toHaveBeenCalledWith('');
    expect(mockRefreshClearinghouse).toHaveBeenCalledWith('');
    expect(refreshActiveAssetData).toHaveBeenCalledTimes(1);
  });

  it('stops on explicit approval cancellation without dispatching', async () => {
    mockEnsureApproval.mockRejectedValueOnce(new Error('cancelled'));
    const { hook } = renderExecution();

    let result: Awaited<ReturnType<typeof hook.result.current.execute>>;
    await act(async () => {
      result = await hook.result.current.execute(command, jest.fn());
    });

    expect(result!).toMatchObject({ kind: 'userCancelled' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('persists a partial result and never retries dispatch automatically', async () => {
    mockExecute.mockResolvedValueOnce({ kind: 'unknownOutcome' });
    mockReconcile.mockResolvedValueOnce({
      errors: ['delayed'],
      kind: 'partialOutcome',
      legs: [
        {
          cloid: journal.cloids.parent,
          kind: 'accepted',
          role: 'parent',
        },
      ],
    });
    const { hook } = renderExecution();

    let result: Awaited<ReturnType<typeof hook.result.current.execute>>;
    await act(async () => {
      result = await hook.result.current.execute(
        command,
        jest.fn(async () => 'success'),
      );
    });

    expect(result!).toMatchObject({
      kind: 'partialOutcome',
      reconciliationErrors: ['delayed'],
    });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockUpsertJournal).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'partial' }),
    );
  });
});
