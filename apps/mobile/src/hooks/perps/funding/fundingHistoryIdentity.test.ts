import {
  getPerpsFundingLedgerSettlementNonce,
  getPerpsFundingSettlementIdentityKeys,
  isSamePerpsFundingSettlement,
} from './fundingHistoryIdentity';

describe('Perps funding settlement identity', () => {
  it('normalizes ledger hashes and keeps direction isolated', () => {
    expect(
      isSamePerpsFundingSettlement(
        { direction: 'deposit', hash: '0xAbC' },
        { direction: 'deposit', hash: '0xabc' },
      ),
    ).toBe(true);
    expect(
      isSamePerpsFundingSettlement(
        { direction: 'deposit', hash: '0xabc' },
        { direction: 'withdraw', hash: '0xabc' },
      ),
    ).toBe(false);
  });

  it('matches withdraw3 by nonce without treating its UI key as a ledger hash', () => {
    expect(
      isSamePerpsFundingSettlement(
        {
          direction: 'withdraw',
          hash: 'hl-nonce:42',
          settlementNonce: 42,
        },
        {
          direction: 'withdraw',
          hash: '0xledger',
          settlementNonce: 42,
        },
      ),
    ).toBe(true);
    expect(
      getPerpsFundingSettlementIdentityKeys({
        direction: 'withdraw',
        hash: 'hl-nonce:42',
        settlementNonce: 42,
      }),
    ).toEqual(['hyperliquid-nonce:42:withdraw']);
  });

  it('accepts only positive safe nonces from withdraw and send ledger facts', () => {
    expect(
      getPerpsFundingLedgerSettlementNonce({ nonce: 42, type: 'withdraw' }),
    ).toBe(42);
    expect(
      getPerpsFundingLedgerSettlementNonce({ nonce: 43, type: 'send' }),
    ).toBe(43);
    expect(
      getPerpsFundingLedgerSettlementNonce({
        nonce: 1786805795351000,
        type: 'withdraw',
      }),
    ).toBe(1786805795351);
    expect(
      getPerpsFundingLedgerSettlementNonce({ nonce: 44, type: 'deposit' }),
    ).toBeUndefined();
    expect(
      getPerpsFundingLedgerSettlementNonce({ nonce: '45', type: 'send' }),
    ).toBeUndefined();
  });
});
