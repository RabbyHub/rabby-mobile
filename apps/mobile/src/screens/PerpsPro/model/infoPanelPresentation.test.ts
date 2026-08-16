import { isPerpsProCollectionAuthoritativelyEmpty } from './infoPanelPresentation';

describe('Perps Pro collection empty-state authority', () => {
  it('shows an empty state only after the complete source is ready', () => {
    expect(
      isPerpsProCollectionAuthoritativelyEmpty({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: true,
        totalCount: 0,
      }),
    ).toBe(true);

    for (const overrides of [
      { hasAccount: false },
      { runtimeReady: false },
      { sourceReady: false },
      { totalCount: 1 },
    ]) {
      expect(
        isPerpsProCollectionAuthoritativelyEmpty({
          hasAccount: true,
          runtimeReady: true,
          sourceReady: true,
          totalCount: 0,
          ...overrides,
        }),
      ).toBe(false);
    }
  });

  it('uses the global count rather than a filtered list count', () => {
    expect(
      isPerpsProCollectionAuthoritativelyEmpty({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: true,
        totalCount: 2,
      }),
    ).toBe(false);
  });
});
