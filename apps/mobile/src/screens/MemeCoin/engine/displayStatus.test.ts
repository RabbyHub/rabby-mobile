import {
  countFinishedLegs,
  getLegDisplayStatuses,
  isLegRetryable,
} from './displayStatus';
import type { ExecLeg, LegState } from './types';

const leg = (key: string, chain: string): ExecLeg => ({
  key,
  kind: 'swap',
  pay: { id: key, chain, symbol: key },
  receive: { id: 'meme', chain, symbol: 'MEME' },
  amountUsd: 1,
  payAll: false,
});

describe('getLegDisplayStatuses', () => {
  const legs = [
    leg('a1', 'eth'),
    leg('a2', 'eth'),
    leg('b1', 'bsc'),
    leg('b2', 'bsc'),
  ];

  it('maps phases and marks queued legs behind an in-progress same-chain leg', () => {
    const states: Record<string, LegState> = {
      a1: { phase: 'confirming' },
      a2: { phase: 'queued' },
      b1: { phase: 'arriving' },
      b2: { phase: 'queued' },
    };
    expect(getLegDisplayStatuses(legs, states)).toEqual({
      a1: 'executing',
      a2: 'pendingPrevious',
      b1: 'executing',
      b2: 'pending',
    });
  });

  it('maps idle, success, failed and cancelled', () => {
    expect(
      getLegDisplayStatuses(legs, {
        a1: { phase: 'success' },
        a2: { phase: 'failed', failReason: 'noQuote' },
        b1: { phase: 'cancelled' },
      }),
    ).toEqual({ a1: 'success', a2: 'failed', b1: 'hidden', b2: 'pending' });
  });

  it('counts success and failed as finished', () => {
    expect(
      countFinishedLegs({
        a: { phase: 'success' },
        b: { phase: 'failed' },
        c: { phase: 'confirming' },
      }),
    ).toBe(2);
  });
});

describe('isLegRetryable', () => {
  it('allows failed legs except bridge arrival failures', () => {
    expect(isLegRetryable({ phase: 'failed', failReason: 'noQuote' })).toBe(
      true,
    );
    expect(
      isLegRetryable({ phase: 'failed', failReason: 'failed', txHash: '0x1' }),
    ).toBe(true);
    expect(
      isLegRetryable({
        phase: 'failed',
        failReason: 'arrivalFailed',
        txHash: '0x1',
      }),
    ).toBe(false);
  });

  it('rejects anything that has not failed', () => {
    expect(isLegRetryable(undefined)).toBe(false);
    expect(isLegRetryable({ phase: 'success', txHash: '0x1' })).toBe(false);
    expect(isLegRetryable({ phase: 'preparing' })).toBe(false);
    expect(isLegRetryable({ phase: 'cancelled' })).toBe(false);
  });
});
