import { buildApprovedNamespaces } from '@walletconnect/utils';
import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import type { Account } from '@/types/account';
import {
  WALLETCONNECT_NAMESPACE,
  WALLETCONNECT_SUPPORTED_EVENTS,
  WALLETCONNECT_SUPPORTED_METHODS,
} from './constants';
import {
  getRequestedChainsFromProposal,
  getRequestedMethodsFromProposal,
  getUnsupportedRequiredChainsFromProposal,
  getUnsupportedRequiredMethodsFromProposal,
  getWalletConnectAccounts,
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
}): SessionTypes.Namespaces {
  return buildApprovedNamespaces({
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
}
