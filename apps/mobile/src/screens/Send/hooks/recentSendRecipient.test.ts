import type { SendTxHistoryItem } from '@/core/services/transactionHistory';
import { hasRecentSuccessfulSendTo } from './recentSendRecipient';

const NOW = 1_700_000_000_000;
const FROM = '0x1111111111111111111111111111111111111111';
const TO = '0x2222222222222222222222222222222222222222';

function makeHistory(
  overrides: Partial<SendTxHistoryItem> = {},
): SendTxHistoryItem {
  return {
    address: FROM,
    amount: 1,
    chainId: 1,
    createdAt: NOW - 1000,
    from: FROM,
    hash: '0xhash',
    status: 'success',
    to: TO,
    token: {} as SendTxHistoryItem['token'],
    ...overrides,
  };
}

describe('hasRecentSuccessfulSendTo', () => {
  it('matches a recent successful send for a visible account', () => {
    expect(
      hasRecentSuccessfulSendTo({
        history: [makeHistory()],
        fromAddresses: [FROM.toUpperCase()],
        toAddress: TO.toUpperCase(),
        now: NOW,
      }),
    ).toBe(true);
  });

  it.each([
    ['pending transaction', { status: 'pending' as const }],
    ['failed transaction', { status: 'failed' as const }],
    ['expired transaction', { completedAt: NOW - 60 * 60 * 1000 - 1 }],
    [
      'different sender',
      { address: '0x3333333333333333333333333333333333333333' },
    ],
    [
      'different recipient',
      { to: '0x4444444444444444444444444444444444444444' },
    ],
  ])('rejects a %s', (_label, overrides) => {
    expect(
      hasRecentSuccessfulSendTo({
        history: [makeHistory(overrides)],
        fromAddresses: [FROM],
        toAddress: TO,
        now: NOW,
      }),
    ).toBe(false);
  });
});
