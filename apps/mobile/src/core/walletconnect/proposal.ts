import { buildApprovedNamespaces } from '@walletconnect/utils';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import type { CHAINS_ENUM } from '@/constant/chains';
import type { Account } from '@/types/account';
import {
  WALLETCONNECT_NAMESPACE,
  WALLETCONNECT_SUPPORTED_EVENTS,
  WALLETCONNECT_SUPPORTED_METHODS,
} from './constants';
import {
  accountToCaip10,
  chainToCaip2,
  getRequestedChainsFromProposal,
  getRequestedMethodsFromProposal,
  getUnsupportedRequiredChainsFromProposal,
  getUnsupportedRequiredMethodsFromProposal,
  getWalletConnectAccounts,
  getWalletConnectChainByCaip2,
  getWalletConnectSupportedChains,
} from './chainAccount';
import { addWalletConnectLog } from './debugLog';
import { setWalletConnectDebugState } from './state';
import type {
  WalletConnectPairingSource,
  WalletConnectProposalViewModel,
} from './types';
import { emitWalletConnectUiEvent } from './uiEvents';

type PendingProposal = {
  id: number;
  proposal: ProposalTypes.Struct;
  source: WalletConnectPairingSource;
  verifyContext?: unknown;
};

const pendingProposals = new Map<number, PendingProposal>();

function normalizeMetadata(
  metadata: ProposalTypes.Struct['proposer']['metadata'] | undefined,
) {
  return {
    name: metadata?.name || 'Unknown dapp',
    description: metadata?.description || '',
    url: metadata?.url || '',
    icons: Array.isArray(metadata?.icons) ? metadata.icons : [],
    redirectNative: metadata?.redirect?.native || '',
  };
}

function buildProposalViewModel(
  pending: PendingProposal,
): WalletConnectProposalViewModel {
  const proposal = pending.proposal;
  return {
    id: pending.id,
    source: pending.source,
    receivedAt: Date.now(),
    proposer: normalizeMetadata(proposal?.proposer?.metadata),
    requiredNamespaces: proposal?.requiredNamespaces || {},
    optionalNamespaces: proposal?.optionalNamespaces || {},
    requestedChains: getRequestedChainsFromProposal(proposal),
    requestedMethods: getRequestedMethodsFromProposal(proposal),
    unsupportedRequiredChains:
      getUnsupportedRequiredChainsFromProposal(proposal),
    unsupportedRequiredMethods:
      getUnsupportedRequiredMethodsFromProposal(proposal),
    verifyContext: pending.verifyContext,
  };
}

export function storeWalletConnectProposal(input: {
  id: number;
  proposal: ProposalTypes.Struct;
  source: WalletConnectPairingSource;
  verifyContext?: unknown;
}) {
  const pending: PendingProposal = {
    id: input.id,
    proposal: input.proposal,
    source: input.source,
    verifyContext: input.verifyContext,
  };
  pendingProposals.set(input.id, pending);

  const proposal = buildProposalViewModel(pending);
  setWalletConnectDebugState(prev => ({
    ...prev,
    pairing: {
      ...prev.pairing,
      status: 'proposal',
      source: input.source,
      error: undefined,
    },
    proposal,
  }));
  emitWalletConnectUiEvent({
    type: 'proposalReceived',
    proposal,
  });
  addWalletConnectLog('proposal', 'session_proposal received', proposal);
}

export function getWalletConnectPendingProposal(proposalId: number) {
  return pendingProposals.get(proposalId) || null;
}

export function clearWalletConnectProposal(proposalId?: number) {
  if (typeof proposalId === 'number') {
    pendingProposals.delete(proposalId);
  } else {
    pendingProposals.clear();
  }

  let didClearProposal = false;
  setWalletConnectDebugState(prev => {
    const shouldKeepProposal =
      typeof proposalId === 'number' && prev.proposal?.id !== proposalId;
    didClearProposal = !!prev.proposal && !shouldKeepProposal;

    return {
      ...prev,
      proposal: shouldKeepProposal ? prev.proposal : undefined,
    };
  });
  if (didClearProposal) {
    emitWalletConnectUiEvent({
      type: 'proposalCleared',
    });
  }
}

export function setWalletConnectProposalError(
  proposalId: number,
  error: string,
) {
  setWalletConnectDebugState(prev => {
    if (prev.proposal?.id !== proposalId) {
      return prev;
    }
    return {
      ...prev,
      proposal: {
        ...prev.proposal,
        error,
      },
    };
  });
}

export function buildApprovedNamespacesForAccount(input: {
  proposal: ProposalTypes.Struct;
  account: Account;
  fallbackChain?: CHAINS_ENUM;
}): SessionTypes.Namespaces {
  const namespaces = buildApprovedNamespaces({
    proposal: input.proposal,
    supportedNamespaces: {
      [WALLETCONNECT_NAMESPACE]: {
        chains: getWalletConnectSupportedChains(),
        methods: WALLETCONNECT_SUPPORTED_METHODS,
        events: WALLETCONNECT_SUPPORTED_EVENTS,
        accounts: getWalletConnectAccounts(input.account),
      },
    },
  });

  if (hasNamespacesData(namespaces)) {
    return namespaces;
  }

  const fallbackNamespaces = buildOptionalEip155FallbackNamespace(input);
  if (fallbackNamespaces) {
    return fallbackNamespaces;
  }

  throw new Error('No supported WalletConnect namespace to approve.');
}

function hasNamespacesData(namespaces: SessionTypes.Namespaces) {
  return Object.keys(namespaces).length > 0;
}

function intersectRequestedValues(requested: string[], supported: string[]) {
  const supportedSet = new Set(supported);
  return requested.filter(value => supportedSet.has(value));
}

function buildOptionalEip155FallbackNamespace(input: {
  proposal: ProposalTypes.Struct;
  account: Account;
  fallbackChain?: CHAINS_ENUM;
}): SessionTypes.Namespaces | null {
  if (Object.keys(input.proposal.requiredNamespaces || {}).length) {
    return null;
  }

  const optionalNamespace =
    input.proposal.optionalNamespaces?.[WALLETCONNECT_NAMESPACE];
  if (!optionalNamespace) {
    return null;
  }

  const fallbackChain = input.fallbackChain
    ? getWalletConnectSupportedChains()
        .map(chainId => getWalletConnectChainByCaip2(chainId))
        .find(chain => chain?.enum === input.fallbackChain)
    : null;
  if (!fallbackChain) {
    return null;
  }

  const methods = intersectRequestedValues(
    optionalNamespace.methods || [],
    WALLETCONNECT_SUPPORTED_METHODS,
  );
  if (!methods.length) {
    return null;
  }

  const events = intersectRequestedValues(
    optionalNamespace.events || [],
    WALLETCONNECT_SUPPORTED_EVENTS,
  );
  const chain = chainToCaip2(fallbackChain);

  return {
    [WALLETCONNECT_NAMESPACE]: {
      chains: [chain],
      methods,
      events,
      accounts: [accountToCaip10(input.account, fallbackChain)],
    },
  };
}
