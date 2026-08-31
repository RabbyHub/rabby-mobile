import type { PerpsFundingJournalEntry } from '@/core/services/perpsService';

const mockGetJournal = jest.fn();
const mockUpsertJournalEntry = jest.fn();

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getPerpsFundingJournal: (...args: unknown[]) => mockGetJournal(...args),
    upsertPerpsFundingJournalEntry: (...args: unknown[]) =>
      mockUpsertJournalEntry(...args),
  },
}));

import { confirmPerpsFundingJournalEntry } from './fundingJournal';

const entry = (
  overrides: Partial<PerpsFundingJournalEntry> = {},
): PerpsFundingJournalEntry => ({
  accountAddress: '0xabc',
  accountType: 'PrivateKey',
  amount: '25',
  asset: 'USDT',
  createdAt: 100,
  direction: 'deposit',
  fundingRoute: 'provider',
  localType: 'receive',
  operationId: 'operation-1',
  settlementAmount: '24.9',
  sourceIdentity: {
    hash: '0xsource',
    kind: 'evmTransactionHash',
  },
  status: 'pending',
  updatedAt: 100,
  version: 2,
  ...overrides,
});

describe('funding journal confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists provider identity and confirmed status in one upsert', async () => {
    mockGetJournal.mockResolvedValue([entry()]);

    await confirmPerpsFundingJournalEntry(
      {
        operationId: 'operation-1',
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
      },
      200,
    );

    expect(mockUpsertJournalEntry).toHaveBeenCalledWith(
      entry({
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
        updatedAt: 200,
      }),
    );
  });

  it('can add a missing relation to an already-confirmed entry', async () => {
    mockGetJournal.mockResolvedValue([entry({ status: 'confirmed' })]);

    await confirmPerpsFundingJournalEntry({
      operationId: 'operation-1',
      providerSettlementIdentity: {
        hash: '0xledger',
        kind: 'hyperliquidLedgerHash',
      },
    });

    expect(mockUpsertJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
      }),
    );
  });

  it('does not rewrite an identical confirmed association', async () => {
    mockGetJournal.mockResolvedValue([
      entry({
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
      }),
    ]);

    await confirmPerpsFundingJournalEntry({
      operationId: 'operation-1',
      providerSettlementIdentity: {
        hash: '0xledger',
        kind: 'hyperliquidLedgerHash',
      },
    });

    expect(mockUpsertJournalEntry).not.toHaveBeenCalled();
  });
});
