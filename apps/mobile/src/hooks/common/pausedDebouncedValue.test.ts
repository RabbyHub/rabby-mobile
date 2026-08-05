import { resolvePausedDebouncedValue } from './delayLikeValue';

describe('resolvePausedDebouncedValue', () => {
  it('holds a transient zero while work is active and publishes the settled snapshot on resume', () => {
    const committed = {
      rawChange: 12,
      changePercent: '1.2%',
      isLoss: false,
    };
    const transient = {
      rawChange: 0,
      changePercent: '0%',
      isLoss: false,
    };

    expect(
      resolvePausedDebouncedValue(committed, transient, true, true),
    ).toEqual({
      displayedValue: committed,
      shouldCommitImmediately: false,
    });

    const settled = {
      rawChange: -7,
      changePercent: '0.7%',
      isLoss: true,
    };

    expect(
      resolvePausedDebouncedValue(committed, settled, true, false),
    ).toEqual({
      displayedValue: settled,
      shouldCommitImmediately: true,
    });
  });

  it('publishes a legitimate final zero snapshot on resume', () => {
    const committed = {
      rawChange: 12,
      changePercent: '1.2%',
      isLoss: false,
    };
    const settledZero = {
      rawChange: 0,
      changePercent: '0%',
      isLoss: false,
    };

    expect(
      resolvePausedDebouncedValue(committed, settledZero, true, false),
    ).toEqual({
      displayedValue: settledZero,
      shouldCommitImmediately: true,
    });
  });
});
