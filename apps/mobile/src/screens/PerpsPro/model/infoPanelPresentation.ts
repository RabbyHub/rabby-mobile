import type { PerpsProInfoTab } from '@/core/services/perpsService';

export const resolvePerpsProInitialInfoTab = (
  positionCount: number,
): PerpsProInfoTab => (positionCount > 0 ? 'positions' : 'account');

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
