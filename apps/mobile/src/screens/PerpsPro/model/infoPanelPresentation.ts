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
