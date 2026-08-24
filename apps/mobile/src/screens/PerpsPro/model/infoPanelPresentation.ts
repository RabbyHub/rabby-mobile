import type { PerpsProInfoTab } from '@/core/services/perpsService';

export const resolvePerpsProInitialInfoTab = (
  positionCount: number,
): PerpsProInfoTab => (positionCount > 0 ? 'positions' : 'account');

export type PerpsProAutomaticInfoTabSelection = {
  accountIdentity: string;
  activeInfoTab: PerpsProInfoTab;
};

export const resolvePerpsProInfoTabPresentation = ({
  accountFactsReady,
  accountIdentity,
  accountSelectionReady,
  activeInfoTabPreference,
  hasUserSelectedInfoTab,
  positionCount,
  preferencesHydrated,
  previousAutomaticSelection,
}: {
  accountFactsReady: boolean;
  accountIdentity: string | null;
  accountSelectionReady: boolean;
  activeInfoTabPreference: PerpsProInfoTab;
  hasUserSelectedInfoTab: boolean;
  positionCount: number;
  preferencesHydrated: boolean;
  previousAutomaticSelection: PerpsProAutomaticInfoTabSelection | null;
}): {
  activeInfoTab: PerpsProInfoTab | null;
  automaticSelection: PerpsProAutomaticInfoTabSelection | null;
} => {
  if (!preferencesHydrated) {
    return {
      activeInfoTab: null,
      automaticSelection: previousAutomaticSelection,
    };
  }

  if (hasUserSelectedInfoTab) {
    return {
      activeInfoTab: activeInfoTabPreference,
      automaticSelection: previousAutomaticSelection,
    };
  }

  const resolvedAccountIdentity = accountIdentity ?? 'no-account';
  if (previousAutomaticSelection?.accountIdentity === resolvedAccountIdentity) {
    return {
      activeInfoTab: previousAutomaticSelection.activeInfoTab,
      automaticSelection: previousAutomaticSelection,
    };
  }

  if (accountIdentity ? !accountFactsReady : !accountSelectionReady) {
    return {
      activeInfoTab: null,
      automaticSelection: previousAutomaticSelection,
    };
  }

  const automaticSelection = {
    accountIdentity: resolvedAccountIdentity,
    activeInfoTab: accountIdentity
      ? resolvePerpsProInitialInfoTab(positionCount)
      : ('account' as const),
  };
  return {
    activeInfoTab: automaticSelection.activeInfoTab,
    automaticSelection,
  };
};

export const isPerpsProCollectionAuthoritativelyEmpty = ({
  hasAccount,
  runtimeReady,
  sourceReady,
  totalCount,
}: {
  hasAccount: boolean;
  runtimeReady: boolean;
  sourceReady: boolean;
  totalCount: number;
}) => hasAccount && runtimeReady && sourceReady && totalCount === 0;
