import * as apisLock from '@/core/apis/lock';
import { apisPerps } from '@/core/apis/perps';
import {
  getPerpsAccountRuntimeContext,
  perpsStore,
  usePerpsStore,
  waitForInitialWsData,
} from '@/hooks/perps/usePerpsStore';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  ensurePerpsRuntime,
  type PerpsRuntimeDependencies,
} from './ensurePerpsRuntime';
import {
  registerLegacyRuntimeContinuation,
  type LegacyRuntimeContinuationHandlers,
} from './legacyRuntimeContinuation';
import { getPerpsRuntimeIdentity } from './perpsRuntimeState';

type UseEnsurePerpsRuntimeOptions = {
  legacyContinuation?: LegacyRuntimeContinuationHandlers;
  legacyContinuationEnabled?: boolean;
};

export const useEnsurePerpsRuntime = ({
  legacyContinuation,
  legacyContinuationEnabled = false,
}: UseEnsurePerpsRuntimeOptions = {}) => {
  const { currentPerpsAccount, isInitialized } = perpsStore(
    useShallow(state => ({
      currentPerpsAccount: state.currentPerpsAccount,
      isInitialized: state.isInitialized,
    })),
  );
  const { fetchMarketData, loginPerpsAccount, setInitialized } =
    usePerpsStore();

  const dependencies = useMemo<PerpsRuntimeDependencies>(
    () => ({
      getPerpsAccountRuntimeContext,
      isSelfSignPerpsAccount: accountType =>
        apisPerps.isSelfSignPerpsAccount(accountType),
      isWalletUnlocked: () => apisLock.isUnlocked(),
      applyPerpsSigner: account => apisPerps.applyPerpsSigner(account),
      getPerpsAgentAddress: masterAddress =>
        apisPerps.getPerpsAgentAddress(masterAddress),
      getOrCreatePerpsAgentWallet: masterAddress =>
        apisPerps.getOrCreatePerpsAgentWallet(masterAddress),
      initPerpsAgentAccount: (masterAddress, vault, agentAddress) =>
        apisPerps.initPerpsAgentAccount(masterAddress, vault, agentAddress),
      loginPerpsAccount,
      fetchMarketData,
      waitForInitialWsData,
      setInitialized,
    }),
    [fetchMarketData, loginPerpsAccount, setInitialized],
  );

  const identity = currentPerpsAccount
    ? getPerpsRuntimeIdentity(currentPerpsAccount)
    : null;

  useEffect(() => {
    if (!legacyContinuationEnabled || !legacyContinuation || !identity) {
      return;
    }

    return registerLegacyRuntimeContinuation(identity, legacyContinuation);
  }, [identity, legacyContinuation, legacyContinuationEnabled]);

  useEffect(() => {
    ensurePerpsRuntime({
      account: currentPerpsAccount,
      isInitialized,
      dependencies,
    });
  }, [currentPerpsAccount, dependencies, isInitialized]);
};
