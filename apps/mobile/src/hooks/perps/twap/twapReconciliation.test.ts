import {
  parsePerpsTwapHistory,
  parsePerpsTwapFill,
  parsePerpsTwapState,
  mergePerpsTwapHistory,
  replacePerpsTwapActiveSnapshot,
  mergePerpsTwapFills,
  getPerpsTwapStatus,
  getPerpsTwapSummary,
} from './twapReconciliation';
const user = '0xabc';
const state = {
  user,
  coin: 'xyz:TEST',
  side: 'B',
  sz: '2',
  executedSz: '0.5',
  executedNtl: '100',
  minutes: 30,
  timestamp: 100_000,
  randomize: true,
  reduceOnly: false,
};
const history = (status: string, time = 150) =>
  parsePerpsTwapHistory(
    { twapId: 7, time, state, status: { status, description: 'reason' } },
    user,
  )!;
const fill = (tid: number) =>
  parsePerpsTwapFill({
    twapId: 7,
    fill: {
      coin: state.coin,
      side: 'B',
      oid: 1,
      tid,
      px: '200',
      sz: '0.25',
      time: 110_000,
      fee: '-0.001',
      feeToken: 'USDT',
      hash: '0x0',
    },
  })!;

test('rejects foreign accounts and uses history seconds, state milliseconds and outer TWAP identity', () => {
  expect(parsePerpsTwapState(state, '0xother')).toBeNull();
  expect(parsePerpsTwapState({ ...state, user: '0xABC' }, user)).not.toBeNull();
  const record = history('finished');
  expect(record.endedAt).toBe(150_000);
  expect(getPerpsTwapSummary(record)).toMatchObject({
    actualSeconds: 50,
    averagePrice: '200',
    totalQuote: '400',
    filledQuote: '100',
    percentage: 25,
  });
  expect(getPerpsTwapStatus(record)).toBe('expired');
});

test('full snapshots remove missing active entries; terminal history never regresses or resurrects', () => {
  const active = replacePerpsTwapActiveSnapshot({}, [
    [7, parsePerpsTwapState(state, user)!],
  ]);
  expect(
    replacePerpsTwapActiveSnapshot(active, [
      [7, parsePerpsTwapState(state, user)!],
    ]),
  ).toBe(active);
  const terminal = mergePerpsTwapHistory(active, [history('terminated')]);
  expect(getPerpsTwapStatus(terminal['xyz:TEST:7'])).toBe('cancelled');
  expect(mergePerpsTwapHistory(terminal, [history('activated', 140)])).toBe(
    terminal,
  );
  expect(
    replacePerpsTwapActiveSnapshot(terminal, [
      [7, parsePerpsTwapState(state, user)!],
    ]),
  ).toBe(terminal);
  expect(replacePerpsTwapActiveSnapshot(active, [])['xyz:TEST:7'].active).toBe(
    false,
  );
});

test('deduplicates fills by trade identity, not oid or a zero transaction hash', () => {
  const first = fill(1),
    second = fill(2);
  expect(first.key).toBe('xyz:TEST:7:1');
  expect(
    mergePerpsTwapFills([first], [first, second]).map(item => item.tid),
  ).toEqual([2, 1]);
  expect(mergePerpsTwapFills([], [second])[0].feeToken).toBe('USDT');
});
