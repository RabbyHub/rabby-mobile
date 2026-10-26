import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';

import type { KeyringAccountWithAlias } from '@/types/account';
import { withTimeoutFallback } from '@/utils/async';

export type SingleAddressNoAssetsEvidence = {
  appChainHasBalance: boolean;
  borned: boolean;
  hasCustomTestnet: boolean;
};

export type SingleAddressNoAssetsDecision = {
  status: 'idle' | 'pending' | 'ready' | 'failed';
  evidence: SingleAddressNoAssetsEvidence | null;
};

export type SingleAddressAssetViewState =
  | 'none'
  | 'network-error'
  | 'pending'
  | 'receive'
  | 'assets';

type ResolveSingleAddressAssetViewStateParams = {
  account?: KeyringAccountWithAlias | null;
  hasNetworkError: boolean;
  chainLength: number;
  customTestnetCount: number;
  balance?: number | null;
  evmBalance?: number | null;
  balanceFlow: {
    hasValue: boolean;
    isLoading: boolean;
    hasError: boolean;
  };
  noAssetsDecision: SingleAddressNoAssetsDecision;
};

type SingleAddressNoAssetsDecisionPublisher = {
  publish(key: string, state: SingleAddressNoAssetsDecision): void;
};

type SingleAddressNoAssetsDecisionDependencies = {
  loadEvidence(
    account: KeyringAccountWithAlias,
  ): Promise<SingleAddressNoAssetsEvidence>;
  publisher: SingleAddressNoAssetsDecisionPublisher;
  timeoutMs?: number;
};

type SingleAddressNoAssetsEvidenceSources = {
  loadAppChains(
    address: string,
  ): Promise<readonly { netWorth: number }[] | void>;
  loadAddressBorned(address: string): Promise<boolean>;
  loadHasCustomTestnet(): Promise<boolean>;
};

const NO_ASSETS_DECISION_TIMEOUT_MS = 5000;

export const IDLE_SINGLE_ADDRESS_NO_ASSETS_DECISION: SingleAddressNoAssetsDecision =
  {
    status: 'idle',
    evidence: null,
  };

export function isSingleAddressReceiveTipAccount(
  account: KeyringAccountWithAlias,
) {
  return CORE_KEYRING_TYPES.includes(account.type);
}

export function hasKnownPositiveSingleAddressBalance(
  account: KeyringAccountWithAlias,
) {
  return (
    (typeof account.balance === 'number' && account.balance > 0) ||
    (typeof account.evmBalance === 'number' && account.evmBalance > 0)
  );
}

export function getSingleAddressNoAssetsDecisionKey(
  account: KeyringAccountWithAlias,
) {
  return `${account.address.toLowerCase()}:${account.type}:${
    account.brandName
  }`;
}

export function createSingleAddressNoAssetsDecisionCoordinator({
  loadEvidence,
  publisher,
  timeoutMs = NO_ASSETS_DECISION_TIMEOUT_MS,
}: SingleAddressNoAssetsDecisionDependencies) {
  const inFlightDecisions = new Map<string, Promise<void>>();

  const prepare = (
    account: KeyringAccountWithAlias,
    options?: { ignoreAccountBalance?: boolean },
  ) => {
    if (!isSingleAddressReceiveTipAccount(account)) {
      return Promise.resolve();
    }
    if (
      !options?.ignoreAccountBalance &&
      hasKnownPositiveSingleAddressBalance(account)
    ) {
      return Promise.resolve();
    }

    const key = getSingleAddressNoAssetsDecisionKey(account);
    const activeDecision = inFlightDecisions.get(key);
    if (activeDecision) {
      return activeDecision;
    }

    publisher.publish(key, { status: 'pending', evidence: null });
    const request = withTimeoutFallback(
      Promise.resolve().then(() => loadEvidence(account)),
      timeoutMs,
      null,
    )
      .then(evidence => {
        publisher.publish(
          key,
          evidence
            ? { status: 'ready', evidence }
            : { status: 'failed', evidence: null },
        );
      })
      .catch(() => {
        publisher.publish(key, { status: 'failed', evidence: null });
      })
      .finally(() => {
        if (inFlightDecisions.get(key) === request) {
          inFlightDecisions.delete(key);
        }
      });

    inFlightDecisions.set(key, request);
    return request;
  };

  return { prepare };
}

export async function collectSingleAddressNoAssetsEvidence(
  account: KeyringAccountWithAlias,
  sources: SingleAddressNoAssetsEvidenceSources,
): Promise<SingleAddressNoAssetsEvidence> {
  const [appChains, borned, hasCustomTestnet] = await Promise.all([
    sources.loadAppChains(account.address),
    sources.loadAddressBorned(account.address),
    sources.loadHasCustomTestnet(),
  ]);

  if (!appChains) {
    throw new Error('Failed to resolve AppChain assets');
  }

  return {
    appChainHasBalance: appChains.some(chain => chain.netWorth > 0),
    borned,
    hasCustomTestnet,
  };
}

export function resolveSingleAddressAssetViewState({
  account,
  hasNetworkError,
  chainLength,
  customTestnetCount,
  balance,
  evmBalance,
  balanceFlow,
  noAssetsDecision,
}: ResolveSingleAddressAssetViewStateParams): SingleAddressAssetViewState {
  if (!account) {
    return 'none';
  }
  if (hasNetworkError) {
    return 'network-error';
  }
  if (!isSingleAddressReceiveTipAccount(account)) {
    return 'assets';
  }
  if (chainLength > 0 || customTestnetCount > 0) {
    return 'assets';
  }

  const knownBalance = balance ?? account.balance;
  const knownEvmBalance = evmBalance ?? account.evmBalance;
  if (
    (typeof knownBalance === 'number' && knownBalance > 0) ||
    (typeof knownEvmBalance === 'number' && knownEvmBalance > 0)
  ) {
    return 'assets';
  }

  if (!balanceFlow.hasValue) {
    return !balanceFlow.isLoading && balanceFlow.hasError
      ? 'assets'
      : 'pending';
  }
  if (balance !== 0 || evmBalance !== 0) {
    return 'assets';
  }
  if (balanceFlow.isLoading) {
    return 'pending';
  }
  if (balanceFlow.hasError) {
    return 'assets';
  }

  if (noAssetsDecision.status === 'failed') {
    return 'assets';
  }
  if (noAssetsDecision.status !== 'ready' || !noAssetsDecision.evidence) {
    return 'pending';
  }

  const { appChainHasBalance, borned, hasCustomTestnet } =
    noAssetsDecision.evidence;
  return !appChainHasBalance && !borned && !hasCustomTestnet
    ? 'receive'
    : 'assets';
}
