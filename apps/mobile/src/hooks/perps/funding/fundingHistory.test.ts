import type { Account } from '@/core/startupServices/preference';

import {
  createPerpsFundingOperation,
  mapPerpsFundingJournalEntryToHistory,
} from './fundingHistory';
import { getPerpsPendingFundingCount } from './fundingJournal';

const account = {
  address: '0xAbC',
  type: 'PrivateKey',
} as Account;

describe('Perps funding history metadata', () => {
  it('preserves the source asset and separate display/settlement amounts', () => {
    const operation = createPerpsFundingOperation({
      account,
      fundingRoute: 'provider',
      history: {
        amount: '25',
        asset: 'USDT',
        settlementAmount: '24.9',
        sourceChainId: 'eth',
        sourceTokenId: '0xtoken',
      },
      identity: { sourceHash: '0xSource' },
      localType: 'receive',
      time: 100,
    });

    expect(operation).not.toBeNull();
    expect(operation?.historyItem).toMatchObject({
      amount: '25',
      asset: 'USDT',
      assetAmountSource: 'local',
      fundingRoute: 'provider',
      settlementAmount: '24.9',
      status: 'pending',
      type: 'receive',
      usdValue: '24.9',
    });
    expect(operation?.journalEntry).toMatchObject({
      accountAddress: '0xabc',
      amount: '25',
      asset: 'USDT',
      direction: 'deposit',
      fundingRoute: 'provider',
      sourceIdentity: {
        hash: '0xSource',
        kind: 'evmTransactionHash',
      },
    });
  });

  it('restores a confirmed provider operation by its persisted ledger hash', () => {
    const operation = createPerpsFundingOperation({
      account,
      fundingRoute: 'provider',
      history: {
        amount: '25',
        asset: 'USDT',
        settlementAmount: '24.9',
      },
      identity: { sourceHash: '0xsource' },
      localType: 'receive',
      time: 100,
    });

    expect(
      mapPerpsFundingJournalEntryToHistory({
        ...operation!.journalEntry,
        providerSettlementIdentity: {
          hash: '0xledger',
          kind: 'hyperliquidLedgerHash',
        },
        status: 'confirmed',
      }),
    ).toMatchObject({
      asset: 'USDT',
      hash: '0xledger',
      sourceHash: '0xsource',
      status: 'success',
    });
  });

  it('requires a deterministic identity and restores failed journal entries', () => {
    expect(
      createPerpsFundingOperation({
        account,
        history: {
          amount: '1',
          asset: 'USDC',
          settlementAmount: '1',
        },
        identity: {},
        localType: 'deposit',
        time: 100,
      }),
    ).toBeNull();

    const operation = createPerpsFundingOperation({
      account,
      history: {
        amount: '1',
        asset: 'USDC',
        settlementAmount: '1',
      },
      identity: { sourceHash: '0xhash' },
      localType: 'deposit',
      time: 100,
    });
    expect(
      mapPerpsFundingJournalEntryToHistory({
        ...operation!.journalEntry,
        status: 'failed',
      }),
    ).toMatchObject({ status: 'failed', type: 'deposit' });
  });

  it('creates a standard withdraw operation from the Hyperliquid nonce', () => {
    const operation = createPerpsFundingOperation({
      account,
      history: {
        amount: '11',
        asset: 'USDC',
        settlementAmount: '11',
      },
      identity: { settlementNonce: 123 },
      localType: 'withdraw',
      time: 100,
    });

    expect(operation).not.toBeNull();
    expect(operation?.historyItem).toMatchObject({
      hash: 'hl-nonce:123',
      settlementNonce: 123,
      type: 'withdraw',
    });
    expect(operation?.journalEntry).toMatchObject({
      settlementIdentity: { kind: 'hyperliquidNonce', nonce: 123 },
      sourceIdentity: undefined,
      version: 2,
    });
  });

  it('counts only pending deposit, receive, and withdraw operations', () => {
    expect(
      getPerpsPendingFundingCount([
        { status: 'pending', type: 'deposit' },
        { status: 'pending', type: 'receive' },
        { status: 'pending', type: 'withdraw' },
        { status: 'failed', type: 'deposit' },
        { status: 'pending', type: 'transfer' },
      ]),
    ).toBe(3);
  });
});
