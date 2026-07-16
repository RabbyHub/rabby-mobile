import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import {
  MAX_USER_FILLS,
  getFillKey,
  mergeUserFills,
  reconcileHttpFills,
} from './userFills';

const makeFill = (overrides: Partial<WsFill> = {}): WsFill => ({
  coin: 'BTC',
  px: '64000',
  sz: '0.1',
  side: 'B',
  time: 1_700_000_000_000,
  startPosition: '0',
  dir: 'Open Long',
  closedPnl: '0',
  hash: '0xabc',
  oid: 1,
  crossed: true,
  fee: '0.01',
  tid: 111,
  ...overrides,
});

describe('getFillKey', () => {
  it('treats the two legs of a self-trade (same tid, opposite side) as distinct', () => {
    const buyLeg = makeFill({ time: 1000, tid: 5, side: 'B' });
    const sellLeg = makeFill({ time: 1000, tid: 5, side: 'A' });
    expect(getFillKey(buyLeg)).not.toBe(getFillKey(sellLeg));
  });

  it('identifies the same trade regardless of non-key fields', () => {
    const ws = makeFill({ time: 1000, tid: 5, px: '100', hash: '0x1' });
    const http = makeFill({ time: 1000, tid: 5, px: '100.0', hash: '0x2' });
    expect(getFillKey(ws)).toBe(getFillKey(http));
  });
});

describe('mergeUserFills', () => {
  it('dedups by key and lets the incoming version win (WS-vs-HTTP drift)', () => {
    const prev = [makeFill({ time: 1000, tid: 1, px: '100' })];
    const incoming = [makeFill({ time: 1000, tid: 1, px: '100.5' })];
    const merged = mergeUserFills(incoming, prev);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.px).toBe('100.5');
  });

  it('returns fills ordered newest first', () => {
    const prev = [
      makeFill({ time: 300, tid: 3 }),
      makeFill({ time: 100, tid: 1 }),
    ];
    const incoming = [makeFill({ time: 200, tid: 2 })];
    const merged = mergeUserFills(incoming, prev);
    expect(merged.map(f => f.time)).toEqual([300, 200, 100]);
  });

  it('never drops fuller history when merging a partial reconnect snapshot', () => {
    const fullHistory = [5, 4, 3, 2, 1].map(t => makeFill({ time: t, tid: t }));
    const reconnectSnapshot = [makeFill({ time: 5, tid: 5 })];
    const merged = mergeUserFills(reconnectSnapshot, fullHistory);
    expect(merged.map(f => f.time)).toEqual([5, 4, 3, 2, 1]);
  });

  it('caps the list at MAX_USER_FILLS, keeping the newest', () => {
    const overflow = 10;
    const incoming = Array.from({ length: MAX_USER_FILLS + overflow }, (_, i) =>
      makeFill({ time: i + 1, tid: i + 1 }),
    );
    const merged = mergeUserFills(incoming, []);
    expect(merged).toHaveLength(MAX_USER_FILLS);
    expect(merged[0]?.time).toBe(MAX_USER_FILLS + overflow);
    expect(merged[merged.length - 1]?.time).toBe(overflow + 1);
  });
});

describe('reconcileHttpFills', () => {
  it('returns prev untouched for an empty response', () => {
    const prev = [makeFill({ time: 100, tid: 1 })];
    expect(reconcileHttpFills([], prev)).toBe(prev);
  });

  it('is authoritative inside its own window: drops WS-only fills the response does not carry', () => {
    const prev = [
      makeFill({ time: 200, tid: 2 }), // inside window, not in res → replaced away
      makeFill({ time: 100, tid: 1 }), // older than window → kept
    ];
    const res = [
      makeFill({ time: 250, tid: 4 }),
      makeFill({ time: 150, tid: 3 }),
    ];
    const merged = reconcileHttpFills(res, prev);
    expect(merged.map(f => f.time)).toEqual([250, 150, 100]);
    expect(merged.some(f => f.tid === 2)).toBe(false);
  });

  it('keeps WS fills newer than the window and history older than it', () => {
    const prev = [
      makeFill({ time: 300, tid: 30 }), // WS push newer than the HTTP response
      makeFill({ time: 50, tid: 5 }), // history beyond the response depth
    ];
    const res = [
      makeFill({ time: 200, tid: 20 }),
      makeFill({ time: 100, tid: 10 }),
    ];
    const merged = reconcileHttpFills(res, prev);
    expect(merged.map(f => f.time)).toEqual([300, 200, 100, 50]);
  });

  it('treats window boundaries as inclusive: a prev fill at exactly the newest time is replaced', () => {
    const prev = [makeFill({ time: 200, tid: 99 })];
    const res = [
      makeFill({ time: 200, tid: 20 }),
      makeFill({ time: 100, tid: 10 }),
    ];
    const merged = reconcileHttpFills(res, prev);
    expect(merged.some(f => f.tid === 99)).toBe(false);
    expect(merged.map(f => f.tid)).toEqual([20, 10]);
  });

  it('normalizes drift for the same trade inside the window (HTTP version wins)', () => {
    const prev = [makeFill({ time: 150, tid: 7, px: '99.9' })];
    const res = [
      makeFill({ time: 200, tid: 8 }),
      makeFill({ time: 150, tid: 7, px: '100' }),
      makeFill({ time: 100, tid: 6 }),
    ];
    const merged = reconcileHttpFills(res, prev);
    expect(merged).toHaveLength(3);
    expect(merged.find(f => f.tid === 7)?.px).toBe('100');
  });
});
