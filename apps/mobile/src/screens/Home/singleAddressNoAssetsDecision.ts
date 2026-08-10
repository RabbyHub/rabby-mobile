import { useEffect, useRef, useState } from 'react';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';

import { customTestnetServiceApi } from '@/core/serviceApi/customTestnet';
import type { KeyringAccountWithAlias } from '@/types/account';
import { getShowReceiveAddressTip } from '@/screens/Address/components/MultiAssets/hooks';
import { withTimeoutFallback } from '@/utils/async';

export type SingleAddressNoAssetsDecision = {
  account: KeyringAccountWithAlias | null;
  status: 'idle' | 'pending' | 'ready' | 'failed';
};

export type SingleAddressAssetViewState =
  | 'none'
  | 'network-error'
  | 'pending'
  | 'receive'
  | 'assets';

type DecisionState = SingleAddressNoAssetsDecision & {
  key: string | null;
};

type ResolveSingleAddressAssetViewStateParams = {
  hasCurrentAccount: boolean;
  hasNetworkError: boolean;
  shouldResolveNoAssets: boolean;
  decision: SingleAddressNoAssetsDecision;
};

type ShouldResolveSingleAddressNoAssetsParams = {
  account?: KeyringAccountWithAlias | null;
  chainLength: number;
  customTestnetCount: number;
  evmBalance?: number | null;
};

type NoAssetsDecisionDependencies = {
  getReceiveTip: typeof getShowReceiveAddressTip;
  getCustomTestnetList: () => Promise<readonly unknown[]>;
  timeoutMs?: number;
};

const NO_ASSETS_DECISION_TIMEOUT_MS = 5000;

const INITIAL_DECISION_STATE: DecisionState = {
  key: null,
  account: null,
  status: 'idle',
};

const defaultDependencies: NoAssetsDecisionDependencies = {
  getReceiveTip: getShowReceiveAddressTip,
  getCustomTestnetList: () => customTestnetServiceApi.getList(),
};

const inFlightDecisions = new Map<
  string,
  Promise<KeyringAccountWithAlias | null>
>();

export function isSingleAddressReceiveTipAccount(
  account: KeyringAccountWithAlias,
) {
  return CORE_KEYRING_TYPES.includes(account.type);
}

export function shouldResolveSingleAddressNoAssets({
  account,
  chainLength,
  customTestnetCount,
  evmBalance,
}: ShouldResolveSingleAddressNoAssetsParams) {
  if (!account || !isSingleAddressReceiveTipAccount(account)) {
    return false;
  }

  if (chainLength > 0 || customTestnetCount > 0) {
    return false;
  }

  return !(typeof evmBalance === 'number' && evmBalance > 0);
}

export function resolveSingleAddressAssetViewState({
  hasCurrentAccount,
  hasNetworkError,
  shouldResolveNoAssets,
  decision,
}: ResolveSingleAddressAssetViewStateParams): SingleAddressAssetViewState {
  if (!hasCurrentAccount) {
    return 'none';
  }
  if (hasNetworkError) {
    return 'network-error';
  }
  if (!shouldResolveNoAssets) {
    return 'assets';
  }
  if (decision.status === 'idle' || decision.status === 'pending') {
    return 'pending';
  }
  if (decision.status === 'ready' && decision.account) {
    return 'receive';
  }
  return 'assets';
}

export async function loadSingleAddressNoAssetsDecision(
  account: KeyringAccountWithAlias,
  dependencies: NoAssetsDecisionDependencies = defaultDependencies,
) {
  const evidence = await withTimeoutFallback(
    Promise.all([
      dependencies.getReceiveTip({
        caredAccount: account,
        isForSingle: true,
      }),
      dependencies.getCustomTestnetList(),
    ]),
    dependencies.timeoutMs ?? NO_ASSETS_DECISION_TIMEOUT_MS,
    null,
  );

  if (!evidence) {
    return null;
  }

  const [receiveTip, customTestnetList] = evidence;

  if (
    !receiveTip?.targetAccount ||
    receiveTip.evmBalance !== 0 ||
    receiveTip.borned ||
    receiveTip.appChainHasBalance ||
    customTestnetList.length > 0
  ) {
    return null;
  }

  return receiveTip.targetAccount;
}

function getDecisionKey(account: KeyringAccountWithAlias) {
  return `${account.address.toLowerCase()}:${account.type}:${
    account.brandName
  }`;
}

function getInFlightDecision(key: string, account: KeyringAccountWithAlias) {
  const activeDecision = inFlightDecisions.get(key);
  if (activeDecision) {
    return activeDecision;
  }

  const decision = loadSingleAddressNoAssetsDecision(account);
  inFlightDecisions.set(key, decision);
  decision.then(
    () => {
      if (inFlightDecisions.get(key) === decision) {
        inFlightDecisions.delete(key);
      }
    },
    () => {
      if (inFlightDecisions.get(key) === decision) {
        inFlightDecisions.delete(key);
      }
    },
  );
  return decision;
}

export function useSingleAddressNoAssetsDecision({
  account,
  enabled,
}: {
  account?: KeyringAccountWithAlias | null;
  enabled: boolean;
}): SingleAddressNoAssetsDecision {
  const accountRef = useRef(account);
  accountRef.current = account;
  const decisionKey = enabled && account ? getDecisionKey(account) : null;
  const [state, setState] = useState<DecisionState>(INITIAL_DECISION_STATE);

  useEffect(() => {
    if (!decisionKey) {
      setState(INITIAL_DECISION_STATE);
      return;
    }

    const accountSnapshot = accountRef.current;
    if (!accountSnapshot) {
      return;
    }

    let active = true;
    setState({
      key: decisionKey,
      account: null,
      status: 'pending',
    });
    getInFlightDecision(decisionKey, accountSnapshot).then(
      resolvedAccount => {
        if (!active) {
          return;
        }
        setState({
          key: decisionKey,
          account: resolvedAccount,
          status: 'ready',
        });
      },
      () => {
        if (!active) {
          return;
        }
        setState({
          key: decisionKey,
          account: null,
          status: 'failed',
        });
      },
    );

    return () => {
      active = false;
    };
  }, [decisionKey]);

  if (!decisionKey) {
    return {
      account: null,
      status: 'idle',
    };
  }
  if (state.key !== decisionKey) {
    return {
      account: null,
      status: 'pending',
    };
  }
  return state;
}
