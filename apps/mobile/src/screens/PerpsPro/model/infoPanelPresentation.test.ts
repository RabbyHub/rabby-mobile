import {
  resolvePerpsProCollectionPresentation,
  resolvePerpsProInitialInfoTab,
  resolvePerpsProInfoTabPresentation,
} from './infoPanelPresentation';

describe('Perps Pro collection empty-state authority', () => {
  it('defaults to Positions only when at least one position exists', () => {
    expect(resolvePerpsProInitialInfoTab(1)).toBe('positions');
    expect(resolvePerpsProInitialInfoTab(0)).toBe('account');
  });

  it('keeps the Account loading panel reachable while preferences hydrate', () => {
    expect(
      resolvePerpsProInfoTabPresentation({
        accountFactsReady: true,
        accountIdentity: '0x1:keyring',
        accountSelectionReady: true,
        activeInfoTabPreference: 'account',
        hasUserSelectedInfoTab: false,
        positionCount: 1,
        preferencesHydrated: false,
        previousAutomaticSelection: null,
      }),
    ).toEqual({ activeInfoTab: 'account', automaticSelection: null });
  });

  it.each(['account', 'positions', 'openOrders'] as const)(
    'restores an explicit %s preference without waiting for account facts',
    activeInfoTabPreference => {
      expect(
        resolvePerpsProInfoTabPresentation({
          accountFactsReady: false,
          accountIdentity: null,
          accountSelectionReady: false,
          activeInfoTabPreference,
          hasUserSelectedInfoTab: true,
          positionCount: 0,
          preferencesHydrated: true,
          previousAutomaticSelection: null,
        }).activeInfoTab,
      ).toBe(activeInfoTabPreference);
    },
  );

  it.each([
    { expected: 'positions' as const, positionCount: 1 },
    { expected: 'account' as const, positionCount: 0 },
  ])(
    'resolves an unselected user to $expected from authoritative position facts',
    ({ expected, positionCount }) => {
      const result = resolvePerpsProInfoTabPresentation({
        accountFactsReady: true,
        accountIdentity: '0x1:keyring',
        accountSelectionReady: true,
        activeInfoTabPreference: 'openOrders',
        hasUserSelectedInfoTab: false,
        positionCount,
        preferencesHydrated: true,
        previousAutomaticSelection: null,
      });

      expect(result).toEqual({
        activeInfoTab: expected,
        automaticSelection: {
          accountIdentity: '0x1:keyring',
          activeInfoTab: expected,
        },
      });
    },
  );

  it('keeps the once-per-account automatic selection after positions change', () => {
    expect(
      resolvePerpsProInfoTabPresentation({
        accountFactsReady: true,
        accountIdentity: '0x1:keyring',
        accountSelectionReady: true,
        activeInfoTabPreference: 'account',
        hasUserSelectedInfoTab: false,
        positionCount: 0,
        preferencesHydrated: true,
        previousAutomaticSelection: {
          accountIdentity: '0x1:keyring',
          activeInfoTab: 'positions',
        },
      }).activeInfoTab,
    ).toBe('positions');
  });

  it('keeps the new account loading/error panel reachable without committing stale automatic selection', () => {
    const previousAutomaticSelection = {
      accountIdentity: '0x1:keyring',
      activeInfoTab: 'positions' as const,
    };
    expect(
      resolvePerpsProInfoTabPresentation({
        accountFactsReady: false,
        accountIdentity: '0x2:keyring',
        accountSelectionReady: true,
        activeInfoTabPreference: 'account',
        hasUserSelectedInfoTab: false,
        positionCount: 0,
        preferencesHydrated: true,
        previousAutomaticSelection,
      }),
    ).toEqual({
      activeInfoTab: 'account',
      automaticSelection: previousAutomaticSelection,
    });
  });

  it('does not treat a transient missing account as authoritative', () => {
    expect(
      resolvePerpsProInfoTabPresentation({
        accountFactsReady: false,
        accountIdentity: null,
        accountSelectionReady: false,
        activeInfoTabPreference: 'account',
        hasUserSelectedInfoTab: false,
        positionCount: 0,
        preferencesHydrated: true,
        previousAutomaticSelection: null,
      }).activeInfoTab,
    ).toBe('account');
  });

  it('replaces the pending Account panel with the authoritative automatic tab after baseline completion', () => {
    const pending = resolvePerpsProInfoTabPresentation({
      accountFactsReady: false,
      accountIdentity: '0x1:keyring',
      accountSelectionReady: true,
      activeInfoTabPreference: 'account',
      hasUserSelectedInfoTab: false,
      positionCount: 0,
      preferencesHydrated: true,
      previousAutomaticSelection: null,
    });
    expect(pending).toEqual({
      activeInfoTab: 'account',
      automaticSelection: null,
    });
    const ready = resolvePerpsProInfoTabPresentation({
      accountFactsReady: true,
      accountIdentity: '0x1:keyring',
      accountSelectionReady: true,
      activeInfoTabPreference: 'account',
      hasUserSelectedInfoTab: false,
      positionCount: 1,
      preferencesHydrated: true,
      previousAutomaticSelection: pending.automaticSelection,
    });
    expect(ready.activeInfoTab).toBe('positions');
    expect(ready.automaticSelection).toEqual({
      accountIdentity: '0x1:keyring',
      activeInfoTab: 'positions',
    });
  });

  it('distinguishes unresolved, authoritative empty, filtered empty, and populated collections', () => {
    expect(
      resolvePerpsProCollectionPresentation({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: true,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toBe('authoritativeEmpty');

    for (const overrides of [{ hasAccount: false }, { runtimeReady: false }]) {
      expect(
        resolvePerpsProCollectionPresentation({
          hasAccount: true,
          runtimeReady: true,
          sourceReady: true,
          totalCount: 0,
          visibleCount: 0,
          ...overrides,
        }),
      ).toBe('unresolved');
    }

    expect(
      resolvePerpsProCollectionPresentation({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: false,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toBe('unresolved');

    expect(
      resolvePerpsProCollectionPresentation({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: true,
        totalCount: 2,
        visibleCount: 0,
      }),
    ).toBe('filteredEmpty');
  });

  it('preserves visible partial rows while the source readiness baseline is pending', () => {
    expect(
      resolvePerpsProCollectionPresentation({
        hasAccount: true,
        runtimeReady: true,
        sourceReady: false,
        totalCount: 2,
        visibleCount: 1,
      }),
    ).toBe('populated');
  });
});
