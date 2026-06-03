import { getSdkError } from '@walletconnect/utils';
import type { SessionTypes } from '@walletconnect/types';
import type { Account } from '@/types/account';
import {
  clearWalletConnectAutoDisconnectTopic,
  replaceWalletConnectSessionsForAutoDisconnect,
} from './autoDisconnect';
import { getWalletConnectClientOrThrow, initWalletConnect } from './client';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
import { pairWalletConnectUri } from './pairing';
import {
  buildApprovedNamespacesForAccount,
  clearWalletConnectProposal,
  getWalletConnectPendingProposal,
  setWalletConnectProposalError,
} from './proposal';
import { maybeRedirectToDapp } from './redirectPolicy';
import { syncWalletConnectSessionsFromClient } from './sessions';
import { clearWalletConnectProposalPairingState } from './state';

export { initWalletConnect, pairWalletConnectUri };
export {
  getWalletConnectDebugState,
  subscribeWalletConnectDebugState,
} from './state';
export {
  parseWalletConnectUri,
  parseWalletConnectUriFromLink,
  isWalletConnectUri,
  WalletConnectUriError,
} from './uri';
export {
  getWalletConnectChainByCaip2,
  getWalletConnectSupportedChains,
  getWalletConnectAccounts,
} from './chainAccount';
export { shouldAutoRedirectToDapp } from './redirectPolicy';
export {
  getWalletConnectAutoDisconnectEnabled,
  setWalletConnectAutoDisconnectEnabled,
} from './autoDisconnect';
export type {
  WalletConnectDebugState,
  WalletConnectPairingSource,
} from './types';

type WalletConnectSdkErrorKey = Parameters<typeof getSdkError>[0];

function getSdkErrorCompat(key: WalletConnectSdkErrorKey) {
  return getSdkError(key);
}

export async function approveWalletConnectProposal(input: {
  proposalId: number;
  account: Account;
}) {
  const walletKit = getWalletConnectClientOrThrow();
  const pending = getWalletConnectPendingProposal(input.proposalId);
  if (!pending) {
    throw new Error('WalletConnect proposal not found or already handled.');
  }

  let namespaces: SessionTypes.Namespaces;
  try {
    namespaces = buildApprovedNamespacesForAccount({
      proposal: pending.proposal,
      account: input.account,
    });
  } catch (error: unknown) {
    const message = getWalletConnectErrorMessage(error);
    setWalletConnectProposalError(input.proposalId, message);
    addWalletConnectLog(
      'proposal',
      'failed to build approved namespaces',
      error,
      'error',
    );
    try {
      const sdkErrorKey = /method/i.test(message)
        ? 'UNSUPPORTED_METHODS'
        : 'UNSUPPORTED_CHAINS';
      await walletKit.rejectSession({
        id: input.proposalId,
        reason: getSdkErrorCompat(sdkErrorKey),
      });
      clearWalletConnectProposal(input.proposalId);
    } catch (rejectError) {
      addWalletConnectLog(
        'proposal',
        'failed to reject invalid proposal',
        rejectError,
        'error',
      );
    }
    throw error;
  }

  try {
    const session = await walletKit.approveSession({
      id: input.proposalId,
      namespaces,
    });
    clearWalletConnectProposal(input.proposalId);
    clearWalletConnectProposalPairingState();
    await replaceWalletConnectSessionsForAutoDisconnect(
      walletKit,
      session.topic,
    );
    syncWalletConnectSessionsFromClient(walletKit);
    addWalletConnectLog('proposal', 'session approved', {
      id: input.proposalId,
      topic: session.topic,
      source: pending.source,
    });
    await maybeRedirectToDapp({
      source: pending.source,
      nativeRedirect: session.peer?.metadata?.redirect?.native,
    });
  } catch (error: unknown) {
    const message = getWalletConnectErrorMessage(error);
    setWalletConnectProposalError(input.proposalId, message);
    addWalletConnectLog('proposal', 'approveSession failed', error, 'error');
    throw error;
  }
}

export async function rejectWalletConnectProposal(proposalId: number) {
  const walletKit = getWalletConnectClientOrThrow();
  await walletKit.rejectSession({
    id: proposalId,
    reason: getSdkErrorCompat('USER_REJECTED'),
  });
  clearWalletConnectProposal(proposalId);
  clearWalletConnectProposalPairingState();
  addWalletConnectLog('proposal', 'session proposal rejected', { proposalId });
}

export async function disconnectWalletConnectSession(topic: string) {
  const walletKit = getWalletConnectClientOrThrow();
  clearWalletConnectAutoDisconnectTopic(topic);
  await walletKit.disconnectSession({
    topic,
    reason: getSdkErrorCompat('USER_DISCONNECTED'),
  });
  syncWalletConnectSessionsFromClient(walletKit);
  addWalletConnectLog('sessions', 'session disconnected by wallet', { topic });
}

export async function refreshWalletConnectSessions() {
  const walletKit = await initWalletConnect();
  syncWalletConnectSessionsFromClient(walletKit);
}
