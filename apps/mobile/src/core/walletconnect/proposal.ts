import { buildApprovedNamespaces } from '@walletconnect/utils';
import type { Account } from '@/types/account';
import {
  WALLETCONNECT_NAMESPACE,
  WALLETCONNECT_SUPPORTED_EVENTS,
  WALLETCONNECT_SUPPORTED_METHODS,
} from './constants';
import {
  getRequestedChainsFromProposal,
  getRequestedMethodsFromProposal,
  getUnsupportedChainsFromProposal,
  getUnsupportedMethodsFromProposal,
  getWalletConnectAccounts,
  getWalletConnectSupportedChains,
} from './chainAccount';
import { addWalletConnectLog } from './debugLog';
import { setWalletConnectDebugState } from './state';
import type {
  WalletConnectPairingSource,
  WalletConnectProposalViewModel,
} from './types';

type PendingProposal = {
  id: number;
  proposal: any;
  source: WalletConnectPairingSource;
  verifyContext?: unknown;
};

const pendingProposals = new Map<number, PendingProposal>();

function normalizeMetadata(metadata: any) {
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
    unsupportedChains: getUnsupportedChainsFromProposal(proposal),
    unsupportedMethods: getUnsupportedMethodsFromProposal(proposal),
    verifyContext: pending.verifyContext,
  };
}

export function storeWalletConnectProposal(input: {
  id: number;
  proposal: any;
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

  setWalletConnectDebugState(prev => ({
    ...prev,
    proposal:
      typeof proposalId === 'number' && prev.proposal?.id !== proposalId
        ? prev.proposal
        : undefined,
  }));
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
  proposal: any;
  account: Account;
}) {
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
