import {
  prepareHomeManualAssetRefreshAddresses,
  shouldReconcileHomeManualAssetRefresh,
} from './homeManualAssetRefresh';

describe('Home manual asset refresh', () => {
  it('normalizes and deduplicates the early native refresh scope', () => {
    expect(
      prepareHomeManualAssetRefreshAddresses(['0xABC', '0xdef', '0xabc']),
    ).toEqual(['0xabc', '0xdef']);
  });

  it('keeps one native request when only address order changes', () => {
    expect(
      shouldReconcileHomeManualAssetRefresh(
        ['0xabc', '0xdef'],
        ['0xDEF', '0xABC'],
      ),
    ).toBe(false);
  });

  it('reconciles when refreshed balances select a different address set', () => {
    expect(
      shouldReconcileHomeManualAssetRefresh(
        ['0xabc', '0xdef'],
        ['0xabc', '0x123'],
      ),
    ).toBe(true);
  });

  it('uses the late scope when no early native refresh was dispatched', () => {
    expect(shouldReconcileHomeManualAssetRefresh(undefined, ['0xabc'])).toBe(
      true,
    );
    expect(shouldReconcileHomeManualAssetRefresh(undefined, [])).toBe(false);
  });
});
