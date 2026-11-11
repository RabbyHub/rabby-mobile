import { shouldShowChainSelector } from './chainSelectorVisibility';

const base = {
  currentAddress: '0xabc',
  chainLength: 0,
  pending: false,
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

  it('keeps the filter (loading) while the projection is pending (QA 1145)', () => {
    expect(shouldShowChainSelector({ ...base, pending: true })).toBe(true);
  });

  it('hides the filter for a settled address with no assets (QA 1197)', () => {
    expect(shouldShowChainSelector(base)).toBe(false);
  });

  it('shows the filter for a settled address with assets', () => {
    expect(shouldShowChainSelector({ ...base, chainLength: 2 })).toBe(true);
  });
});
