import { shouldClearConsumedSwapNavigationParams } from './navigationParams';

describe('Swap navigation params', () => {
  it.each([
    { isSwapToTokenDetail: true },
    { isFromSwap: true },
    { isSwapToTokenDetail: true, isFromSwap: true },
  ])('clears consumed source params when present', params => {
    expect(shouldClearConsumedSwapNavigationParams(params)).toBe(true);
  });

  it.each([
    undefined,
    {},
    { isSwapToTokenDetail: false },
    { isFromSwap: false },
    { isSwapToTokenDetail: false, isFromSwap: false },
  ])('does not update navigation for ordinary activation', params => {
    expect(shouldClearConsumedSwapNavigationParams(params)).toBe(false);
  });
});
