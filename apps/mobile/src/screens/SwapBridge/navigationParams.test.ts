import {
  getSwapBridgeActiveTab,
  shouldClearConsumedSwapNavigationParams,
} from './navigationParams';

describe('SwapBridge active tab', () => {
  it.each([undefined, {}, { activeTab: 'swap' }, { activeTab: 'unknown' }])(
    'defaults to Swap for absent or invalid params',
    params => {
      expect(getSwapBridgeActiveTab(params)).toBe('swap');
    },
  );

  it('uses Bridge when the route selects it', () => {
    expect(getSwapBridgeActiveTab({ activeTab: 'bridge' })).toBe('bridge');
  });
});

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
