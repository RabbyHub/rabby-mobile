import { shouldShowChainSelector } from './chainSelectorVisibility';

const base = {
  currentAddress: '0xabc',
  chainLength: 0,
  balanceLoading: false,
  isLoadingCurve: false,
};

describe('shouldShowChainSelector', () => {
  it('hides the filter when there is no address', () => {
    expect(
      shouldShowChainSelector({ ...base, currentAddress: undefined }),
    ).toBe(false);
    expect(shouldShowChainSelector({ ...base, currentAddress: '' })).toBe(
      false,
    );
  });

  it('keeps the filter while the initial load is running (QA 1145)', () => {
    expect(shouldShowChainSelector({ ...base, balanceLoading: true })).toBe(
      true,
    );
    expect(shouldShowChainSelector({ ...base, isLoadingCurve: true })).toBe(
      true,
    );
  });

  it('hides the filter for a loaded address with no assets (QA 1197)', () => {
    expect(shouldShowChainSelector(base)).toBe(false);
  });

  it('shows the filter for a loaded address with assets', () => {
    expect(shouldShowChainSelector({ ...base, chainLength: 2 })).toBe(true);
  });
});
