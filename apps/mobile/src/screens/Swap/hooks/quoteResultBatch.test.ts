import type { TDexQuoteData } from './quote';
import { mergeSwapQuoteBatch } from './quoteResultBatch';

const quote = (name: string, amount: string): TDexQuoteData =>
  ({
    name,
    loading: true,
    data: {
      toTokenAmount: amount,
    },
  } as TDexQuoteData);

describe('mergeSwapQuoteBatch', () => {
  it('updates existing quotes without mutating their order', () => {
    const current = [quote('dex-a', '1'), quote('dex-b', '2')];
    const result = mergeSwapQuoteBatch(current, [quote('dex-a', '3')]);

    expect(result.map(item => item.name)).toEqual(['dex-a', 'dex-b']);
    expect(result[0].data?.toTokenAmount).toBe('3');
    expect(result[0].loading).toBe(false);
    expect(current[0].data?.toTokenAmount).toBe('1');
  });

  it('appends new quotes in arrival order and keeps the latest duplicate', () => {
    const result = mergeSwapQuoteBatch(
      [quote('dex-a', '1')],
      [quote('dex-b', '2'), quote('dex-c', '3'), quote('dex-b', '4')],
    );

    expect(result.map(item => item.name)).toEqual(['dex-a', 'dex-b', 'dex-c']);
    expect(result[1].data?.toTokenAmount).toBe('4');
  });

  it('preserves the current reference when there are no updates', () => {
    const current = [quote('dex-a', '1')];
    expect(mergeSwapQuoteBatch(current, [])).toBe(current);
  });
});
